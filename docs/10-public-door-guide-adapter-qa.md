# PublicDoorGuideAdapter QA 테스트 케이스 / 출시 차단 조건

## 범위

P2에서 서울 열린데이터광장 `getFstExit` Open API 기반 `PublicDoorGuideAdapter`를 추가할 때, 빠른하차 문번호 안내가 **정확하지 않으면 노출하지 않는 것**을 최우선 출시 기준으로 둔다.

- 대상: 문 위치 추천/표시 경로, `smoke-door-guidance`, 추천 결과 API, 배포 환경, 브라우저 결과 화면
- 원칙: API key가 없거나 API가 실패하면 정적 fixture로 fallback한다.
- 출시 차단 핵심: 잘못된 칸/문 번호를 사용자에게 보여주면 안 된다.

## 공통 기대 동작

1. 모든 adapter 결과는 정규화된 `DoorGuideRecord` 계약으로만 resolver에 전달한다.
2. `carNo`는 1~12, `doorNo`는 1~4 범위를 벗어나면 폐기한다.
3. 방향에 따라 결과가 달라지는 역은 방향 입력이 없을 때 문번호를 숨기고 `needs_direction`을 반환한다.
4. API 오류/timeout/malformed response는 사용자 플로우를 깨지 않고 static fixture 또는 `needs_data`로 안전하게 degrade한다.
5. source/confidence가 UI/API에 디버깅 가능한 형태로 남아야 한다. 단, 사용자 문구는 “실시간/공식 확정”처럼 과장하지 않는다.

## 테스트 매트릭스

| ID | 시나리오 | 준비/입력 | 기대 결과 | 출시 차단 여부 |
|---|---|---|---|---|
| PDG-001 | env key 없음 | `SEOUL_OPENAPI_KEY`/동등 env 미설정, 서울역 1호선 시청 방향 | API 호출을 시도하지 않거나 즉시 skip. static fixture로 `9-3` 반환. source가 fallback/sample임을 추적 가능 | 문번호가 숨겨지거나 static fixture가 깨지면 차단 |
| PDG-002 | sample key | env key가 `sample` 또는 서울 API sample key 값 | sample endpoint 허용 범위에서 성공하면 정상 파싱. quota/권한 한계가 있으면 static fallback. key를 클라이언트 번들/로그에 노출하지 않음 | sample key를 production 신뢰 데이터처럼 표시하거나 secret 노출 시 차단 |
| PDG-003 | API timeout | mock fetch가 timeout/AbortError 발생 | timeout 내 종료, static fixture fallback 또는 `needs_data`. 추천 API 전체 응답은 2xx/사용 가능 | 요청 hang, 5xx, 결과 화면 crash면 차단 |
| PDG-004 | malformed response | XML/HTML 오류, JSON shape 누락, row 배열 아님, 필드명 누락 | parser가 예외를 삼키고 안전 실패. 잘못된 record 생성 금지. fallback 실행 | malformed 응답에서 잘못된 문번호 표시 시 차단 |
| PDG-005 | 방향 없음 | 방향별 후보가 2개 이상인 역/노선에서 `direction` 생략 | `needs_direction`, `recommendedDoorNo` 미노출, “타는 방향에 따라…” 안내 | 임의 후보 문번호 노출 시 차단 |
| PDG-006 | 여러 후보 | 같은 역/방향에 에스컬레이터/계단/엘리베이터 후보 다수 | deterministic priority: 에스컬레이터 > 계단 > 엘리베이터 > 기타, 그 다음 car/door 오름차순. 결과 재실행 시 동일 | 매번 다른 후보가 나오거나 priority 미정이면 차단 |
| PDG-007 | invalid car/door | API row `13-1`, `0-2`, `2-9`, `abc`, 빈 값 | 해당 row 폐기. 유효 후보가 없으면 fallback/needs_data. invalid 값은 UI/API에 절대 노출 금지 | invalid 문번호 표시 시 즉시 차단 |
| PDG-008 | API success | mock/live API가 서울역 1호선 시청 `9-3` 등 유효 row 반환 | adapter가 normalized record 반환, resolver/buildRouteGuidance가 API 결과 사용. source/confidence/updatedAt 보존 | API 성공인데 parser 실패하거나 wrong mapping이면 차단 |
| PDG-009 | API success + static fallback 우선순위 | API가 유효하지만 특정 row만 누락/invalid | 유효 API record는 사용. API 전체 실패 또는 대상 record 부재 시 static fallback. fallback 여부 로깅 | API 부분 실패로 잘못된 record 합성 시 차단 |
| PDG-010 | static fallback 회귀 | 네트워크 차단 또는 env 없음에서 기존 `smoke-door-guidance` | 기존 정적 fixture 검증 계속 통과: 서울역/시청 `9-3`, 방향 없음은 문번호 숨김 | 기존 smoke 실패 시 차단 |
| PDG-011 | unsupported 구간 | 강남역 2호선 등 fixture/API 미지원 | `needs_data`, 문번호 미노출, 사용자에게 데이터 부족 안내 | 추정/가짜 문번호 표시 시 차단 |
| PDG-012 | key/security | 브라우저 bundle, network tab, server logs 확인 | API key는 server-side에서만 사용. client JS/응답 payload/log에 key 없음 | key 노출 시 차단 |

## 권장 자동화 테스트

### Unit/adapter

- `PublicDoorGuideAdapter` fetch mock 기반 테스트
  - env key 없음: fetch 미호출 또는 adapter disabled, static fallback path 검증
  - sample key: sample URL 구성, key redaction 검증
  - timeout: AbortController/timeout option 작동 검증
  - malformed JSON/XML/error payload: parser 안전 실패 검증
  - row mapping: `lineNm`, `stnNm`, `drtnInfo`, `qckgffVhclDoorNo`, `plfmCmgFac`, `crtrYmd` → `DoorGuideRecord`
  - invalid `qckgffVhclDoorNo`: `parseCarDoor` 실패 row drop

### Resolver/integration

- API provider와 static provider를 함께 넣은 provider chain 테스트
  - API success 시 API 결과 우선
  - API timeout/throw/malformed/empty 시 static fallback
  - 방향별 후보가 있는데 direction 없음 → `needs_direction`
  - 여러 후보 priority가 deterministic인지 반복 실행

### API smoke

- 추천 API 또는 door guidance API가 있다면 다음 케이스를 서버 프로세스에 대해 실행한다.
  - `line=1호선&toStation=서울역&direction=시청&goal=FINAL_EXIT` → available, 9번째 칸/3번 문
  - direction 생략 → needs_direction, 문번호 필드 없음
  - unsupported → needs_data, 문번호 필드 없음
  - env key 없음/네트워크 차단 → 2xx 응답 + fallback/needs_data

현재 기존 smoke는 정적 fixture 중심이므로, adapter 추가 시 `scripts/smoke-door-guidance.ts`를 다음 검증까지 확장하는 것을 권장한다.

```bash
npm run test:door-guidance
SEOUL_OPENAPI_KEY=sample npm run test:door-guidance
SEOUL_OPENAPI_KEY= npm run test:door-guidance
```

## 배포 API 검증 체크리스트

배포 후 production 또는 preview URL에서 실제 API 경로를 검증한다.

1. env key 없는 preview 배포 또는 key disabled 배포
   - 기대: static fixture fallback, 5xx 없음
2. sample/live key 배포
   - 기대: API success 또는 안전 fallback. key 노출 없음
3. timeout 강제 환경 또는 mock endpoint
   - 기대: timeout 이후 정상 응답. hang 없음
4. malformed mock endpoint
   - 기대: 정상 fallback/needs_data. server log에 원인만 redacted 기록
5. unsupported station
   - 기대: 문번호 미노출

필수 확인 항목:

- HTTP status: 사용자 요청은 2xx 또는 의미 있는 4xx. provider 실패 때문에 5xx를 내지 않는다.
- 응답 JSON: invalid `recommendedCarNo`/`recommendedDoorNo` 없음.
- 캐시: 실패 응답을 장시간 고정 캐시하지 않는다. 성공 캐시는 station/line/direction/goal key 기준.
- 로그: API key, 전체 외부 응답 원문, 사용자 식별정보를 과도하게 남기지 않는다.

## 브라우저 QA 체크리스트

모바일 viewport 기준 결과 화면에서 직접 클릭/입력 검증한다.

1. 서울역 1호선 시청 방향 추천 플로우
   - 결과 카드에 `9번째 칸`, `3번 문` 노출
   - source/confidence가 사용자에게 과장 문구로 보이지 않음
2. 방향 생략 플로우
   - 문번호 없음
   - “타는 방향에 따라 문 위치가 달라질 수 있어요” 류 안내
   - UI가 빈 카드/undefined/null을 표시하지 않음
3. unsupported 구간
   - 문번호 없음
   - 데이터 부족 안내
4. API 실패/fallback 환경
   - 로딩이 끝나고 결과 화면이 표시됨
   - console error로 화면 기능이 깨지지 않음
5. 보안 확인
   - DevTools Network/Source에서 Open API key가 보이지 않음

## 출시 차단 조건

아래 중 하나라도 재현되면 release blocker로 처리한다.

1. 잘못된 문번호 또는 범위 밖 car/door가 UI/API에 노출된다.
2. 방향이 필요한 상황에서 방향 없이 임의 문번호를 노출한다.
3. API timeout/장애/malformed response가 추천 API 5xx 또는 브라우저 crash로 이어진다.
4. env key 없음 환경에서 기존 static fixture smoke가 실패한다.
5. Open API key가 클라이언트 번들, API 응답, 브라우저 network payload, 공개 로그에 노출된다.
6. API success와 static fallback 사이 우선순위가 비결정적이라 동일 입력 결과가 흔들린다.
7. 서울역 1호선 시청 방향 회귀 케이스가 `9-3`이 아니거나 문번호가 사라진다.
8. unsupported/needs_data 상태에서 추정 문번호를 만들어 표시한다.
9. 배포 URL에서 로컬과 다른 결과가 나오며 원인을 설명/재현할 수 없다.

## 출시 승인 최소 기준

- `npm run test:door-guidance` 통과
- adapter unit tests: env 없음, sample key, timeout, malformed, invalid car/door 통과
- provider chain integration: API success/static fallback/방향 없음/여러 후보 통과
- 배포 API smoke: key 없음과 key 있음 환경 모두 5xx 없음
- 브라우저 QA: available/needs_direction/needs_data/fallback 4개 화면 상태 확인
- 보안 QA: API key client-side 미노출 확인
