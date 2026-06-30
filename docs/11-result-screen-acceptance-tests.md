# Result 화면 개선 수용 테스트

## 범위와 원칙

- 대상: 홈(`/`) → 결과(`/result`) 추천 플로우, 결과 화면 UI/상태, API 저장/피드백, 로컬/배포 smoke
- 검증 환경:
  - 로컬: `http://127.0.0.1:3000`
  - 배포: `https://coolcar-sigma.vercel.app/`
- 필수 회귀 방지: 결과 화면에서 **추천 칸 표시**와 **칸 위치 지도(`train-map`/칸별 car map)**가 사라지면 출시 차단이다.
- 권장 뷰포트: 모바일 390×844 우선, 데스크톱 1440×900 보조
- 공통 데이터 초기화: 브라우저 테스트 전 `localStorage`/`sessionStorage`를 비우고 시작하거나, 테스트별로 새 시크릿 창을 사용한다.

## 출시 승인 최소 기준

1. 홈에서 기본 입력으로 추천 실행 시 `/result?loading=1`을 거쳐 `/result`에 도달한다.
2. 결과 화면에 추천 칸 라벨, 칸 위치 지도, 추천 사유, 구간별 위치 안내, 피드백, 저장 CTA가 모두 보인다.
3. 접힘/상세 영역은 기본 상태와 펼침 상태 모두 접근 가능하고, 펼침/접힘 후 주요 결과가 사라지지 않는다.
4. 피드백과 저장 요청은 성공/목업/오류 상태를 사용자에게 명확히 표시한다.
5. 브라우저 콘솔에 기능을 깨는 error, hydration mismatch, undefined/null 노출 관련 오류가 없다.
6. `/api/recommend`, `/api/feedback`, `/api/routes/saved`, `/api/stations/search` smoke가 로컬과 배포에서 2xx 또는 의도된 4xx로 응답한다.
7. `npm run build` 및 관련 smoke 스크립트가 로컬에서 통과한다.

## 수용 테스트 매트릭스

| ID | 영역 | 환경 | 절차 | 기대 결과 | 출시 차단 기준 |
|---|---|---|---|---|---|
| RES-001 | 홈→결과 route | 로컬/배포 | `/` 접속 → 기본값(강남역→홍대입구역, 2호선) 유지 → `지금 탈 칸 보기` 클릭 | 버튼 로딩 문구 표시 후 `/result?loading=1` 진입, 추천 API 완료 후 주소가 `/result`로 정리된다. 결과 카드가 표시된다. | route가 멈춤, 빈 결과, JS crash, `/result?loading=1`에 계속 머무름 |
| RES-002 | 결과 없음 상태 | 로컬/배포 | 새 세션에서 `/result` 직접 접속 | “아직 추천 결과가 없어요”와 `추천받으러 가기` 링크 표시. 링크 클릭 시 홈 이동 | undefined/null 표시, 빈 화면, 홈 복귀 불가 |
| RES-003 | 결과 핵심 정보 | 로컬/배포 | RES-001 결과 화면 확인 | `추천 결과` 헤더, 추천 칸 라벨(`n번째 칸`), 출발→도착, 추천 근거 microcopy가 보인다. | 추천 칸 라벨이 사라짐 |
| RES-004 | 칸 위치 지도 회귀 | 로컬/배포 | 결과 카드의 칸 지도 확인 | `칸 위치 보기` 섹션과 1개 이상의 칸 카드가 표시된다. 추천 칸에는 `추천`/`여기` 또는 동등한 강조가 있다. | `train-map`, `cars`, 추천 칸 강조가 제거됨 |
| RES-005 | 환승/하차 가까운 범위 | 로컬/배포 | 홈 최근 경로 `강남 → 판교` 불러오기 또는 2호선 역삼역→판교역/신분당선, 환승역 강남역 조건으로 추천 | 결과 배지에 환승/하차 근접 맥락이 나타나고, 후보 칸 범위 또는 환승 note가 표시된다. | 후보/기준 칸이 잘못 숨겨지거나 “가짜” 문번호가 표시됨 |
| RES-006 | 접힘 상세 기본 상태 | 로컬/배포 | 결과 화면 진입 직후 상세/조건/이유 영역의 기본 상태 확인 | 개선된 접힘 상세가 있다면 기본 상태에서 핵심 추천 칸·칸 지도·CTA는 보이고, 상세 영역은 명확한 제목/버튼/`aria-expanded` 상태를 가진다. | 접힘 상태에서 핵심 추천 칸 또는 지도까지 숨김 |
| RES-007 | 접힘 상세 펼침/접힘 | 로컬/배포 | 상세 토글 클릭 → 내용 확인 → 다시 접기 | 펼침 시 추천 이유, 점수/근거, 피하면 좋은 위치 등 상세가 보이고 focus/스크롤이 튀지 않는다. 다시 접어도 결과 카드, 저장/피드백 동작 유지 | 토글 불가, 상태 불일치, 주요 UI 사라짐, 콘솔 오류 |
| RES-008 | 구간별 안내 | 로컬/배포 | 결과 화면 `구간별 위치 안내` 확인 | summary, 1개 이상의 구간 카드, `n구간`, `출발→도착`, 노선/방면, 추천 위치 또는 방향/경로/참고 상태, disclaimer가 표시된다. | 구간 카드 없음, undefined/null, 잘못된 문번호 노출 |
| RES-009 | 방향 정보 제한 | 로컬/배포 | 방향 미입력 또는 방향 확인 필요 케이스로 추천 | 구간별 안내에서 `방향 확인 필요`/`참고 위치` 등 안전한 문구를 표시하고 임의 문번호를 만들지 않는다. | 방향 없는데 확정 문번호를 노출 |
| RES-010 | 피드백 성공/목업 | 로컬/배포 | 결과 화면에서 `좋았어요` 클릭, 다른 세션에서 `더웠어요` 등 1개 클릭 | 버튼 pending 중 중복 클릭 방지. 응답 후 `다음 추천에 반영했어요` 또는 `피드백을 받았어요` 표시 | 피드백 클릭이 무반응, 5xx 후 안내 없음, 중복 요청 폭주 |
| RES-011 | 피드백 오류 표시 | 로컬 | DevTools/network 차단 또는 API 500 mock 상태에서 피드백 클릭 | `잠시 후 다시 시도해 주세요.`가 표시되고 화면은 유지된다. | 오류 시 crash/무한 pending |
| RES-012 | 저장 성공/목업 | 로컬/배포 | 결과 화면에서 `루틴 저장하기` 클릭 | pending 후 `저장 완료` 비활성 또는 `저장했어요`/`퇴근 루틴에 저장했어요` 표시. `/saved` 이동 시 저장 목록 또는 목업 empty 상태가 깨지지 않는다. | 저장 버튼 무반응, 중복 저장 폭주, 401/500 안내 없음 |
| RES-013 | 저장 오류 표시 | 로컬 | anonymousId 제거 또는 API 오류 mock 후 저장 클릭 | `잠시 후 다시 시도해 주세요.` 표시, 결과 화면 유지 | crash/무한 pending |
| RES-014 | 다시 추천/backHref | 로컬/배포 | 결과 화면 `다시 고르기` 또는 `다시 추천` 클릭 | 홈으로 이동하며 line/origin/destination/destinationLine/comfortType/direction/transferStations 쿼리가 복원된다. | 입력 복원 실패로 사용자가 처음부터 다시 입력해야 함 |
| RES-015 | 콘솔 품질 | 로컬/배포 | 전체 플로우 중 DevTools Console 관찰 | uncaught error, hydration mismatch, React key warning, `Cannot read properties of undefined`, 민감정보 로그가 없다. | 기능 오류 콘솔 또는 secret/API key 노출 |
| RES-016 | 배포 API smoke | 배포 | 아래 API smoke 명령 실행 | 추천/피드백/저장/역검색 응답이 정상 schema를 가진다. Supabase 미설정 시 persisted false 목업 응답 허용 | 5xx, schema mismatch, CORS/HTML 응답 |
| RES-017 | 로컬 빌드 smoke | 로컬 | 아래 빌드/타입/API smoke 명령 실행 | build와 smoke 스크립트가 통과한다. | build 실패, smoke 실패 |

## 브라우저 상세 절차

### A. 기본 직행 플로우

1. 로컬 또는 배포 URL `/` 접속
2. 기본 출발/도착값을 그대로 두고 `지금 탈 칸 보기` 클릭
3. 로딩 화면에서 다음 문구 확인
   - `추천 계산 중`
   - `지금 타기 좋은 칸을 고르고 있어요`
   - `출발·도착 확인`, `칸별 쾌적도 비교`, `동선까지 확인`
4. 결과 화면에서 다음 selector/문구 확인
   - `.result-page`
   - `.hero-result h1` 추천 칸 라벨
   - `.train-map` 및 `.result-cars .car.best`
   - `.result-why-card`
   - `.route-guidance-card`
   - `.feedback`
   - `루틴 저장하기`

### B. 접힘 상세

- 개선된 상세가 `<details>` 또는 button 토글이라면 다음을 확인한다.
  - 닫힘 상태: 토글 명칭이 명확하고 핵심 추천 칸/칸 지도는 계속 보인다.
  - 펼침 상태: 상세 이유/점수/데이터 한계/피해야 할 칸이 읽힌다.
  - 접근성: button이면 `aria-expanded`가 true/false로 바뀌고, `<details>`면 `open` 상태가 DOM에 반영된다.
  - 키보드: Tab으로 토글에 접근 가능하고 Enter/Space로 동작한다.

### C. 구간별 안내

- 직접 경로: `강남역 → 홍대입구역` 같은 기본 추천에서 1개 이상 구간이 보인다.
- 환승 경로: 최근 경로 `강남 → 판교` 불러오기 후 구간별 안내가 2개 이상 또는 환승 맥락을 가진 안내로 표시된다.
- 데이터 부족/방향 필요: 확정되지 않은 문번호를 임의로 노출하지 않고 `방향 확인 필요`, `경로 확인 필요`, `참고 위치` 중 안전한 상태를 표시한다.

### D. 피드백/저장

- 피드백 버튼 6개 모두 렌더링되는지 확인한다.
  - `더웠어요`, `추웠어요`, `붐볐어요`, `환승이 멀었어요`, `좋았어요`, `위치가 달랐어요`
- 피드백 클릭 후 pending 문구 또는 버튼 disabled가 보이고, 완료 문구가 표시된다.
- 저장 클릭 후 pending → 완료/목업 문구가 표시되고, 저장 완료 상태에서는 중복 클릭이 막힌다.

### E. 콘솔/네트워크

- Console 필터: Errors, Warnings 확인
- Network 필터:
  - `/api/recommend` POST 200, JSON body
  - `/api/feedback` POST 200 또는 의도된 400/500 테스트 시 UI 오류 표시
  - `/api/routes/saved` POST 200/401/500에 따른 UI 표시
  - `/api/stations/search` GET 200
- 금지: API key, Supabase service role key, 전체 개인정보 payload가 console/source/network에 노출

## 로컬 smoke 명령

```bash
cd /root/projects/coolcar
npm run build
npm run typecheck
npm run test:api
npm run test:door-guidance
npm run test:anchor-window
npm run test:persona-scenarios
npm run test:no-fake-anchor
npm run test:public-door-guide
```

로컬 API smoke는 서버를 먼저 띄운 뒤 실행한다.

```bash
cd /root/projects/coolcar
npm run dev
# 다른 터미널
SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:api
```

## 배포 API smoke 명령

```bash
cd /root/projects/coolcar
SMOKE_BASE_URL=https://coolcar-sigma.vercel.app npm run test:api
```

수동 curl 보조 검증:

```bash
curl -sS -X POST https://coolcar-sigma.vercel.app/api/recommend \
  -H 'content-type: application/json' \
  -d '{"anonymousId":"qa-result-acceptance","line":"2호선","originStation":"강남역","destinationStation":"홍대입구역","direction":"내선","comfortType":"HOT_SENSITIVE","waitToleranceMin":3,"avoidPrioritySeatArea":true}'

curl -sS 'https://coolcar-sigma.vercel.app/api/stations/search?q=%EA%B0%95%EB%82%A8&limit=5'
```

## 출시 차단 조건

1. 홈에서 결과 route까지 도달하지 못하거나 loading 상태가 끝나지 않는다.
2. 추천 칸 라벨 또는 칸 위치 지도가 결과 화면에서 제거된다.
3. 접힘 상세 조작으로 핵심 결과/저장/피드백이 사라지거나 콘솔 오류가 발생한다.
4. 구간별 안내가 undefined/null/빈 카드로 보인다.
5. 방향/경로 데이터가 부족한데 확정 문번호를 만들어 보여준다.
6. 피드백 또는 저장이 실패했는데 사용자에게 오류 안내가 없다.
7. 로컬 build 또는 핵심 smoke가 실패한다.
8. 배포 smoke에서 5xx, HTML 응답, schema mismatch가 발생한다.
9. 브라우저 console/network/source에 secret 또는 민감정보가 노출된다.

## 현재 코드 기준 사전 확인 메모

- `/src/app/result/page.tsx`에는 결과 카드, `.train-map`, `.result-cars`, 구간별 안내, 피드백, 저장 CTA가 존재한다.
- `/src/app/page.tsx`는 홈에서 `coolcar_pending_recommendation`을 sessionStorage에 저장하고 `/result?loading=1`로 이동한다.
- `/src/app/result/page.tsx`는 추천 성공 후 `coolcar_last_result` 저장, pending 제거, `window.history.replaceState(null, '', '/result')`를 수행한다.
- 실제 브라우저/빌드 실행 결과는 위 절차와 명령으로 로컬 및 배포에서 별도 기록해야 한다.
