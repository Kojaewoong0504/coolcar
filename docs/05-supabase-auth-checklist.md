# Supabase 소셜 로그인 설정 체크리스트

## 1. 기본 설정

Supabase Project → Authentication → URL Configuration

- Site URL
  - Local: `http://localhost:3000`
  - Production: `https://<vercel-domain>`
- Redirect URLs
  - `http://localhost:3000/auth/callback`
  - `https://<vercel-domain>/auth/callback`
  - Toss 환경 도메인이 생기면 추가

## 2. Google OAuth

1. Google Cloud Console에서 OAuth Client 생성
2. Authorized redirect URI 추가:
   - `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
3. Supabase Auth Provider에 Client ID/Secret 입력

## 3. Kakao OAuth

1. Kakao Developers 앱 생성
2. 플랫폼 Web 등록
3. Redirect URI 추가:
   - `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
4. Kakao Login 활성화
5. REST API Key/Client Secret을 Supabase Provider에 입력

## 4. Apple OAuth

1. Apple Developer Program 필요
2. Services ID 생성
3. Return URL:
   - `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
4. Key ID, Team ID, Services ID, Private Key 설정

## 5. 로그인 UX 원칙

- 첫 추천은 로그인 없이 가능
- 저장 경로/개인화/여러 기기 동기화 시 로그인 유도
- 익명 데이터는 로그인 후 user_id로 병합

## 6. 보안

- Service Role Key는 서버 환경변수에만 저장
- TMAP/서울/기상청 API Key도 서버에서만 호출
- 클라이언트에는 anon key만 노출
