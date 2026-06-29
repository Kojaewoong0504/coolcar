# 소셜 로그인 운영 설정 체크리스트

배포 URL: `https://coolcar-sigma.vercel.app`
Supabase OAuth callback URL: `https://ttnstlwcnlhscybmijjw.supabase.co/auth/v1/callback`
앱 callback URL: `https://coolcar-sigma.vercel.app/auth/callback`

## 1. Supabase 공통 설정

Supabase Dashboard → Authentication → URL Configuration

- Site URL: `https://coolcar-sigma.vercel.app`
- Redirect URLs:
  - `https://coolcar-sigma.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3018/auth/callback` 로컬 smoke가 필요할 때만 선택

## 2. Google 로그인

Google Cloud Console → APIs & Services → Credentials → OAuth Client ID

- Application type: Web application
- Authorized JavaScript origins:
  - `https://coolcar-sigma.vercel.app`
  - `http://localhost:3000`
- Authorized redirect URIs:
  - `https://ttnstlwcnlhscybmijjw.supabase.co/auth/v1/callback`

생성 후 Supabase Dashboard → Authentication → Providers → Google

- Enable Google provider
- Client ID 입력
- Client Secret 입력
- Save

## 3. Kakao 로그인

Kakao Developers → 내 애플리케이션 → 플랫폼 → Web

- Site domain:
  - `https://coolcar-sigma.vercel.app`
  - `http://localhost:3000` 로컬 테스트가 필요할 때만 선택

Kakao Developers → 제품 설정 → 카카오 로그인

- 카카오 로그인 활성화: ON
- Redirect URI:
  - `https://ttnstlwcnlhscybmijjw.supabase.co/auth/v1/callback`

Kakao Developers → 앱 키

- REST API 키를 Supabase Kakao provider의 Client ID로 사용
- Client Secret은 Kakao에서 활성화한 경우에만 Supabase에 입력

Supabase Dashboard → Authentication → Providers → Kakao

- Enable Kakao provider
- REST API Key 입력
- Client Secret, 활성화한 경우 입력
- Save

## 4. Apple 로그인, 후순위

Apple은 웹 MVP 단계에서는 후순위다. iOS 앱/앱스토어 계획이 확정되면 Apple Developer에서 Services ID, Team ID, Key ID, private key, domain verification을 설정한다.

## 5. 검증 방법

1. `https://coolcar-sigma.vercel.app/login` 접속
2. Google 또는 Kakao 버튼 클릭
3. provider 동의 화면으로 이동하는지 확인
4. 로그인 완료 후 `/auth/callback` → `/settings`로 돌아오는지 확인
5. `/settings`에서 로그인 사용자 표시 및 익명 기록 연결 문구 확인
6. Supabase 테이블에서 `saved_routes`, `recommendation_events`, `feedback_events`의 `user_id` 연결 여부 확인

## 현재 확인된 상태

- 앱의 OAuth 시작 endpoint `/api/auth/oauth-start`는 정상 응답한다.
- Supabase는 현재 provider가 꺼져 있으면 `Unsupported provider: provider is not enabled`를 반환한다.
- 따라서 다음 blocker는 코드가 아니라 Supabase/Google/Kakao 콘솔 provider 활성화다.
