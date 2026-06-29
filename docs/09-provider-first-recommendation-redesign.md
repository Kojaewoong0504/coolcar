# 추천엔진 재설계안: TMAP Optional + Comfort Provider 중심 v1

- 작성일: 2026-06-29
- 대상 코드: `src/app/api/recommend/route.ts`, `src/lib/recommendation.ts`, `src/lib/providers.ts`, `src/lib/types.ts`, `src/app/api/feedback/route.ts`, `supabase/schema.sql`
- 범위: 자연어/음성 제외, API 실패에도 동작, 화면에는 기술어/원시 점수/Provider명 노출 금지

## 1. 현재 코드 진단

현재 추천 흐름은 다음 구조다.

```txt
POST /api/recommend
  → recommendRequestSchema
  → recommend(request)
  → resolveProvider(request)
  → TmapCongestionProvider 우선
  → 실패 시 EstimatedCongestionProvider 또는 statisticalFallback
  → scoreCar()
  → RecommendationResponse
```

현재 장점:

1. `/api/recommend`가 이미 단일 진입점이다.
2. `CarComfort`, `RecommendRequest`, `RecommendationResponse`, `SourceMeta` 타입이 존재한다.
3. TMAP 실패 시 fallback이 있고 앱이 중단되지 않는다.
4. 피드백 저장 API와 `feedback_events`, `user_preference_stats`, `anonymous_preference_stats`가 이미 있다.
5. 결과 화면은 이미 `friendlyReason()` 중심이라 Provider명·원시 점수를 대부분 숨길 수 있는 구조다.

현재 한계:

1. `TmapCongestionProvider`가 provider 배열의 첫 번째라 제품 설계상 핵심처럼 보인다.
2. `EstimatedCongestionProvider`가 혼잡 추정과 냉방 정적 규칙을 한 함수(`generateCars`)에 섞어 계산한다.
3. 사용자 피드백은 저장되지만 추천 계산의 provider로 다시 들어오지 않는다.
4. `totalComfortScore`, `sourceMeta.provider`, `sourceMeta.message`가 API 응답에 그대로 포함되어 있어 화면/디버그 UI에 노출될 위험이 있다.
5. `confidenceScore`, `uncertaintyPenalty`, `feedbackScore`, `coolingScore`의 책임 경계가 명확하지 않다.

## 2. 설계 방향

TMAP은 “실시간/칸별 혼잡도 보강 provider”로만 둔다. 추천엔진의 기본 동작은 아래 세 provider로 완성한다.

```txt
StaticCoolingProvider       항상 동작: 약냉방칸/칸 위치/노선 차량 수/기본 냉방 규칙
EstimatedComfortProvider    항상 동작: 시간대/역/방향/칸 위치 기반 혼잡·동선 추정
UserFeedbackProvider        선택 동작: 최근 버튼 제보와 누적 사용자 성향 반영
TmapCongestionProvider      선택 동작: 설정됨 + 허용됨 + 성공 시 crowding만 보강
```

핵심 원칙:

1. **API 없이도 추천 가능해야 한다.** Supabase/TMAP/외부 API가 모두 실패해도 Static + Estimated로 결과를 반환한다.
2. **TMAP은 점수의 결정권자가 아니다.** TMAP은 crowding signal 하나를 보강할 뿐 최종 추천은 ComfortEngine이 합성한다.
3. **Provider 결과와 화면 표현을 분리한다.** 서버 내부는 점수를 쓰되 화면에는 “추천/대안/피하기”, “덜 붐벼요”, “일반냉방 쪽이에요”만 노출한다.
4. **사용자 제보는 자연어가 아니라 버튼형 signal만 받는다.** `HOT`, `COLD`, `CROWDED`, `GOOD`, `WRONG`과 선택형 체감값만 사용한다.

## 3. 추천 타입 제안

`src/lib/types.ts` 기준으로 기존 타입을 확장한다.

### 3.1 사용자 선택 타입

현재 `ComfortType`은 유지하되 화면 문구는 소비자 언어로 매핑한다.

```ts
export type ComfortType =
  | 'HOT_SENSITIVE'   // 시원하게
  | 'COLD_SENSITIVE'  // 너무 춥지 않게
  | 'CROWD_AVOIDER'   // 덜 붐비게
  | 'BALANCED';       // 무난하게
```

P0에서는 새 모드를 늘리지 않고 기존 4개를 유지한다. 단, 제품 문구는 다음처럼 표시한다.

| 내부값 | 화면 문구 | 핵심 가중치 |
|---|---|---|
| `HOT_SENSITIVE` | 시원하게 가고 싶어요 | 냉방 + 혼잡 |
| `COLD_SENSITIVE` | 너무 춥지 않게 가고 싶어요 | 약냉방/과냉방 회피 + 혼잡 |
| `CROWD_AVOIDER` | 덜 붐비게 가고 싶어요 | 혼잡 회피 |
| `BALANCED` | 무난한 위치가 좋아요 | 냉방 + 혼잡 + 동선 균형 |

### 3.2 내부 Provider Signal 타입

`CarComfort`를 provider가 직접 완성하는 대신, provider는 signal만 반환하게 한다.

```ts
export type ComfortProviderName =
  | 'StaticCoolingProvider'
  | 'EstimatedComfortProvider'
  | 'UserFeedbackProvider'
  | 'TmapCongestionProvider';

export type ComfortSignalSourceType =
  | 'STATIC_RULE'
  | 'ESTIMATED_PATTERN'
  | 'USER_FEEDBACK_RECENT'
  | 'USER_FEEDBACK_PROFILE'
  | 'OPTIONAL_TMAP';

export type ScoreSignal = {
  carNo: number;
  cooling?: number;      // 0~100, 높을수록 시원함
  crowding?: number;     // 0~100, 높을수록 덜 붐빔
  feedback?: number;     // -20~+20, 최근/개인 제보 보정
  transfer?: number;     // 0~100, 내릴 위치/환승/출구 가까움
  confidence?: number;   // 0~1, 이 signal 자체의 신뢰도
  reasons?: InternalReasonCode[];
};

export type ProviderSignalResult = {
  provider: ComfortProviderName;
  sourceType: ComfortSignalSourceType;
  ok: boolean;
  signals: ScoreSignal[];
  observedAt: string;
  ttlSeconds?: number;
  errorCode?: string;       // 내부 로깅용, 화면 노출 금지
  confidence: number;       // 0~1
};

export type InternalReasonCode =
  | 'GENERAL_AC'
  | 'WEAK_AC'
  | 'EDGE_COOLER'
  | 'CENTER_MORE_CROWDED'
  | 'RUSH_HOUR_PATTERN'
  | 'RECENT_HOT_REPORT'
  | 'RECENT_COLD_REPORT'
  | 'RECENT_CROWDED_REPORT'
  | 'USER_LIKED_THIS_ZONE'
  | 'USER_DISLIKED_THIS_ZONE'
  | 'TRANSFER_NEAR';
```

중요: `ProviderSignalResult.provider`, `errorCode`, `confidence`는 **서버 내부/저장용**이다. 클라이언트 화면에는 내려도 되지만 렌더링하지 않거나, 가능하면 `debug` 필드로 분리해 운영 화면에서 제거한다.

### 3.3 최종 Car 타입

현재 `CarComfort`는 유지하되 내부 점수와 화면용 상태를 분리한다.

```ts
export type CarRecommendationBand = 'BEST' | 'ALTERNATIVE' | 'OK' | 'AVOID' | 'UNKNOWN';
export type CrowdLevel = '여유' | '보통' | '주의' | '혼잡';

export type CarComfort = {
  carNo: number;
  label: string;
  position: 'front' | 'middle' | 'back';

  // 내부 계산용. 화면 직접 노출 금지.
  crowdScore: number;
  coolingScore: number;
  convenienceScore: number;
  feedbackScore?: number;
  confidenceScore?: number;
  uncertaintyPenalty?: number;
  totalComfortScore: number;

  // 화면 표현용.
  band?: CarRecommendationBand;
  crowdLevel?: CrowdLevel;
  displayBadges?: string[];       // 예: ['추천', '대안', '피하기']
  displayReasons?: string[];      // 예: ['덜 붐비는 편이에요', '일반냉방 쪽이에요']

  isWeakAc: boolean;
  isPrioritySeatArea: boolean;
  tags: string[];                 // 기존 호환용. 점진적으로 displayBadges/displayReasons로 대체.
};
```

## 4. Provider 책임

### 4.1 StaticCoolingProvider

목적: API 없이 항상 작동하는 냉방/차량 규칙 provider.

입력:

- `line`
- `comfortType`
- `avoidPrioritySeatArea`

데이터 출처:

- 현재 `src/lib/providers.ts`의 `weakAcCars`
- 향후 `supabase.weak_ac_cars`
- 노선별 차량 수: 현재 `lineCarCount()` 유지

Signal:

```txt
cooling 0~100
confidence 0.75~0.9
sourceType STATIC_RULE
```

규칙:

| 조건 | HOT_SENSITIVE | COLD_SENSITIVE | BALANCED/CROWD_AVOIDER |
|---|---:|---:|---:|
| 일반냉방칸 | + | 중립 또는 약감점 | + |
| 약냉방칸 | 강감점 | 가점 | 약감점 또는 중립 |
| 양끝 칸 | 시원함 가점 | 직접 바람 부담 약감점 가능 | 소폭 가점 |
| 교통약자석 인근 회피 설정 | 최종점수 감점 | 최종점수 감점 | 최종점수 감점 |

구현 위치 제안:

- `src/lib/recommendation/providers/staticCooling.ts`
- 기존 `weakAcCars`, `lineCarCount()`를 이 파일로 이동

### 4.2 EstimatedComfortProvider

목적: TMAP 없이 시간대/역/방향/칸 위치 기반으로 혼잡·동선 기본값을 추정한다.

입력:

- `line`
- `originStation`
- `destinationStation?`
- `direction?`
- `targetTime?`

데이터 출처:

- 현재 `generateCars(request, 'estimated')`의 stable hash + rush hour bias 로직
- 향후 공공 혼잡도 CSV/시간대 통계
- 환승/하차 근접 DB가 없으면 낮은 confidence의 기본 동선 점수

Signal:

```txt
crowding 0~100
transfer 0~100
confidence 0.45~0.7
sourceType ESTIMATED_PATTERN
```

혼잡 레벨 변환:

| crowding score | 화면 레벨 |
|---:|---|
| 75~100 | 여유 |
| 50~74 | 보통 |
| 30~49 | 주의 |
| 0~29 | 혼잡 |

주의: 현재 `congestionToTag()`는 `여유/보통/혼잡` 3단계만 있으므로 P0에서 `주의`를 추가한다.

구현 위치 제안:

- `src/lib/recommendation/providers/estimatedComfort.ts`
- 기존 `generateCars()`의 혼잡/편의 추정 로직을 signal 생성으로 분리

### 4.3 UserFeedbackProvider

목적: 버튼형 제보와 개인/익명 선호 누적값을 추천 계산에 반영한다.

입력:

- `line`
- `originStation`
- `direction?`
- `anonymousId?`
- 현재 로그인 사용자 ID는 server route에서 내부적으로 확인

데이터 출처:

- `feedback_events`: 최근 현장 제보
- `user_preference_stats`: 로그인 사용자 누적 성향
- `anonymous_preference_stats`: 비로그인 사용자 누적 성향

Signal:

```txt
feedback -20~+20
cooling 보정 -10~+10
crowding 보정 -15~+10
confidence 0.2~0.75
sourceType USER_FEEDBACK_RECENT 또는 USER_FEEDBACK_PROFILE
```

최근 제보 TTL:

| 경과 시간 | 반영 강도 |
|---|---:|
| 0~10분 | 1.0 |
| 10~30분 | 0.6 |
| 30~90분 | 0.25 |
| 90분 이후 | 실시간 보정 제외, 통계화 후보 |

제보 매핑:

| 피드백 | 효과 |
|---|---|
| `GOOD` | 해당 칸 `feedback +8`, 개인 선호 칸 가점 |
| `HOT` | 해당 칸 `cooling -10`, 더위형에게 추가 감점 |
| `COLD` | 해당 칸 HOT_SENSITIVE에는 중립/소감점, COLD_SENSITIVE에는 강감점 |
| `CROWDED` | 해당 칸 `crowding -15` |
| `WRONG` | 해당 칸 `feedback -12`, 추천 신뢰도 하향 |

운영 안전장치:

1. 동일 `anonymousId`/사용자/IP 성격 키의 짧은 시간 반복 제보는 집계 시 상한을 둔다.
2. 최근 제보가 1개뿐이면 최대 보정폭을 절반으로 제한한다.
3. Supabase 실패 시 `ok=false`, 빈 signals로 반환하고 추천은 계속 진행한다.

구현 위치 제안:

- `src/lib/recommendation/providers/userFeedback.ts`
- `getSupabaseAdmin()`은 provider 내부에서 optional 사용
- 실패해도 throw하지 않고 `ok=false` 반환

### 4.4 TmapCongestionProvider Optional화

목적: TMAP/SK OpenAPI가 가능한 환경에서만 crowding signal을 보강한다.

변경 원칙:

1. provider 실행 순서에서 “필수 첫 번째”가 아니라 “선택 보강”으로 이동한다.
2. `TMAP_LIVE_ENABLED` 또는 현 config의 live flag가 꺼져 있으면 호출하지 않는다.
3. 무료 quota 보호를 위해 cache hit가 아니면 호출 제한을 둔다.
4. 실패/403/timeout/malformed는 내부 진단 로그만 남기고 사용자는 같은 추천 결과를 받는다.

Signal:

```txt
crowding 0~100
confidence 0.75~0.9 when ok
sourceType OPTIONAL_TMAP
```

구현 위치 제안:

- 현재 `src/lib/providers.ts`의 `TmapCongestionProvider`를 `src/lib/recommendation/providers/tmapCongestion.ts`로 이동
- 기존 `runTmapDiagnosticProbe()`와 `logProviderDiagnosticEvent()`는 유지
- 실패 시 `statisticalFallback()`을 반환하지 말고 `ok=false, signals=[]`를 반환

## 5. 합성 스코어 제안

Provider가 완성차 목록을 반환하지 않고 signal 배열을 반환하면, `ComfortEngine`이 칸별 기본 객체를 만들고 점수를 합성한다.

### 5.1 정규화 범위

```txt
coolingScore      0~100  높을수록 시원함
crowdScore        0~100  높을수록 덜 붐빔
transferScore     0~100  높을수록 내릴 때 편함
feedbackScore    -20~20  최근/개인 제보 보정
confidenceScore   0~10   충분한 근거가 있을 때 소폭 가점
uncertaintyPenalty 0~15  근거 부족/상충/오래된 데이터 감점
totalComfortScore 0~100  내부 정렬용, 화면 노출 금지
```

### 5.2 모드별 가중치

| 모드 | cooling | crowd | transfer | feedback | confidence |
|---|---:|---:|---:|---:|---:|
| HOT_SENSITIVE | 0.42 | 0.30 | 0.14 | 1.00 | 0.50 |
| COLD_SENSITIVE | -0.18 또는 coldFitScore 0.38 | 0.30 | 0.16 | 1.00 | 0.50 |
| CROWD_AVOIDER | 0.18 | 0.52 | 0.14 | 1.00 | 0.50 |
| BALANCED | 0.30 | 0.34 | 0.20 | 1.00 | 0.50 |

`COLD_SENSITIVE`는 `coolingScore`에 음수 가중치를 그대로 두면 일반냉방칸이 과도하게 밀릴 수 있다. 더 안정적인 방식은 내부에서 `coldFitScore`를 별도로 만든다.

```txt
coldFitScore = isWeakAc ? 82 : clamp(100 - coolingScore + 35, 35, 78)
```

따라서 COLD_SENSITIVE 최종식은 아래를 권장한다.

```txt
total =
  coldFitScore * 0.38
+ crowdScore * 0.30
+ transferScore * 0.16
+ feedbackScore
+ confidenceScore * 0.50
- uncertaintyPenalty
- prioritySeatPenalty
```

나머지 모드:

```txt
total =
  coolingScore * W.cooling
+ crowdScore * W.crowd
+ transferScore * W.transfer
+ feedbackScore
+ confidenceScore * 0.50
- uncertaintyPenalty
- prioritySeatPenalty
```

### 5.3 Provider별 합성 규칙

동일 칸에 여러 signal이 있을 때:

1. `StaticCoolingProvider`의 cooling은 기본값으로 항상 채택한다.
2. `EstimatedComfortProvider`의 crowding은 기본값으로 항상 채택한다.
3. `TmapCongestionProvider`가 성공하면 crowding만 덮어쓰되, 최근 사용자 제보와 상충하면 100% 덮어쓰지 않는다.
4. `UserFeedbackProvider`는 보정값으로 더한다.

권장 합성:

```txt
finalCrowdScore =
  tmapCrowd exists
    ? weightedAverage(estimatedCrowd, tmapCrowd, 0.25, 0.75)
    : estimatedCrowd

if recentFeedbackCrowd exists:
  finalCrowdScore = clamp(finalCrowdScore + feedbackCrowdDelta, 0, 100)
```

불확실성 감점:

| 조건 | penalty |
|---|---:|
| Static + Estimated만 있음 | 5 |
| 최근 제보와 TMAP/추정이 크게 상충 | 4~8 |
| signal confidence 평균 0.4 미만 | 6 |
| 특정 칸 signal 없음 | 10 |
| Provider 실패 | 사용자 화면 감점 표현 금지, 내부 penalty 최대 3 |

## 6. API 응답/화면 분리

### 6.1 서버 응답 권장 형태

현재 `RecommendationResponse`는 호환 유지하되 다음 필드를 추가한다.

```ts
export type RecommendationResponse = {
  recommendationId: string;
  request: RecommendRequest;
  recommendedCar: CarComfort;
  avoidCars: CarComfort[];
  cars: CarComfort[];
  reasons: string[];

  // 내부/저장/디버그용. 일반 UI 직접 노출 금지.
  sourceMeta: SourceMeta;
  fallbackUsed: boolean;

  // 화면 전용.
  display: {
    title: string;       // 예: '오늘은 1번 칸이 좋아요'
    subtitle: string;    // 예: '덜 붐비고, 일반냉방 쪽이에요.'
    badges: string[];    // 예: ['추천 완료', '내릴 때 편한 위치']
    notices: string[];   // 예: ['추천은 승차 위치 참고용이에요.']
  };

  safetyNotice: string;
};
```

P0에서는 `display` 추가 없이 `result/page.tsx`의 `friendlyReason()`을 유지해도 된다. 단, 다음 항목은 화면에 렌더링하지 않는다.

금지:

```txt
provider
sourceMeta.provider
cacheHit
fallbackUsed
confidence
raw score
totalComfortScore
TMAP 오류
통계 API 오류
quota
```

허용:

```txt
추천
대안
피하기
확인중
덜 붐비는 편이에요
일반냉방 쪽이에요
너무 춥지 않은 쪽이에요
내릴 때 움직임이 적어요
```

## 7. 구현 순서

### Step 1. 타입 추가

수정 파일:

- `src/lib/types.ts`

작업:

1. `ComfortProviderName`, `ComfortSignalSourceType`, `ScoreSignal`, `ProviderSignalResult` 추가
2. `CarRecommendationBand`, `CrowdLevel` 추가
3. `CarComfort`에 선택 필드 `feedbackScore`, `confidenceScore`, `uncertaintyPenalty`, `band`, `crowdLevel`, `displayBadges`, `displayReasons` 추가

호환성: 기존 필드는 유지하므로 현재 UI/API가 즉시 깨지지 않는다.

### Step 2. Provider 분리

신규 파일:

```txt
src/lib/recommendation/providers/staticCooling.ts
src/lib/recommendation/providers/estimatedComfort.ts
src/lib/recommendation/providers/userFeedback.ts
src/lib/recommendation/providers/tmapCongestion.ts
src/lib/recommendation/engine.ts
```

기존 `src/lib/providers.ts`는 P0에서는 adapter 역할로 남겨도 된다.

### Step 3. resolveProvider → collectSignals로 변경

현재:

```ts
resolveProvider(request): Promise<ProviderResult>
```

변경:

```ts
collectComfortSignals(request): Promise<ProviderSignalResult[]>
```

실행 정책:

```txt
필수: StaticCoolingProvider, EstimatedComfortProvider
선택: UserFeedbackProvider, TmapCongestionProvider
실패 허용: 모든 provider는 실패해도 throw하지 않고 ok=false result 반환
```

실행 순서:

1. StaticCoolingProvider 동기/즉시
2. EstimatedComfortProvider 동기/즉시
3. UserFeedbackProvider 비동기, timeout 150ms 권장
4. TmapCongestionProvider 비동기, cache 우선, timeout 300ms 권장

P0에서는 순차 실행도 가능하지만, UX 속도를 위해 선택 provider는 `Promise.allSettled()` 권장.

### Step 4. `recommendation.ts`를 ComfortEngine 중심으로 변경

현재 `scoreCar()`를 다음 구조로 바꾼다.

```txt
recommend(request)
  → collectComfortSignals(request)
  → buildBaseCars(line)
  → mergeSignalsByCar()
  → scoreCarsByComfortType()
  → assignBandsAndDisplayReasons()
  → RecommendationResponse
```

### Step 5. 피드백 provider 연결

수정 파일:

- `src/app/api/feedback/route.ts`: 저장 구조 유지
- `src/lib/recommendation/providers/userFeedback.ts`: 최근 제보/개인 통계를 읽어서 signal 생성

추가 DB 인덱스 권장:

```sql
create index if not exists idx_feedback_events_recent_context
on public.feedback_events(line, station, direction, car_no, created_at desc);
```

`direction` null 검색이 많으면 expression index나 station+line+car_no 중심으로 먼저 시작한다.

### Step 6. UI 안전장치

수정 파일:

- `src/app/result/page.tsx`
- 필요 시 `src/app/data-source/page.tsx`

작업:

1. `totalComfortScore`, `sourceMeta.provider`, `sourceMeta.message`, `fallbackUsed` 직접 표시 금지
2. 칸 지도는 `band` 기준으로 `추천/대안/피하기/확인중`만 표시
3. `crowdLevel`은 `여유/보통/주의/혼잡`만 표시
4. 기술어는 데이터 출처 페이지에서도 소비자 문구로 치환

## 8. 수용 기준

### 8.1 기능 수용 기준

1. `TMAP` 관련 env가 없거나 `TMAP_LIVE_ENABLED=false`여도 `/api/recommend`는 200을 반환한다.
2. TMAP API가 403/timeout/malformed response를 반환해도 추천 결과가 반환된다.
3. Supabase가 미설정이어도 Static + Estimated 기반 추천 결과가 반환된다.
4. `StaticCoolingProvider`와 `EstimatedComfortProvider`는 모든 추천 요청에서 실행된다.
5. `UserFeedbackProvider`는 Supabase가 있을 때 최근 제보/개인 통계를 반영하고, 실패 시 추천을 막지 않는다.
6. 최종 결과는 항상 최소 1개의 추천 칸과 1~10칸 또는 노선별 차량 수에 맞는 칸 지도를 포함한다.
7. `HOT_SENSITIVE`에서 약냉방칸은 일반냉방칸보다 불리하게 계산된다.
8. `COLD_SENSITIVE`에서 약냉방칸은 가점 또는 과냉방 회피 점수를 받는다.
9. `CROWD_AVOIDER`에서 `CROWDED` 최근 제보가 있는 칸은 추천 순위가 내려간다.
10. `BALANCED`는 냉방/혼잡/동선 중 하나만 극단적으로 좋은 칸보다 균형 잡힌 칸을 우선한다.

### 8.2 화면 수용 기준

1. 결과 화면에 `provider`, `score`, `confidence`, `cache`, `fallback`, `TMAP`, `API 오류`, `quota` 문구가 보이지 않는다.
2. 결과 화면의 칸 지도에는 소비자 문구만 보인다: `추천`, `대안`, `피하기`, `확인중`.
3. 혼잡 표현은 `여유/보통/주의/혼잡` 4단계만 사용한다.
4. 추천 이유는 `덜 붐비는 편이에요`, `일반냉방 쪽이에요`, `너무 춥지 않은 쪽이에요`, `내릴 때 움직임이 적어요`처럼 생활 언어로만 표시한다.
5. 사용자에게 API 실패를 직접 알리지 않는다. 필요 시 `지금 확인 가능한 정보로 골랐어요` 정도의 중립 문구만 사용한다.

### 8.3 데이터/운영 수용 기준

1. Provider별 실패는 내부 로그 또는 `provider_diagnostic_events`에만 저장된다.
2. API key 원문은 로그/DB/API 응답 어디에도 저장하지 않는다.
3. `recommendation_events.response_payload`에는 내부 점수가 저장될 수 있으나, 클라이언트 표시 컴포넌트는 이를 직접 렌더링하지 않는다.
4. 최근 피드백 조회는 `line + station + direction + car_no + created_at` 기준으로 제한되어야 하며 전체 테이블 스캔을 피한다.
5. TMAP 호출은 캐시 우선이며, cache key는 `line + station + direction + dow + hh` 등 재사용 가능한 단위로 묶는다.

### 8.4 검증 명령 기준

구현 후 최소 검증:

```bash
npm run typecheck
npm run build
npm run test:api
```

추가 smoke 권장:

```bash
# TMAP env 없이도 추천 성공
curl -s -X POST http://localhost:3000/api/recommend \
  -H 'Content-Type: application/json' \
  -d '{"line":"2호선","originStation":"강남","destinationStation":"잠실","comfortType":"BALANCED"}'

# 피드백 저장 API가 Supabase 미설정에서도 앱을 막지 않음
curl -s -X POST http://localhost:3000/api/feedback \
  -H 'Content-Type: application/json' \
  -d '{"line":"2호선","station":"강남","carNo":1,"feedbackType":"CROWDED"}'
```

응답 검증:

1. `/api/recommend` 응답에 `recommendedCar`, `cars[]`, `avoidCars[]`가 있다.
2. `cars.length`가 노선 차량 수와 일치한다.
3. 추천 실패가 아니라 fallback 추천이 반환된다.
4. 브라우저 결과 화면에 내부 기술어가 노출되지 않는다.

## 9. P0 완료 정의

P0는 “정확한 실시간 예측”이 아니라 “외부 API 없이도 일관된 쾌적 칸 추천”을 완성하는 단계다.

완료 조건:

1. 추천 엔진의 기본 provider가 `StaticCoolingProvider + EstimatedComfortProvider`다.
2. `UserFeedbackProvider`가 추천에 보정 signal로 연결된다.
3. `TmapCongestionProvider`는 optional 보강 provider로만 실행된다.
4. 외부 API/Supabase 실패에도 `/api/recommend`는 정상 응답한다.
5. 화면에는 내부 provider명/점수/오류/비용 관련 문구가 노출되지 않는다.
6. 자연어/음성 입력 또는 OpenAI 호출이 추천 critical path에 없다.

## 10. 권장 파일 구조

```txt
src/lib/recommendation.ts                         # 기존 public recommend() 유지 또는 re-export
src/lib/recommendation/engine.ts                  # 합성/점수/밴드 결정
src/lib/recommendation/collectSignals.ts          # provider 실행 정책
src/lib/recommendation/providers/staticCooling.ts
src/lib/recommendation/providers/estimatedComfort.ts
src/lib/recommendation/providers/userFeedback.ts
src/lib/recommendation/providers/tmapCongestion.ts
src/lib/recommendation/display.ts                 # 내부 reason code → 소비자 문구
```

점진 이전 전략:

1. 기존 `src/lib/providers.ts`는 바로 삭제하지 말고 새 provider 구조로 감싼다.
2. `recommend(request)`의 함수 signature는 유지해 `/api/recommend` 변경을 최소화한다.
3. `CarComfort` 기존 필드는 유지하고 선택 필드만 추가한다.
4. UI 변경은 `band/displayReasons`가 없으면 기존 로직으로 fallback하도록 만든다.

## 11. 한 줄 결론

시원칸 추천엔진은 TMAP 중심의 “데이터 조회기”가 아니라, `StaticCoolingProvider + EstimatedComfortProvider + UserFeedbackProvider`가 항상 작동하고 TMAP은 성공할 때만 혼잡도를 보강하는 “실패에 강한 쾌적도 합성 엔진”으로 재설계해야 한다.
