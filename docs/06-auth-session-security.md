# Auth linkage verification

## 목적

Google/Kakao 로그인 성공 후 다음을 제품 API 기준으로 검증한다.

1. `/api/auth/me`가 로그인 사용자 프로필을 반환한다.
2. 익명 추천/저장/피드백 데이터가 `user_id`에 연결된다.
3. 저장 경로의 기본 루틴 충돌이 없다.
4. 피드백이 다른 사용자의 추천 이벤트에 연결되지 않는다.
5. 선호도 병합이 반복 호출로 중복 가산되지 않는다.

## 구현

### 진단 API

```txt
GET /api/auth/linkage-diagnostics?anonymousId=<uuid>
```

조건:

- 로그인 세션 필요
- service role은 서버에서만 사용
- access token/refresh token/provider token/cookie 원문은 절대 반환하지 않음
- user id와 anonymous id는 일부 redaction해서 반환

### smoke script

```bash
SMOKE_BASE_URL=https://coolcar-sigma.vercel.app \
SMOKE_ANON_ID=<브라우저 localStorage coolcar_anonymous_id> \
SMOKE_COOKIE='<브라우저 세션 cookie, 원문 공유 금지>' \
npm run test:auth-linkage
```

실제 Google/Kakao 로그인은 사용자 브라우저에서 수행해야 한다. 이 스크립트는 로그인 세션 cookie가 주어졌을 때 linkage 상태만 검증한다.

## 수동 확인 순서

1. 비로그인 상태로 홈에서 추천을 실행한다.
2. 추천 결과에서 경로 저장, 피드백 제출을 수행한다.
3. 브라우저 콘솔에서 anonymous id를 확인한다.

```js
localStorage.getItem('coolcar_anonymous_id')
```

4. `/login?next=/saved`에서 Google 또는 Kakao로 로그인한다.
5. `/saved` 상단 프로필 pill과 루틴 목록을 확인한다.
6. `/api/auth/linkage-diagnostics?anonymousId=<uuid>`에 접속한다.

성공 기준:

```txt
saved_routes.byAnonymousUnclaimed = 0
recommendation_events.byAnonymousUnclaimed = 0
feedback_events.byAnonymousUnclaimed = 0
saved_routes.defaultCountForUser <= 1
feedbackRecommendationOwnerMismatch = false
```
