# 데이터/API 전략 v0.1

## 1. 원칙

데이터 소스는 Provider 인터페이스 뒤에 숨긴다. 프론트와 추천 엔진은 특정 API에 의존하지 않는다.

```text
Frontend → Recommendation API → Provider Interface → TMAP/Public/Estimated/UserFeedback
```

## 2. 현재 사용 데이터

| 데이터 | 소스 | 비용 | 용도 |
|---|---|---:|---|
| 칸별 혼잡도 | TMAP/SK Open API Free | 월 10회 수준으로 매우 제한적 | 운영 기본값은 live 호출 비활성, 캐시/추정 fallback |
| 실시간 도착정보 | 서울시 지하철 실시간 도착정보 | 무료 | 현재/다음 열차 정보 |
| 약냉방칸 | 공공데이터포털 | 무료 | 추위형/더위형 추천 보정 |
| 날씨 | 기상청 단기예보/초단기실황 | 무료 | 폭염/기온 가중치 |
| 역 좌표 | 서울교통공사 역사 좌표 | 무료 | 현재 위치→역 추천 |
| 수인분당선 보조 | 코레일 혼잡도/승하차 데이터 | 무료 | 추정 모드 |
| 사용자 피드백 | 자체 DB | 자체 | 개인화/커뮤니티 보정 |

## 3. 노선별 Provider 라우팅 v0

| 노선 | Provider | 신뢰도 |
|---|---|---|
| 1~9호선 | 캐시된 TmapCongestionProvider 또는 EstimatedCongestionProvider | HIGH/MEDIUM/LOW |
| 신분당선 | 캐시된 TmapCongestionProvider 또는 EstimatedCongestionProvider | HIGH/MEDIUM/LOW |
| 공항철도 | EstimatedCongestionProvider, 추후 선택 지원 | LOW/MEDIUM |
| 수인분당선 | EstimatedCongestionProvider + UserFeedbackProvider | LOW/MEDIUM |
| 수인선 | EstimatedCongestionProvider + UserFeedbackProvider | LOW/MEDIUM |

## 3.5 TMAP 권한/응답 진단 원칙

TMAP 실패를 “키 문제”로 단정하지 않는다. `403 INVALID_API_KEY`도 다음 가능성을 분리해 본다.

1. env의 appKey 값/공백/잘림 문제
2. 현재 appKey가 속한 앱과 상품을 신청한 앱이 다름
3. 해당 앱의 상품관리에서 `TMAP 대중교통` 또는 `/transit/puzzle/...` API 권한이 미신청/미승인/비활성
4. `지하철 혼잡도` 상품과 `TMAP 대중교통` 상품/API endpoint 혼동
5. 멤버관리/로그인 계정이 실제 앱 관리자·멤버가 아니어서 상태 확인 불가
6. IP whitelist, quota, endpoint/method, 파라미터, 응답 schema 문제

서버 진단은 `npm run diagnose:tmap` 또는 `POST /api/admin/tmap/diagnostics`로 수행하고, 결과는 `provider_diagnostic_events`에 appKey 원문 없이 저장한다.

## 3.6 무료 quota 보호 정책

TMAP/SK 무료 API 사용량이 월 10회 수준으로 확인되어, 제품 기본값은 `TMAP_LIVE_ENABLED=false` / `TMAP_CACHE_ONLY=true`이다.

- 추천 요청은 캐시를 먼저 확인한다.
- 캐시가 없으면 외부 API를 새로 호출하지 않고 추정/통계 fallback으로 안내한다.
- 운영자가 정말 필요한 진단을 할 때만 `TMAP_LIVE_ENABLED=true`와 `--force=true`로 강제 호출한다.
- 429 `QUOTA_EXCEEDED`는 코드 실패가 아니라 운영 제약으로 보고, 국가/서울교통공사 API 공개 전까지 Provider 구조만 유지한다.

## 4. 미래 전환 전략

서울교통공사/국가 공공 API로 칸별 실시간 혼잡도가 공개되면 다음만 바꾼다.

```text
TmapCongestionProvider → SeoulMetroPublicCongestionProvider
EstimatedCongestionProvider 일부 → KorailPublicCongestionProvider
```

추천 API 응답 포맷은 유지한다.

## 5. 비용 절감 전략

### 외부 API
- 모든 Provider는 서버에서만 호출한다.
- API Key는 클라이언트에 노출하지 않는다.
- 캐시 키 예시:

```text
congestion:{provider}:{line}:{station}:{dow}:{hh}
arrival:{station}:{line}
weather:{gridX}:{gridY}:{baseTime}
```

### TTL
- TMAP 통계성 칸별 혼잡도: 1~7일
- 서울 실시간 도착정보: 15~30초
- 날씨: 10~30분
- 약냉방칸: 정적
- 역 좌표: 정적

### Request Coalescing
동일 캐시 키에 대한 동시 요청은 외부 API 1회만 호출한다.

## 6. AI 비용 절감 전략

AI는 실시간 추천 경로에 넣지 않는다.

```text
추천 요청 → 캐시/DB → 규칙 기반 점수 계산 → 템플릿 이유 → 응답
```

AI 사용 위치:
- 피드백 10개 이상 누적 시 사용자 성향 요약
- 일 1회 운영 리포트
- 문구 개선/마케팅 카피

초기 v0.1은 AI 없이 출시한다.

## 7. 법적/운영 리스크

- TMAP 샘플 프록시를 제품에서 무단 사용하지 않는다.
- 공식 appKey/약관 기반으로 호출한다.
- 수인분당선은 실측처럼 표시하지 않는다.
- 공공누리 3/4유형 데이터는 상업 활용 전 별도 확인한다.
- 데이터 출처/신뢰도 배지를 UI에 표시한다.
