# 구현 로드맵 v0.1

## 목표

Vercel에 배포 가능한 Next.js 웹앱 MVP를 만들고, 나중에 Toss Apps in Toss로 포팅 가능한 구조를 갖춘다.

## Milestone 0 — 프로젝트 세팅

### 작업
- Next.js + TypeScript + Tailwind 프로젝트 생성
- Supabase 프로젝트 생성
- Supabase Auth Provider 설정: Google/Kakao/Apple 우선
- Upstash Redis 생성
- Vercel 프로젝트 연결
- 환경변수 등록

### 완료 기준
- `/` 페이지가 Vercel Preview에 배포됨
- Supabase Auth 로그인/로그아웃 동작
- Redis ping 동작

## Milestone 1 — 데이터 기반 MVP

### 작업
- 역/노선 정적 데이터 구조화
- 약냉방칸 정적 데이터 입력
- Provider 인터페이스 구현
- TmapCongestionProvider 구현
- EstimatedCongestionProvider 구현
- Provider Router 구현
- Recommendation Engine v0 구현

### 완료 기준
- 2호선 강남역 추천 API 응답 생성
- 9호선 여의도역 추천 API 응답 생성
- 신분당선 강남역 추천 API 응답 생성
- 수인분당선 선릉역은 추정 모드로 응답
- 외부 API 실패 시 fallback 동작

## Milestone 2 — UI MVP

### 작업
- 홈 화면
- 성향 선택
- 출발/도착 입력
- 추천 결과 화면
- 칸별 스트립 UI
- 데이터 출처 배지
- 피드백 시트
- 저장 경로 화면

### 완료 기준
- 모바일 화면에서 추천 플로우 완료
- 피드백 저장 완료
- 로그인 사용자는 자주 타는 경로 저장 가능
- 비로그인 사용자는 익명 ID 기반으로 추천 가능

## Milestone 3 — 개인화 v0

### 작업
- feedback_events 저장
- user_preference_stats 즉시 업데이트
- 피드백 기반 가중치 조정
- 최근 피드백 기반 추천 보정

### 완료 기준
- “더웠어요” 피드백 누적 시 coolingWeight 증가
- “붐볐어요” 피드백 누적 시 crowdWeight 증가
- 사용자별 추천 결과가 다르게 나옴

## Milestone 4 — 배포/운영 준비

### 작업
- Vercel Production 배포
- 개인정보 처리방침 초안
- 데이터 출처 페이지
- API 호출량 로깅
- Redis cache hit ratio 로깅
- 오류/속도 모니터링

### 완료 기준
- 외부 테스트 사용자 20명 이상 피드백 수집 가능
- API 한도 초과 시 서비스 중단 없이 fallback

## Milestone 5 — Apps in Toss 준비

### 작업
- RuntimeAdapter 추상화
- Toss SDK location/storage/share 연동 검토
- Toss 화면 규격 대응
- Toss 심사/정책 체크리스트 작성

### 완료 기준
- 웹앱 코드 유지하면서 Toss RuntimeAdapter만 교체 가능

## 우선순위 원칙

1. 실시간 추천 경로에는 AI를 넣지 않는다.
2. TMAP/SK API 키는 서버에만 둔다.
3. 모든 추천 응답에는 sourceMeta를 포함한다.
4. 수인분당선/수인선은 실측처럼 말하지 않는다.
5. 공공 API가 열리면 Provider만 교체한다.

## 첫 구현 스프린트 제안

### Sprint 1: 3~5일
- Next.js 프로젝트 생성
- Supabase Auth 연결
- 기본 UI 3화면 구현
- Provider 인터페이스 + Mock Provider
- Recommendation Engine v0

### Sprint 2: 3~5일
- TMAP Provider 연결
- Redis 캐시
- Supabase schema 적용
- 피드백 저장
- 수인분당선 추정 Provider

### Sprint 3: 3~5일
- 개인화 가중치
- Vercel 배포
- 데이터 출처/개인정보 페이지
- 테스트 사용자 피드백 수집
