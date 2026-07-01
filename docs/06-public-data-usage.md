# 공공데이터 API 활용 계획

시원칸은 사용자가 실제로 행동하는 `칸/문 번호`를 안내하므로, 공공데이터는 **검증된 경우에만 precise guidance로 노출**한다. 키 값은 `.env`/Vercel Environment Variables에만 저장하고 코드·문서·로그에 출력하지 않는다.

## 1. 빠른하차/출구 가까운 문번호 — getFstExit

### 목적
마지막 하차 구간(`FINAL_EXIT`)에서 계단/에스컬레이터/엘리베이터 가까운 칸·문 주변을 먼저 보고, 그 안에서 쾌적한 칸을 고른다.

### Env

```env
SEOUL_OPENAPI_KEY=...
SEOUL_OPENAPI_LIVE_ENABLED=false
SEOUL_OPENAPI_TIMEOUT_MS=1500
```

`SEOUL_OPENAPI_LIVE_ENABLED=false`가 기본이다. 운영 추천은 live API에 매번 의존하지 않고, 배치로 생성한 정적 fixture를 사용한다.

### 수집/갱신

```bash
cd /root/projects/coolcar
set -a; . ./.env; set +a
npm run import:final-exit-guides
npm run report:transfer-coverage
npm run test:door-guidance
npm run test:route-matrix-safety
```

생성 파일:

```text
data/door-guidance/verified-final-exit-guides.json
```

현재 생성 결과:

```text
sourceRows: 2358
records: 2145
stationLinePairs: 246
ELEVATOR: 500
ESCALATOR: 500
STAIRS: 1145
```

### 제품 노출 규칙

- `available`일 때만 문번호/시설 가까운 위치를 보여준다.
- 방향이 필요한데 추론/입력이 없으면 `needs_direction`으로 둔다.
- 데이터가 없으면 문번호를 만들지 않고 쾌적칸 중심으로 fallback한다.
- UI에는 provider/API/cache 같은 내부 용어를 노출하지 않는다.

## 2. 환승 가까운 문번호 — transfer fixtures

### 목적
중간 환승 구간(`NEXT_TRANSFER`)에서 환승통로와 가까운 칸·문 주변을 먼저 보고, 그 안에서 쾌적한 칸을 고른다.

### 원천

- 서울교통공사_서울 도시철도 환승정보
- 국토교통부_철도역 빠른 환승 정보

### 갱신

```bash
npm run build:transfer-inventory
npm run import:transfer-guides
npm run report:transfer-coverage
npm run audit:transfer-safety
npm run test:route-matrix-safety
```

현재 coverage:

```text
verifiedNextTransferPairs: 180 / 210
coverageRatio: 85.71%
P0/P1/P2 audit failure: 0
```

### 안전 규칙

- official/public 또는 현장검증 데이터만 production fixture로 사용한다.
- 같은 방향 exact match가 있으면 exact row만 사용한다.
- side-equivalence는 exact match가 없을 때만 fallback으로 사용한다.
- 후보칸은 대표 anchor ±1, 최대 3칸만 노출한다.

## 3. 실시간 지하철 도착정보 — realtimeStationArrival

### 목적
실시간 도착정보는 **추천 칸 자체를 바꾸는 용도**가 아니라, 다음 부가 기능에 사용한다.

1. 결과 화면에서 “곧 오는 열차” 참고 정보
2. 탑승 직전 안내/푸시
3. 막차 여부 표시
4. 열차 도착 시각 기반 UX 보정
5. 추후 혼잡/도착 패턴 검증 보조

실시간 API는 지연·누락·서울 외 구간 미제공이 있으므로, 문번호/추천칸을 실시간 API만으로 확정하지 않는다.

### Env

```env
SEOUL_REALTIME_SUBWAY_API_KEY=...
SEOUL_REALTIME_SUBWAY_ENABLED=false
SEOUL_REALTIME_SUBWAY_BASE_URL=http://swopenAPI.seoul.go.kr/api/subway
```

`SEOUL_REALTIME_SUBWAY_ENABLED=false`가 기본이다. UI에 노출하기 전까지는 진단 스크립트로만 사용한다.

### 진단 호출

```bash
cd /root/projects/coolcar
set -a; . ./.env; set +a
npm run test:realtime-subway -- 서울역
```

응답 예시는 키를 출력하지 않고 다음 안전 필드만 보여준다.

- lineName
- updnLine
- trainLineNm
- statnNm
- secondsToArrival/barvlDt
- trainNo
- terminalStation
- receivedAt/recptnDt
- arrivalMessage
- arrivalStatus
- isLastTrain

### 내부 API route

```text
GET /api/realtime-arrivals?station=서울역&limit=5
```

단, 이 route는 `SEOUL_REALTIME_SUBWAY_ENABLED=true`일 때만 실제 호출한다. 기본값 false에서는 사용자에게 “현재 앱에서 사용하지 않도록 설정” 상태를 반환한다.

### 실시간 API 주의사항

- 서울시 외 구간은 미제공될 수 있다.
- 일부 역명은 API용 alias가 필요하다.
  - 서울역 → 서울
  - 응암역 → 응암순환(상선)
  - 공릉역 → 공릉(서울산업대입구)
  - 천호역 → 천호(풍납토성)
- `recptnDt`는 데이터 생성 시각이다. 현재 시각과 차이가 있으면 도착예정시간을 그대로 믿지 말고 지연 가능성을 표시해야 한다.
- 실시간 도착 API는 열차 도착 상태용이고, 칸별 혼잡/문번호 검증용 원천이 아니다.

## 4. 릴리즈 전 검증 명령

```bash
npm run typecheck
npm run test:transfer-coverage
npm run audit:transfer-safety
npm run test:route-matrix-safety
npm run test:no-fake-anchor
npm run test:route-plans
npm run test:multi-transfer
npm run test:anchor-window
npm run test:door-guidance
npm run build
```

실시간 API를 UI에 붙이는 작업을 한 경우 추가:

```bash
set -a; . ./.env; set +a
npm run test:realtime-subway -- 서울역
```

## 5. 다음 제품 적용 순서

1. 결과 화면 하단에 “실시간 도착 참고” 접이식 카드 추가
2. `SEOUL_REALTIME_SUBWAY_ENABLED=true` 환경에서만 노출
3. 응답 없거나 지연되면 조용히 숨김/간단 fallback
4. 실시간 정보는 추천칸 계산에 직접 섞지 않고 참고 카드로 시작
5. 충분히 안정화되면 탑승 타이밍 안내/막차 표시로 확장
