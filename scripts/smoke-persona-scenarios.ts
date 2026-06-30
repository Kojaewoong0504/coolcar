import { recommend } from '../src/lib/recommendation';
import type { RecommendRequest, RecommendationResponse } from '../src/lib/types';

type ExpectedMode = 'ANCHOR_WINDOW' | 'COMFORT_ONLY';
type Scenario = {
  id: string;
  persona: string;
  commuteStory: string;
  request: RecommendRequest;
  expected: {
    mode: ExpectedMode;
    anchorCarNo?: number;
    anchorDoorNo?: number;
    candidateCarNos?: number[];
    guidanceStatus?: string;
    firstLegStatus?: string;
    carCount?: number;
  };
};

type ScenarioResult = {
  id: string;
  persona: string;
  commuteStory: string;
  verdict: 'PASS';
  recommendedCarNo: number;
  routeChoiceMode: string;
  anchorCarNo?: number;
  anchorDoorNo?: number;
  candidateCarNos: number[];
  guidanceStatus: string;
  firstLegStatus?: string;
  firstLegLabel?: string;
  reasonPreview: string[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const forbiddenUiTerms = [
  'fallback',
  'provider',
  'Open API',
  'adapter',
  'confidence',
  '환승 최적',
  '최단 환승',
  '가장 빠른 환승',
  '공식 환승',
  '무조건 여기',
];

const scenarios: Scenario[] = [
  {
    id: 'P1_SEOUL_STATION_NAMYEONG_OFFICE',
    persona: '서울역 인근 사무직: 남영에서 서울역으로 출근',
    commuteStory: '서울역 도착 후 회사 방향 에스컬레이터에 빨리 붙고 싶은 직장인',
    request: {
      line: '1호선',
      originStation: '남영역',
      destinationStation: '서울역',
      destinationLine: '1호선',
      direction: '시청',
      comfortType: 'BALANCED',
    },
    expected: { mode: 'ANCHOR_WINDOW', anchorCarNo: 9, anchorDoorNo: 3, candidateCarNos: [8, 9, 10], guidanceStatus: 'direct', firstLegStatus: 'available' },
  },
  {
    id: 'P2_SEOUL_STATION_CITYHALL_KTX',
    persona: '시청 업무지구 직장인: 서울역 KTX 환승 이동',
    commuteStory: '시청에서 서울역으로 가서 KTX/공항철도 방향으로 빠르게 이동하고 싶은 사용자',
    request: {
      line: '1호선',
      originStation: '시청역',
      destinationStation: '서울역',
      destinationLine: '1호선',
      direction: '남영',
      comfortType: 'HOT_SENSITIVE',
    },
    expected: { mode: 'ANCHOR_WINDOW', anchorCarNo: 2, anchorDoorNo: 3, candidateCarNos: [1, 2, 3], guidanceStatus: 'direct', firstLegStatus: 'available' },
  },
  {
    id: 'P3_SEOUL_STATION_YONGSAN_COMMUTER',
    persona: '용산/남영권 통근자: 서울역 업무지구 출근',
    commuteStory: '한 정거장 이동이라도 내린 뒤 덜 걷고 싶은 출근길 사용자',
    request: {
      line: '1호선',
      originStation: '용산역',
      destinationStation: '서울역',
      destinationLine: '1호선',
      direction: '시청',
      comfortType: 'CROWD_AVOIDER',
    },
    expected: { mode: 'ANCHOR_WINDOW', anchorCarNo: 9, anchorDoorNo: 3, candidateCarNos: [8, 9, 10], guidanceStatus: 'direct', firstLegStatus: 'available' },
  },
  {
    id: 'P4_GANGNAM_TO_JAMSIL_OFFICE',
    persona: '강남권 직장인: 잠실 업무/미팅 이동',
    commuteStory: '강남역에서 잠실역까지 2호선을 타지만 잠실 빠른하차 데이터는 아직 없는 케이스',
    request: {
      line: '2호선',
      originStation: '강남역',
      destinationStation: '잠실역',
      destinationLine: '2호선',
      direction: '잠실',
      comfortType: 'BALANCED',
    },
    expected: { mode: 'COMFORT_ONLY', guidanceStatus: 'direct', firstLegStatus: 'needs_data' },
  },
  {
    id: 'P5_SINDORIM_TO_GANGNAM_COMMUTER',
    persona: '서남권 통근자: 신도림에서 강남 출근',
    commuteStory: '유동인구 많은 신도림/강남을 지나지만 강남역 문 위치 fixture가 없는 케이스',
    request: {
      line: '2호선',
      originStation: '신도림역',
      destinationStation: '강남역',
      destinationLine: '2호선',
      direction: '대림',
      comfortType: 'CROWD_AVOIDER',
    },
    expected: { mode: 'COMFORT_ONLY', guidanceStatus: 'direct', firstLegStatus: 'needs_data' },
  },
  {
    id: 'P6_HONGDAE_TO_PANGYO_IT',
    persona: '홍대입구 거주 IT 직장인: 판교 출근',
    commuteStory: '홍대입구에서 강남 환승 후 신분당선으로 판교 출근. 강남 NEXT_TRANSFER 데이터 부족 확인',
    request: {
      line: '2호선',
      originStation: '홍대입구역',
      destinationStation: '판교역',
      destinationLine: '신분당선',
      direction: '신촌',
      transferStations: ['강남역'],
      comfortType: 'HOT_SENSITIVE',
    },
    expected: { mode: 'COMFORT_ONLY', guidanceStatus: 'limited', firstLegStatus: 'needs_data' },
  },
  {
    id: 'P7_SADANG_TO_JONGGAK_OFFICE',
    persona: '사당 거주 직장인: 종각/종로 업무지구 출근',
    commuteStory: '사당에서 서울역 환승 후 1호선으로 종각 이동. 서울역 FINAL_EXIT는 있지만 4호선 NEXT_TRANSFER 데이터는 없는 케이스',
    request: {
      line: '4호선',
      originStation: '사당역',
      destinationStation: '종각역',
      destinationLine: '1호선',
      direction: '서울역',
      transferStations: ['서울역'],
      comfortType: 'BALANCED',
    },
    expected: { mode: 'COMFORT_ONLY', guidanceStatus: 'limited', firstLegStatus: 'needs_data' },
  },
  {
    id: 'P8_YANGJAE_TO_YEOUIDO_FINANCE',
    persona: '양재 거주 금융권 직장인: 여의도 출근',
    commuteStory: '양재에서 고속터미널 환승 후 9호선으로 여의도 이동. 고속터미널 환승문 데이터 부족 확인',
    request: {
      line: '3호선',
      originStation: '양재역',
      destinationStation: '여의도역',
      destinationLine: '9호선',
      direction: '고속터미널',
      transferStations: ['고속터미널역'],
      comfortType: 'BALANCED',
    },
    expected: { mode: 'COMFORT_ONLY', guidanceStatus: 'limited', firstLegStatus: 'needs_data' },
  },
  {
    id: 'P9_YEOUIDO_TO_GANGNAM_MULTI_TRANSFER',
    persona: '여의도 직장인: 강남 미팅 이동',
    commuteStory: '9호선에서 고속터미널·교대 환승을 거치는 다중 환승. 6량 노선과 데이터 부족 fallback 확인',
    request: {
      line: '9호선',
      originStation: '여의도역',
      destinationStation: '강남역',
      destinationLine: '2호선',
      direction: '고속터미널',
      transferStations: ['고속터미널역', '교대역'],
      comfortType: 'CROWD_AVOIDER',
    },
    expected: { mode: 'COMFORT_ONLY', guidanceStatus: 'limited', firstLegStatus: 'needs_data', carCount: 6 },
  },
  {
    id: 'P10_SEOUL_STATION_MISSING_DIRECTION',
    persona: '서울역행 사용자: 방면 입력 누락',
    commuteStory: '서울역 fixture는 있지만 타는 방향에 따라 문 위치가 달라져 임의 확정을 하면 안 되는 회귀 케이스',
    request: {
      line: '1호선',
      originStation: '남영역',
      destinationStation: '서울역',
      destinationLine: '1호선',
      comfortType: 'BALANCED',
    },
    expected: { mode: 'COMFORT_ONLY', guidanceStatus: 'direct', firstLegStatus: 'needs_direction' },
  },
];

function visibleText(result: RecommendationResponse) {
  return [
    result.routeChoice.message,
    ...result.reasons,
    result.routeGuidance.summary,
    result.routeGuidance.disclaimer,
    ...result.routeGuidance.legs.flatMap((leg) => [leg.positionLabel, leg.message, leg.facility ?? '']),
  ].join('\n');
}

function assertNoForbiddenTerms(result: RecommendationResponse, scenario: Scenario) {
  const text = visibleText(result);
  for (const term of forbiddenUiTerms) {
    assert(!text.includes(term), `${scenario.id}: consumer-visible text should not include forbidden term "${term}"`);
  }
}

function assertAnchorWindow(result: RecommendationResponse, scenario: Scenario) {
  const { expected } = scenario;
  assert(result.routeChoice.mode === 'ANCHOR_WINDOW', `${scenario.id}: expected ANCHOR_WINDOW`);
  assert(result.routeChoice.anchorCarNo === expected.anchorCarNo, `${scenario.id}: unexpected anchor car`);
  assert(result.routeChoice.anchorDoorNo === expected.anchorDoorNo, `${scenario.id}: unexpected anchor door`);
  assert(JSON.stringify(result.routeChoice.candidateCarNos) === JSON.stringify(expected.candidateCarNos), `${scenario.id}: unexpected candidate cars`);
  assert(result.routeChoice.candidateCarNos.includes(result.recommendedCar.carNo), `${scenario.id}: recommended car must be inside anchor±1 candidate cars`);
  assert(result.routeChoice.selectedCarNo === result.recommendedCar.carNo, `${scenario.id}: selectedCarNo must match recommendedCar`);
}

function assertComfortOnly(result: RecommendationResponse, scenario: Scenario) {
  assert(result.routeChoice.mode === 'COMFORT_ONLY', `${scenario.id}: expected COMFORT_ONLY`);
  assert(result.routeChoice.anchorCarNo === undefined, `${scenario.id}: COMFORT_ONLY must not expose anchorCarNo`);
  assert(result.routeChoice.anchorDoorNo === undefined, `${scenario.id}: COMFORT_ONLY must not expose anchorDoorNo`);

  const firstLeg = result.routeGuidance.legs[0];
  const shouldNotExposeDoor = firstLeg?.status !== 'available';
  if (shouldNotExposeDoor) {
    assert(!firstLeg?.anchorDoorNo, `${scenario.id}: unavailable route must not expose anchorDoorNo`);
    assert(!firstLeg?.recommendedDoorNo, `${scenario.id}: unavailable route must not expose recommendedDoorNo`);
  }
}

function validateScenario(result: RecommendationResponse, scenario: Scenario): ScenarioResult {
  assert(result.routeChoice.mode === scenario.expected.mode, `${scenario.id}: routeChoice.mode mismatch`);
  assert(result.routeGuidance.status === scenario.expected.guidanceStatus, `${scenario.id}: routeGuidance.status mismatch`);
  assert(result.routeGuidance.legs[0]?.status === scenario.expected.firstLegStatus, `${scenario.id}: first leg status mismatch`);
  if (scenario.expected.carCount) assert(result.cars.length === scenario.expected.carCount, `${scenario.id}: car count mismatch`);

  if (scenario.expected.mode === 'ANCHOR_WINDOW') assertAnchorWindow(result, scenario);
  else assertComfortOnly(result, scenario);

  assertNoForbiddenTerms(result, scenario);

  return {
    id: scenario.id,
    persona: scenario.persona,
    commuteStory: scenario.commuteStory,
    verdict: 'PASS',
    recommendedCarNo: result.recommendedCar.carNo,
    routeChoiceMode: result.routeChoice.mode,
    anchorCarNo: result.routeChoice.anchorCarNo,
    anchorDoorNo: result.routeChoice.anchorDoorNo,
    candidateCarNos: result.routeChoice.candidateCarNos,
    guidanceStatus: result.routeGuidance.status,
    firstLegStatus: result.routeGuidance.legs[0]?.status,
    firstLegLabel: result.routeGuidance.legs[0]?.positionLabel,
    reasonPreview: result.reasons.slice(0, 2),
  };
}

async function main() {
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    const result = await recommend(scenario.request);
    results.push(validateScenario(result, scenario));
  }

  const summary = {
    ok: true,
    total: results.length,
    anchorWindow: results.filter((r) => r.routeChoiceMode === 'ANCHOR_WINDOW').length,
    comfortOnly: results.filter((r) => r.routeChoiceMode === 'COMFORT_ONLY').length,
    scenarios: results,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
