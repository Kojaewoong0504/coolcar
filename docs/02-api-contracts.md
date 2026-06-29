# API 계약 v0.1

## 1. POST /api/recommend

사용자 상황을 받아 추천 칸을 반환한다.

### Request

```json
{
  "line": "2호선",
  "originStation": "강남역",
  "destinationStation": "홍대입구역",
  "direction": "내선",
  "comfortType": "HOT_SENSITIVE",
  "targetTime": "2026-06-29T18:20:00+09:00",
  "waitToleranceMin": 5,
  "avoidPrioritySeatArea": true
}
```

### Request Type

```ts
type RecommendRequest = {
  line: string;
  originStation: string;
  destinationStation?: string;
  direction?: string;
  comfortType: 'HOT_SENSITIVE' | 'COLD_SENSITIVE' | 'CROWD_AVOIDER' | 'BALANCED';
  targetTime?: string;
  waitToleranceMin?: 0 | 3 | 5 | 10;
  avoidPrioritySeatArea?: boolean;
};
```

### Response

```json
{
  "recommendationId": "uuid",
  "line": "2호선",
  "originStation": "강남역",
  "recommendedCar": {
    "carNo": 10,
    "position": "FRONT",
    "label": "10번째 칸 앞쪽"
  },
  "cars": [
    {
      "carNo": 1,
      "congestionPercent": 100,
      "coolingScore": 95,
      "crowdScore": 62,
      "transferScore": 50,
      "preferenceScore": 80,
      "totalComfortScore": 82,
      "tags": ["끝쪽", "시원함"]
    }
  ],
  "avoidCars": [5, 6],
  "reasons": [
    "객실 끝 쪽이라 냉방 체감이 강한 편이에요.",
    "현재 시간대 기준 중앙부보다 덜 붐빌 가능성이 높아요.",
    "도착역 하차 동선 손해가 크지 않아요."
  ],
  "sourceMeta": {
    "provider": "TMAP_SK_OPEN_API",
    "sourceType": "STATISTICAL_CAR",
    "confidence": "HIGH",
    "retrievedAt": "2026-06-29T18:19:00+09:00",
    "cacheHit": true
  }
}
```

## 2. POST /api/feedback

추천 결과에 대한 피드백을 저장한다.

### Request

```json
{
  "recommendationId": "uuid",
  "line": "2호선",
  "station": "강남역",
  "direction": "내선",
  "carNo": 10,
  "feedbackType": "GOOD",
  "temperatureFeel": "COOL",
  "crowdingFeel": "LOW"
}
```

### Types

```ts
type FeedbackType = 'GOOD' | 'HOT' | 'COLD' | 'CROWDED' | 'WRONG';
type TemperatureFeel = 'HOT' | 'COLD' | 'OK' | 'COOL';
type CrowdingFeel = 'LOW' | 'MID' | 'HIGH';
```

### Response

```json
{
  "ok": true,
  "updatedPreference": {
    "hotSensitivityScore": 0.72,
    "crowdAvoidanceScore": 0.44
  }
}
```

## 3. GET /api/stations/search?q=강남

역 검색 자동완성.

### Response

```json
{
  "stations": [
    {
      "name": "강남역",
      "line": "2호선",
      "lat": 37.4979,
      "lng": 127.0276,
      "operator": "SEOUL_METRO"
    },
    {
      "name": "강남역",
      "line": "신분당선",
      "lat": 37.4979,
      "lng": 127.0276,
      "operator": "NEO_TRANS"
    }
  ]
}
```

## 4. GET /api/routes/saved

로그인 사용자의 저장 경로를 반환한다.

## 5. POST /api/routes/saved

자주 타는 경로를 저장한다.

## 6. POST /api/admin/tmap/diagnostics

운영자용 TMAP 권한/응답 진단 endpoint. appKey 원문은 절대 응답하지 않는다.

### Request

```json
{
  "line": "2호선",
  "station": "강남",
  "dow": "MON",
  "hh": "08"
}
```

### Response

```json
{
  "ok": false,
  "code": "PRODUCT_NOT_AUTHORIZED",
  "httpStatus": 403,
  "message": "appKey가 속한 앱에 이 TMAP 대중교통 상품/API 권한이 없거나 상품 상태가 완료/활성화되지 않았을 가능성이 높습니다. (HTTP 403)",
  "safeRequest": {
    "endpointHost": "apis.openapi.sk.com",
    "endpointPath": "/transit/puzzle/subway/congestion/stat/car",
    "appKeyPresent": true,
    "appKeySource": "TMAP_APPKEY",
    "appKeyRedacted": "****…****",
    "params": {
      "routeNm": "2호선",
      "stationNm": "강남역",
      "dow": "MON",
      "hh": "08"
    }
  },
  "durationMs": 352,
  "logged": true
}
```

### Diagnostic codes

| 코드 | 의미 | 다음 확인 |
|---|---|---|
| ENV_MISSING | 서버 env에 appKey 없음 | 배포 env 이름/로딩 확인 |
| UNAUTHORIZED_KEY | appKey 인증 실패 | 값 공백/잘림/앱 매핑 확인 |
| PRODUCT_NOT_AUTHORIZED | appKey의 앱에 TMAP 대중교통 상품/API 권한이 없거나 미활성 가능성 | 상품관리/신청 상태/선택 앱 확인 |
| ACCESS_DENIED | IP whitelist/접근 정책 가능성 | 앱키 탭 접근 허용 IP 확인 |
| WRONG_ENDPOINT | endpoint/method 불일치 | 공식 문서 URL 확인 |
| MALFORMED_PARAMS | 노선/역/요일/시간 파라미터 문제 | station suffix/line mapping 확인 |
| QUOTA_EXCEEDED/RATE_LIMITED | 한도/속도 제한 | 캐시/호출량/상품 한도 확인 |
| SCHEMA_MISMATCH | 성공 응답 schema 변경 | parser 업데이트 |

## 7. Error Response

```json
{
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "실시간 칸별 데이터를 가져오지 못해 추정 추천으로 전환했어요.",
    "fallbackUsed": true
  }
}
```

## 7. 에러 코드

| 코드 | 의미 | 처리 |
|---|---|---|
| INVALID_INPUT | 입력값 오류 | 사용자 수정 요청 |
| PROVIDER_UNAVAILABLE | 외부 API 장애 | 추정 Provider fallback |
| RATE_LIMITED | Free API 한도 | 캐시/추정 fallback |
| UNSUPPORTED_LINE | 미지원 노선 | 추정 모드 안내 |
| AUTH_REQUIRED | 로그인이 필요한 기능 | 소셜 로그인 유도 |
