# 구로디지털단지역 → 올림픽공원역 환승 안내 수용 테스트

## 목적

실제 스크린샷 리뷰에서 지적된 “환승 경로와 방면 근거가 부족한데 확정 경로처럼 말하는 문제”를 재발 방지한다. 구로디지털단지역에서 올림픽공원역으로 가는 케이스는 기본 2호선 출발, 목적지 노선 9호선 또는 5호선, 중간 환승역 후보가 여러 개 있을 수 있으므로 앱은 **확정된 환승역/방면 입력이 없으면 환승 경로를 단정하지 않아야 한다.**

## 대상 범위

- API: `POST /api/recommend`
- 응답 필드: `routeGuidance.status`, `routeGuidance.summary`, `routeGuidance.disclaimer`, `routeGuidance.legs[].status`, `routeChoice.mode`, 칸/문 번호 필드
- UI: `/` 입력 → `/result?loading=1` → `/result`, 결과 카드, 칸 위치 지도, 상세 `<details>` 펼침 영역
- 주요 시나리오:
  1. 환승 경로 미입력: 구로디지털단지역(2호선) → 올림픽공원역(9호선), `transferStations` 없음
  2. 환승역 입력: 구로디지털단지역(2호선) → 당산역 환승 → 올림픽공원역(9호선)
  3. 방면 미입력/불확실: `direction` 없음 또는 방향 근거 부족

## 공통 수용 기준

1. API 응답은 항상 JSON이며 `routeGuidance.status`가 경로 확정 수준을 정확히 표현한다.
2. 환승 경로가 미확정이면 `routeGuidance.status`는 `needs_route`여야 하며 UI도 “경로 확인 필요”, “환승 경로를 확인해 주세요”처럼 안전한 문구를 사용한다.
3. 환승역이 입력되었더라도 방면/문 위치 데이터가 부족하면 `limited`, `needs_data`, `needs_direction`, `needs_route` 중 하나로 제한 상태를 표현하고, “최적 환승”, “가장 빠른 환승”, “공식 환승”, “이 경로로 가세요”처럼 확정적인 표현을 쓰지 않는다.
4. `routeChoice.mode`가 `COMFORT_ONLY`이면 환승문 기준 `anchorCarNo`, `anchorDoorNo`를 노출하지 않는다.
5. leg `status`가 `available`이 아닌데 `recommendedDoorNo`, `anchorDoorNo` 같은 확정 문번호를 만들면 실패다.
6. 결과 화면의 추천 칸 지도(`.train-map`, `.result-cars`, `.car.best`)는 환승 경로 미확정/제한 상태에서도 유지되어야 한다.
7. 상세 영역은 기본 접힘 상태와 펼침 상태 모두에서 주요 UI를 잃지 않아야 한다.
8. 소비자 문구에는 내부 구현 용어(`fallback`, `provider`, `adapter`, `confidence`)가 노출되지 않는다.

## 출시 차단 조건

- 환승역 입력이 없는데 “당산역에서 갈아타세요”, “9호선 환승 경로 확정”, “최적 환승 경로”처럼 단정한다.
- `routeGuidance.status=needs_route`가 아닌데 실제로는 `transferStations`가 비어 있다.
- `legs[].status !== 'available'`인데 문번호/빠른환승 위치를 확정적으로 노출한다.
- 결과 카드에서 추천 칸 라벨 또는 칸 위치 지도가 사라진다.
- 상세 펼침 후 `.train-map`, 저장 CTA, 피드백 CTA, 추천 칸 강조가 사라지거나 콘솔 오류가 난다.
- `undefined`, `null`, 빈 역명, 내부 타입명이 화면에 보인다.

## API 수용 테스트 매트릭스

| ID | 구분 | 입력 | 기대 API 결과 | 실패/차단 기준 |
|---|---|---|---|---|
| GDO-API-001 | 경로 미확정 상태 | `line=2호선`, `originStation=구로디지털단지역`, `destinationStation=올림픽공원역`, `destinationLine=9호선`, `transferStations` 없음 | `200 OK`. `routeGuidance.status === 'needs_route'`. `legs.length === 1`. 첫 leg `status === 'needs_route'`, `goal === 'NEXT_TRANSFER'`. summary/message에 환승역을 추가해야 한다는 취지 포함 | `direct`, `limited`, `transfer_ready`로 응답하거나 특정 환승역/방면을 확정 표현 |
| GDO-API-002 | 경로 미확정 시 문번호 금지 | GDO-API-001과 동일 | 첫 leg에 `recommendedDoorNo`/`anchorDoorNo`가 없어야 한다. `routeChoice.mode === 'COMFORT_ONLY'`이면 `anchorCarNo`/`anchorDoorNo`도 없어야 한다 | 미확정인데 `n번 문`, `빠른환승 문` 확정 노출 |
| GDO-API-003 | 경로 미확정 시 추천 칸은 허용 | GDO-API-001과 동일 | `recommendedCar.carNo`, `cars[]`, `avoidCars[]`, `reasons[]`는 정상 제공. leg `positionLabel`은 “n번째 칸 근처”처럼 쾌적칸 참고 수준 허용 | 경로 미확정이라는 이유로 추천 칸/칸 배열이 비거나 API crash |
| GDO-API-004 | 환승역 입력 시 제한 안내 | `transferStations=['당산역']`, `destinationLine=9호선` | `routeGuidance.status === 'limited'`. legs는 `구로디지털단지역 → 당산역`, `당산역 → 올림픽공원역` 흐름을 반영. 데이터 부족 leg는 `needs_data`/`needs_direction`/`needs_route`로 표시 | 환승역 입력만으로 모든 구간을 `available`처럼 단정하거나 없는 문번호 생성 |
| GDO-API-005 | 방면 미입력 보호 | GDO-API-004에서 `direction` 제거 | 첫 leg가 `available`로 확정되지 않아야 하며, 필요 시 `needs_direction` 또는 안전한 제한 상태를 반환. 문구에 “방면 확인 필요” 또는 동등한 안내 포함 | 방면 없이 `n번 문 근처가 편해요` 확정 |
| GDO-API-006 | 확정 가능한 데이터만 확정 | 향후 공공 빠른환승 데이터가 추가된 동일 시나리오 | `available`인 leg에 한해서만 `recommendedDoorNo`/`anchorDoorNo` 표시 가능. `facility`/`message`는 데이터 근거가 있는 위치만 설명 | 일부 leg만 확정 가능한데 전체 경로를 확정 표현 |
| GDO-API-007 | 문구 안전성 | GDO-API-001~006 전체 응답 텍스트 검사 | 응답의 consumer-visible text에 “최적 환승”, “가장 빠른 환승”, “공식 환승”, “무조건 여기”, “fallback”, “provider”, “adapter”, “confidence” 없음 | 금지 문구 1개 이상 포함 |
| GDO-API-008 | 스키마 회귀 | GDO-API-001~006 전체 | `recommendationId`, `request`, `recommendedCar`, `cars`, `routeChoice`, `routeGuidance`, `sourceMeta`, `safetyNotice` 존재 | 5xx, HTML 응답, schema mismatch |

## API smoke 예시

### 1) 환승 경로 미확정

```bash
BASE_URL=http://127.0.0.1:3000
curl -sS -X POST "$BASE_URL/api/recommend" \
  -H 'content-type: application/json' \
  -d '{
    "anonymousId":"qa-gdo-needs-route",
    "line":"2호선",
    "originStation":"구로디지털단지역",
    "destinationStation":"올림픽공원역",
    "destinationLine":"9호선",
    "comfortType":"HOT_SENSITIVE",
    "waitToleranceMin":3,
    "avoidPrioritySeatArea":true
  }' | jq '{status:.routeGuidance.status, mode:.routeChoice.mode, legs:.routeGuidance.legs}'
```

필수 기대값:

```json
{
  "status": "needs_route",
  "mode": "COMFORT_ONLY"
}
```

첫 leg 필수 기대:

- `status: "needs_route"`
- `goal: "NEXT_TRANSFER"`
- `recommendedDoorNo`, `anchorDoorNo` 없음
- message 예: `현재는 전체 환승 경로가 확정되지 않아...` 또는 동등한 안전 문구

### 2) 환승역을 사용자가 지정한 제한 경로

```bash
curl -sS -X POST "$BASE_URL/api/recommend" \
  -H 'content-type: application/json' \
  -d '{
    "anonymousId":"qa-gdo-limited-dangsan",
    "line":"2호선",
    "originStation":"구로디지털단지역",
    "destinationStation":"올림픽공원역",
    "destinationLine":"9호선",
    "direction":"당산",
    "transferStations":["당산역"],
    "comfortType":"HOT_SENSITIVE",
    "waitToleranceMin":3,
    "avoidPrioritySeatArea":true
  }' | jq '{status:.routeGuidance.status, summary:.routeGuidance.summary, legs:.routeGuidance.legs}'
```

필수 기대값:

- `routeGuidance.status: "limited"`
- `legs.length >= 2`
- 첫 leg: `fromStation=구로디지털단지역`, `toStation=당산역`
- 마지막 leg: `toStation=올림픽공원역`
- `available`이 아닌 leg에는 문번호 확정 필드 없음

### 3) 방면 미입력

```bash
curl -sS -X POST "$BASE_URL/api/recommend" \
  -H 'content-type: application/json' \
  -d '{
    "anonymousId":"qa-gdo-no-direction",
    "line":"2호선",
    "originStation":"구로디지털단지역",
    "destinationStation":"올림픽공원역",
    "destinationLine":"9호선",
    "transferStations":["당산역"],
    "comfortType":"BALANCED"
  }' | jq '{status:.routeGuidance.status, legs:.routeGuidance.legs}'
```

필수 기대값:

- 전체 상태는 제한 상태(`limited` 또는 설계상 동등 상태)
- 방면 근거가 필요한 leg는 `needs_direction`/`needs_data`/`needs_route`
- UI에 “방면 확인 필요” 또는 “환승 경로를 확인해 주세요” 계열 문구 표시

## UI 수용 테스트 매트릭스

| ID | 영역 | 절차 | 기대 결과 | 실패/차단 기준 |
|---|---|---|---|---|
| GDO-UI-001 | 홈 입력 보존 | 새 세션에서 `/` 접속 → 출발 `구로디지털단지역 2호선`, 도착 `올림픽공원역 9호선`, 환승역 비움 → 추천 실행 | `/result?loading=1` 진입 후 `/result`로 정리. 결과 상단에 `구로디지털단지역 → 올림픽공원역` 표시 | 로딩에서 멈춤, 역명/노선 변조, crash |
| GDO-UI-002 | 미확정 경로 문구 | GDO-UI-001 결과 확인 | 결과 카드 또는 구간 상세에 “환승 경로가 확정되지 않아”, “환승역을 추가하면”, “경로 확인 필요”, “환승 경로를 확인해 주세요” 중 동등한 문구 표시 | 특정 환승역/노선/방면을 사용자가 고르지 않았는데 확정 표현 |
| GDO-UI-003 | 추천 칸 지도 유지 | GDO-UI-001 결과 카드 확인 | `.train-map`, `.result-cars`, `.car.best`가 표시. 추천 칸에는 `추천`/`여기` 강조가 있다 | 미확정 상태에서 지도가 숨겨짐 또는 추천 칸 강조 없음 |
| GDO-UI-004 | 상세 기본 접힘 | 결과 진입 직후 상세 영역 확인 | `왜 이 칸인가요?`, `구간별 위치 안내` 또는 `환승 구간별 위치 보기`, `추천이 맞았나요?` details가 접힘 상태로 존재. 접힘 상태에서도 추천 칸/지도/저장 CTA는 보임 | details가 없거나 접힘 때문에 핵심 카드가 사라짐 |
| GDO-UI-005 | 추천 이유 펼침 | `왜 이 칸인가요?` 클릭 | 추천 이유, 피하면 좋은 위치 등이 표시. 다시 접어도 추천 칸 지도 유지 | 펼침 후 `.train-map` 또는 CTA 사라짐, 콘솔 오류 |
| GDO-UI-006 | 구간 안내 펼침 | `구간별 위치 안내` 클릭 | summary, disclaimer, `1구간`, 출발→도착, 노선/방면, leg 상태 배지 표시. 미확정이면 `경로 확인 필요` 문구 사용 | `undefined/null`, 빈 카드, 확정 문번호 오표시 |
| GDO-UI-007 | 환승역 지정 UI | 홈에서 `transferStations=당산역` 또는 쿼리 복원으로 당산역 입력 후 추천 | 구간 상세가 2개 이상으로 분리되거나 환승역 기준 limited 안내 표시 | 당산역 입력이 무시되거나 전체 경로 확정처럼 표현 |
| GDO-UI-008 | 방면 미입력 UI | 방향 입력을 비우고 환승역만 지정한 뒤 추천 | `방면 확인 필요` 또는 동등한 제한 문구. 문번호 확정 안내 없음 | 방면 없이 `n번 문 근처가 편해요` 확정 |
| GDO-UI-009 | 금지 문구 검사 | 결과 페이지 전체 visible text 확인 | “최적 환승”, “가장 빠른 환승”, “공식 환승”, “무조건 여기”, “fallback”, “provider”, “adapter”, “confidence” 없음 | 금지 문구 노출 |
| GDO-UI-010 | 저장/피드백 유지 | 상세 펼침 후 `루틴 저장하기`, 피드백 details의 버튼 클릭 | 저장/피드백 pending 및 성공/오류 문구 정상 표시. 상세 토글 이후에도 버튼 동작 | 토글 후 버튼 무반응, 중복 요청 폭주, 오류 안내 없음 |
| GDO-UI-011 | 다시 추천 입력 복원 | 결과에서 `다시 고르기`/`다시 추천` 클릭 | 홈으로 이동하며 `line`, `originStation`, `destinationStation`, `destinationLine`, `direction`, `transferStations` 값 복원 | 사용자가 입력한 올림픽공원/당산역/방면 정보 유실 |
| GDO-UI-012 | 콘솔/네트워크 품질 | 전체 플로우 중 DevTools 확인 | Console에 uncaught error/hydration mismatch 없음. `/api/recommend`는 200 JSON | JS 오류, HTML 응답, 민감정보/secret 노출 |

## 수동 브라우저 절차

1. 브라우저 `localStorage`/`sessionStorage`를 비우고 `http://127.0.0.1:3000` 또는 배포 URL에 접속한다.
2. 출발역 입력: `구로디지털단지역` 선택, 노선 `2호선` 확인.
3. 도착역 입력: `올림픽공원역` 선택, 목적지 노선은 우선 `9호선`으로 확인한다. 5호선 후보가 제공되는 경우 같은 절차를 반복한다.
4. 환승역은 비워 둔 상태로 추천 실행.
5. 결과 화면에서 다음을 확인한다.
   - 추천 칸 헤더: `n번째 칸으로 가세요`
   - 출발→도착: `구로디지털단지역 → 올림픽공원역`
   - `.train-map` 및 추천 칸 `추천`/`여기`
   - 미확정 문구: `경로 확인 필요`, `환승 경로를 확인해 주세요`, `환승역을 추가하면` 중 하나
   - 금지: `당산역에서 갈아타세요` 등 사용자가 고르지 않은 환승역 단정
6. `구간별 위치 안내`를 펼친다.
   - `1구간`, `2호선`, 상태 배지, disclaimer가 읽혀야 한다.
   - `undefined`, `null`, 빈 역명이 없어야 한다.
   - leg가 `available`이 아니면 `n번 문` 확정 문구가 없어야 한다.
7. 다시 홈으로 돌아가 환승역 `당산역`을 입력하고 같은 경로를 추천한다.
8. `환승 구간별 위치 보기` 또는 동등 상세를 펼쳐 `구로디지털단지역 → 당산역`, `당산역 → 올림픽공원역` 구간 분리가 되는지 확인한다.
9. 방향을 비운 변형 케이스를 반복해 “방면 확인 필요” 계열 문구가 나오는지 확인한다.
10. 모든 단계에서 추천 칸 지도와 저장/피드백 영역이 유지되는지 확인한다.

## 자동화 권장 검증 포인트

향후 Playwright 또는 smoke 스크립트로 자동화할 때는 아래 assertion을 최소 포함한다.

```ts
expect(response.routeGuidance.status).toBe('needs_route');
expect(response.routeGuidance.legs[0].status).toBe('needs_route');
expect(response.routeGuidance.legs[0].recommendedDoorNo).toBeUndefined();
expect(response.routeGuidance.legs[0].anchorDoorNo).toBeUndefined();
expect(response.routeChoice.mode).toBe('COMFORT_ONLY');
expect(response.routeChoice.anchorDoorNo).toBeUndefined();

await expect(page.locator('.train-map')).toBeVisible();
await expect(page.locator('.result-cars .car.best')).toBeVisible();
await expect(page.getByText(/경로 확인 필요|환승 경로를 확인해 주세요|환승역을 추가하면/)).toBeVisible();
await expect(page.getByText(/최적 환승|가장 빠른 환승|공식 환승|무조건 여기/)).toHaveCount(0);
```

## QA 판정

- GDO-API-001~008과 GDO-UI-001~012가 모두 통과해야 구로디지털단지역→올림픽공원역 수정본을 수용한다.
- 특히 `routeGuidance.status`, leg `status`, UI 문구가 서로 모순되면 실패로 본다.
- 환승 경로/방면 근거가 불충분한 상태에서 확정적인 환승 안내를 제공하는 것은 출시 차단 결함이다.
