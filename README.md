# 시원칸 CoolCar

> **노선도 말고, 어디 탈지만 알려줘.**

시원칸은 여름철 지하철에서 “어느 칸에 타야 더 시원하고 덜 붐빌지”를 빠르게 추천하는 모바일 우선 웹앱입니다. 더위를 많이 타는 사람에게는 상대적으로 시원하고 덜 붐비는 칸을, 추위를 많이 타는 사람에게는 약냉방/덜 추운 칸을 안내합니다.

## 현재 상태

- Next.js App Router + TypeScript 기반 v2 MVP
- Supabase Auth/Postgres 연동 구조
- 익명 사용자 우선 UX: 로그인 없이 추천/피드백/저장 가능
- Kakao/Google/Apple 소셜 로그인 진입점 구현
- 익명 데이터 → 로그인 사용자 병합 API 구현
- TMAP/SK 지하철 혼잡도 Provider 구조 구현
- 월 10회 무료 API quota 보호를 위해 **TMAP live 호출은 기본 비활성화**
- 캐시/추정 기반 fallback으로 제품 흐름 유지

## 주요 화면

| 경로 | 설명 |
|---|---|
| `/` | 홈, 추천 입력, 결과 카드, 칸별 스트립, 피드백/저장 CTA |
| `/saved` | 저장한 경로 목록 |
| `/settings` | 로그인, 성향, 데이터 신뢰도 원칙 |
| `/login` | Kakao/Google/Apple OAuth 진입점 |
| `/data-source` | 데이터 출처와 신뢰도 기준 |
| `/privacy` | 개인정보 처리 원칙 |

## API

| 경로 | 설명 |
|---|---|
| `POST /api/recommend` | 추천 생성, 추천 이벤트 저장 |
| `POST /api/feedback` | 피드백 저장, 선호 통계 업데이트 |
| `GET /api/routes/saved` | 저장 경로 조회 |
| `POST /api/routes/saved` | 경로 저장 |
| `GET /api/stations/search` | 역 검색 |
| `POST /api/auth/merge-anonymous` | 로그인 후 익명 데이터 병합 |
| `POST /api/admin/tmap/diagnostics` | 운영자용 TMAP 진단 |

## 데이터/캐싱 정책

### 현재 운영 모드

TMAP/SK Open API 무료 사용량이 월 10회 수준이라, 현재는 외부 API를 실시간 추천 경로에서 계속 호출하지 않습니다.

```txt
TMAP_LIVE_ENABLED=false
TMAP_CACHE_ONLY=true
```

동작 순서:

1. 기존 캐시가 있으면 캐시 사용
2. 캐시가 없거나 만료되면 TMAP live 호출 대신 추정/통계 fallback 사용
3. 국가/공공 칸별 혼잡도 API가 공개되면 Provider만 교체 또는 추가

### 캐시 키

```txt
tmap:congestion:stat-car:v2:{stationCode}:{dow}:{hh}
```

### 기본 TTL

```txt
21600초 = 6시간
```

### 캐시 계층

1. 프로세스 메모리 캐시
2. Upstash Redis, 환경변수가 있을 때
3. Supabase `provider_cache_entries`

## 실행

```bash
npm install
npm run typecheck
npm run build
PORT=3010 npm run start
SMOKE_BASE_URL=http://127.0.0.1:3010 npm run test:api
```

## TMAP 진단

기본 진단은 캐시를 먼저 확인하고, `TMAP_LIVE_ENABLED=false`이면 외부 API를 새로 호출하지 않습니다.

```bash
npm run diagnose:tmap -- --line=2호선 --station=강남
```

정말 필요한 운영 진단 때만 강제 호출합니다. 무료 quota가 매우 작으므로 주의하세요.

```bash
TMAP_LIVE_ENABLED=true npm run diagnose:tmap -- --line=2호선 --station=강남 --force=true
```

TMAP 실패는 “키 교체”로 단정하지 않습니다. endpoint, 상품 권한, 앱 활성화, IP whitelist, quota, 파라미터, 응답 schema를 분리 진단합니다.

## 소셜 로그인 설정

앱 코드는 Supabase Auth 기반 Kakao/Google/Apple OAuth를 지원합니다. 로그인 시작은 서버 route(`/api/auth/oauth-start`)에서 처리하므로 Vercel에는 `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`가 있으면 동작합니다. 실제 OAuth provider 사용은 Supabase 대시보드 provider 설정과 redirect URL 등록이 필요합니다.

개발 redirect URL:

```txt
http://localhost:3000/auth/callback
```

배포 redirect URL:

```txt
https://<production-domain>/auth/callback
```

필요 provider:

- Kakao
- Google
- Apple

## 환경변수

`.env.example`을 복사해 `.env`를 만듭니다. 실제 비밀값은 Git에 올리지 않습니다.

```bash
cp .env.example .env
```

중요:

- `.env`는 `.gitignore`에 포함되어 있습니다.
- Supabase service role/secret key는 서버에서만 사용합니다.
- TMAP appKey는 브라우저로 노출하지 않습니다.

## Supabase

스키마 파일:

```txt
supabase/schema.sql
```

주요 테이블:

- `recommendation_events`
- `feedback_events`
- `saved_routes`
- `anonymous_preference_stats`
- `user_preference_stats`
- `provider_cache_entries`
- `provider_diagnostic_events`

## Vercel 배포 메모

Vercel에는 다음 환경변수를 등록해야 합니다.

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `TMAP_LIVE_ENABLED=false`
- `TMAP_CACHE_ONLY=true`
- 선택: `UPSTASH_REDIS_REST_URL`
- 선택: `UPSTASH_REDIS_REST_TOKEN`

TMAP live 호출을 Vercel serverless에서 직접 켜는 것은 권장하지 않습니다. 무료 quota가 작고 outbound IP 고정 이슈가 있으므로, 추후 고정 IP VPS proxy나 공공 API 공개 후 Provider 전환을 권장합니다.

## 프로젝트 문서

- `docs/00-product-spec.md` — 제품 스펙
- `docs/01-architecture.md` — 시스템 아키텍처
- `docs/02-api-contracts.md` — API 계약
- `docs/03-implementation-plan.md` — 구현 로드맵
- `docs/04-data-strategy.md` — 데이터/API 전략
- `docs/05-supabase-auth-checklist.md` — Supabase Auth 설정 체크리스트
