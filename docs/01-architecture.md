# 시스템 아키텍처 v0.1

## 1. 기술 스택

| 레이어 | 선택 |
|---|---|
| Frontend | Next.js App Router + React + TypeScript |
| Styling | Tailwind CSS |
| Auth | Supabase Auth |
| DB | Supabase Postgres |
| Cache | Upstash Redis |
| Deployment | Vercel |
| Future In-App | Toss Apps in Toss |
| AI | v0.1 미사용, v0.3부터 배치 요약 |

## 2. 전체 구조

```text
Client Web / Apps in Toss
  ↓
Next.js App
  ↓
/api/recommend, /api/feedback, /api/routes
  ↓
Recommendation Engine
  ↓
Provider Router
  ├─ TmapCongestionProvider
  ├─ EstimatedCongestionProvider
  ├─ UserFeedbackProvider
  ├─ SeoulArrivalProvider
  ├─ WeatherProvider
  └─ CoolingCarProvider
  ↓
Supabase Postgres / Upstash Redis
```

## 3. 패키지 구조 제안

```text
src/
  app/
    page.tsx
    recommend/page.tsx
    routes/page.tsx
    settings/page.tsx
    api/
      recommend/route.ts
      feedback/route.ts
      routes/route.ts
  components/
    ComfortTypeSelector.tsx
    StationInput.tsx
    RecommendationCard.tsx
    CarStrip.tsx
    SourceBadge.tsx
    FeedbackSheet.tsx
  lib/
    supabase/
      client.ts
      server.ts
    cache/
      redis.ts
    recommendation/
      engine.ts
      scoring.ts
      reasons.ts
      types.ts
    providers/
      congestion-provider.ts
      tmap-congestion-provider.ts
      estimated-congestion-provider.ts
      user-feedback-provider.ts
      seoul-arrival-provider.ts
      weather-provider.ts
      cooling-car-provider.ts
      provider-router.ts
    data/
      weak-ac-cars.ts
      line-config.ts
      station-aliases.ts
  styles/
    globals.css
supabase/
  schema.sql
  seed.sql
```

## 4. Provider 인터페이스

```ts
export interface CongestionProvider {
  id: string;
  supports(input: RouteContext): boolean;
  getCarCongestion(input: RouteContext): Promise<NormalizedCongestionResult>;
}
```

## 5. 정규화 타입

```ts
export type SourceType = 'REALTIME_CAR' | 'STATISTICAL_CAR' | 'AVERAGE_STATION' | 'ESTIMATED' | 'USER_FEEDBACK';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type RouteContext = {
  line: string;
  originStation: string;
  destinationStation?: string;
  direction?: string;
  targetTime: string;
  dayOfWeek: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
};

export type CarCongestion = {
  carNo: number;
  congestionPercent: number | null;
  source: SourceType;
};

export type SourceMeta = {
  provider: string;
  sourceType: SourceType;
  confidence: Confidence;
  retrievedAt: string;
  cacheHit?: boolean;
  licenseNote?: string;
};

export type NormalizedCongestionResult = {
  cars: CarCongestion[];
  sourceMeta: SourceMeta;
};
```

## 6. 추천 엔진 흐름

```text
1. 입력 검증
2. 사용자 성향/누적 통계 조회
3. Provider 선택
4. 외부 API/캐시/추정 데이터 조회
5. 칸별 cooling/crowding/preference/transfer 점수 계산
6. 추천 칸, 대안, 회피 칸 선정
7. 이유 템플릿 생성
8. recommendation_events 저장
9. 응답 반환
```

## 7. Toss Apps in Toss 대비

초기에는 일반 웹 환경을 기준으로 구현하되 아래 추상화를 둔다.

```ts
interface RuntimeAdapter {
  getLocation(): Promise<GeoLocation | null>;
  getUserHint(): Promise<RuntimeUserHint | null>;
  share(payload: SharePayload): Promise<void>;
  storage: RuntimeStorage;
}
```

구현체:
- `WebRuntimeAdapter`
- `TossRuntimeAdapter`

이렇게 하면 Apps in Toss SDK를 나중에 연결해도 UI/추천 로직을 유지할 수 있다.
