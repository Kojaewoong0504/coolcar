import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildRoutePlanCandidates } from '../src/lib/routePlans';
import { estimateStationDistance, inferLineDirection, LINE_ORDERS } from '../src/lib/routeDirection';
import { recommend } from '../src/lib/recommendation';
import type { RecommendRequest, RecommendationResponse, RoutePlanCandidate, RoutePlansResponse } from '../src/lib/types';

type Severity = 'P0' | 'P1' | 'P2';
type Failure = {
  severity: Severity;
  code: string;
  message: string;
  caseId: string;
  candidateId?: string;
};

type MatrixCase = {
  id: string;
  originStation: string;
  destinationStation: string;
  line: string;
  destinationLine?: string;
  routeLines?: string[];
  transferStations?: string[];
  source: string;
};

const OUT_DIR = join(process.cwd(), 'artifacts');
const OUT_PATH = join(OUT_DIR, 'route-matrix-safety-report.json');
const INVENTORY_PATH = join(process.cwd(), 'data/door-guidance/transfer-inventory.json');
const FORBIDDEN_TEXT = ['최적 환승', '가장 빠른 환승', '공식 환승', '무조건 여기', '정확한 환승문', 'undefined', 'null'];

type InventoryPayload = {
  inventory: Array<{
    stationName: string;
    priority: 'P0' | 'P1' | 'P2';
    linePairs: Array<{ fromLine: string; toLine: string }>;
  }>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalizeStation(value: string) {
  return value.endsWith('역') ? value : `${value}역`;
}

function carCountForLine(line: string) {
  return line === '9호선' || line === '신분당선' ? 6 : 10;
}

function recordFailure(failures: Failure[], failure: Failure) {
  failures.push(failure);
}

function checkTextSafety(params: { failures: Failure[]; caseId: string; text: string }) {
  for (const word of FORBIDDEN_TEXT) {
    if (params.text.includes(word)) {
      recordFailure(params.failures, { severity: word === 'undefined' || word === 'null' ? 'P0' : 'P1', code: 'UNSAFE_VISIBLE_TEXT', caseId: params.caseId, message: `Unsafe text appeared: ${word}` });
    }
  }
}

function candidateExpectedLegCount(candidate: RoutePlanCandidate) {
  if (candidate.type === 'UNRESOLVED') return 1;
  return candidate.transferStations.length + 1;
}

function checkRouteCandidate(candidate: RoutePlanCandidate, caseId: string, failures: Failure[]) {
  if (candidate.legs.length !== candidateExpectedLegCount(candidate)) {
    recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_LEG_COUNT_MISMATCH', caseId, candidateId: candidate.id, message: `${candidate.title}: legs=${candidate.legs.length}, transfers=${candidate.transferStations.length}` });
  }
  if (candidate.legs[0]?.fromStation !== candidate.originStation) {
    recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_START_MISMATCH', caseId, candidateId: candidate.id, message: `${candidate.title}: first leg starts at ${candidate.legs[0]?.fromStation}` });
  }
  if (candidate.legs.at(-1)?.toStation !== candidate.destinationStation) {
    recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_END_MISMATCH', caseId, candidateId: candidate.id, message: `${candidate.title}: last leg ends at ${candidate.legs.at(-1)?.toStation}` });
  }
  for (let index = 0; index < candidate.legs.length - 1; index += 1) {
    if (candidate.legs[index].toStation !== candidate.legs[index + 1].fromStation) {
      recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_CONTINUITY_BROKEN', caseId, candidateId: candidate.id, message: `${candidate.title}: ${candidate.legs[index].toStation} -> ${candidate.legs[index + 1].fromStation}` });
    }
  }
  const expectedTransfers = candidate.legs.slice(0, -1).map((leg) => leg.toStation);
  if (expectedTransfers.join('>') !== candidate.transferStations.join('>')) {
    recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_TRANSFER_ORDER_MISMATCH', caseId, candidateId: candidate.id, message: `${candidate.title}: ${expectedTransfers.join('>')} vs ${candidate.transferStations.join('>')}` });
  }
  if (candidate.lines.length !== candidate.legs.length && candidate.type !== 'UNRESOLVED') {
    recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_LINE_COUNT_MISMATCH', caseId, candidateId: candidate.id, message: `${candidate.title}: lines=${candidate.lines.length}, legs=${candidate.legs.length}` });
  }
  candidate.lines.forEach((line, index) => {
    if (candidate.legs[index] && candidate.legs[index].line !== line) {
      recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_LINE_ORDER_MISMATCH', caseId, candidateId: candidate.id, message: `${candidate.title}: leg ${index + 1} line=${candidate.legs[index].line}, expected=${line}` });
    }
  });
  if (candidate.recommendRequestPatch.routeLines?.join('>') !== candidate.lines.join('>')) {
    recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_PATCH_LOSES_LINES', caseId, candidateId: candidate.id, message: `${candidate.title}: patch routeLines=${candidate.recommendRequestPatch.routeLines?.join('>')}, lines=${candidate.lines.join('>')}` });
  }
  if ((candidate.recommendRequestPatch.transferStations ?? []).join('>') !== candidate.transferStations.join('>')) {
    recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_PATCH_LOSES_TRANSFERS', caseId, candidateId: candidate.id, message: `${candidate.title}: patch transfers=${candidate.recommendRequestPatch.transferStations?.join('>')}, transfers=${candidate.transferStations.join('>')}` });
  }
  if (candidate.type !== 'UNRESOLVED' && candidate.lines.length) {
    const distances = candidate.legs.map((leg) => estimateStationDistance({ line: leg.line, originStation: leg.fromStation, targetStation: leg.toStation }));
    if (distances.every((distance) => typeof distance === 'number')) {
      const sum = distances.reduce((acc, distance) => acc + Number(distance), 0);
      if (candidate.estimatedStationCount !== sum) {
        recordFailure(failures, { severity: 'P1', code: 'ROUTE_PLAN_DISTANCE_MISMATCH', caseId, candidateId: candidate.id, message: `${candidate.title}: estimated=${candidate.estimatedStationCount}, sum=${sum}` });
      }
      if (candidate.type !== 'DIRECT' && distances.some((distance) => Number(distance) <= 0)) {
        recordFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_ZERO_DISTANCE_LEG', caseId, candidateId: candidate.id, message: `${candidate.title}: distances=${distances.join(',')}` });
      }
    }
  }
  checkTextSafety({ failures, caseId, text: [candidate.title, candidate.summary, candidate.badge, candidate.safetyNote].join('\n') });
}

function checkRoutePlan(plan: RoutePlansResponse, matrixCase: MatrixCase, failures: Failure[]) {
  if (plan.candidates.length === 0) {
    recordFailure(failures, { severity: 'P0', code: 'NO_ROUTE_PLAN_CANDIDATES', caseId: matrixCase.id, message: 'route plan returned no candidates' });
  }
  const ids = new Set<string>();
  for (const candidate of plan.candidates) {
    if (ids.has(candidate.id)) recordFailure(failures, { severity: 'P1', code: 'DUPLICATE_CANDIDATE_ID', caseId: matrixCase.id, candidateId: candidate.id, message: 'duplicate candidate id' });
    ids.add(candidate.id);
    checkRouteCandidate(candidate, matrixCase.id, failures);
  }
  const direct = plan.candidates.find((candidate) => candidate.type === 'DIRECT');
  if (direct) {
    for (const candidate of plan.candidates) {
      if (candidate.type !== 'DIRECT' && candidate.type !== 'USER_SPECIFIED' && typeof direct.estimatedStationCount === 'number' && typeof candidate.estimatedStationCount === 'number') {
        if (candidate.estimatedStationCount > Math.max(direct.estimatedStationCount + 3, Math.ceil(direct.estimatedStationCount * 1.25))) {
          recordFailure(failures, { severity: 'P1', code: 'DETOUR_SHOWN_WITH_DIRECT_ROUTE', caseId: matrixCase.id, candidateId: candidate.id, message: `${candidate.title}: detour ${candidate.estimatedStationCount} vs direct ${direct.estimatedStationCount}` });
        }
      }
    }
  }
}

function checkRecommendation(response: RecommendationResponse, matrixCase: MatrixCase, failures: Failure[]) {
  const request = response.request;
  if (request.routeLines && response.routeGuidance.legs.length !== ((request.transferStations?.length ?? 0) + 1)) {
    recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_LEG_COUNT_MISMATCH', caseId: matrixCase.id, message: `legs=${response.routeGuidance.legs.length}, transfers=${request.transferStations?.length ?? 0}` });
  }
  response.routeGuidance.legs.forEach((leg, index) => {
    const expectedLine = request.routeLines?.[index] ?? (index === 0 ? request.line : undefined);
    if (expectedLine && leg.line !== expectedLine) {
      recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_LINE_ORDER_MISMATCH', caseId: matrixCase.id, message: `leg ${index + 1}: ${leg.line} vs ${expectedLine}` });
    }
    const expectedFrom = [request.originStation, ...(request.transferStations ?? [])][index];
    const expectedTo = [...(request.transferStations ?? []), request.destinationStation].filter(Boolean)[index];
    if (expectedFrom && normalizeStation(leg.fromStation) !== normalizeStation(expectedFrom)) {
      recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_FROM_MISMATCH', caseId: matrixCase.id, message: `leg ${index + 1}: from ${leg.fromStation} vs ${expectedFrom}` });
    }
    if (expectedTo && normalizeStation(leg.toStation) !== normalizeStation(expectedTo)) {
      recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_TO_MISMATCH', caseId: matrixCase.id, message: `leg ${index + 1}: to ${leg.toStation} vs ${expectedTo}` });
    }
    const last = index === response.routeGuidance.legs.length - 1;
    const expectedGoal = last ? 'FINAL_EXIT' : 'NEXT_TRANSFER';
    if (leg.goal !== expectedGoal && leg.goal !== 'BOARD_AFTER_TRANSFER') {
      recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_GOAL_MISMATCH', caseId: matrixCase.id, message: `leg ${index + 1}: goal ${leg.goal} vs ${expectedGoal}` });
    }
    if (leg.status !== 'available' && (leg.recommendedDoorNo || leg.anchorDoorNo)) {
      recordFailure(failures, { severity: 'P0', code: 'UNVERIFIED_LEG_EXPOSES_DOOR', caseId: matrixCase.id, message: `leg ${index + 1}: status=${leg.status}, door=${leg.recommendedDoorNo ?? leg.anchorDoorNo}` });
    }
    if (leg.status === 'available' && leg.candidateCarNos?.length) {
      const maxCar = carCountForLine(leg.line);
      if (leg.candidateCarNos.some((carNo) => carNo < 1 || carNo > maxCar)) {
        recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_CANDIDATE_CAR_OUT_OF_RANGE', caseId: matrixCase.id, message: `leg ${index + 1}: ${leg.line} candidates=${leg.candidateCarNos.join(',')}` });
      }
      if (leg.recommendedCarNo && !leg.candidateCarNos.includes(leg.recommendedCarNo)) {
        recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_RECOMMENDED_OUTSIDE_CANDIDATES', caseId: matrixCase.id, message: `leg ${index + 1}: rec=${leg.recommendedCarNo}, candidates=${leg.candidateCarNos.join(',')}` });
      }
      if (leg.anchorDoorNo && (leg.anchorDoorNo < 1 || leg.anchorDoorNo > 4)) {
        recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_DOOR_OUT_OF_RANGE', caseId: matrixCase.id, message: `leg ${index + 1}: door=${leg.anchorDoorNo}` });
      }
      const anchorCars = leg.anchorCarNos?.length ? leg.anchorCarNos : leg.anchorCarNo ? [leg.anchorCarNo] : [];
      if (anchorCars.length) {
        const allowed = new Set(anchorCars.flatMap((anchorCarNo) => [anchorCarNo - 1, anchorCarNo, anchorCarNo + 1]).filter((carNo) => carNo >= 1 && carNo <= maxCar));
        if (leg.candidateCarNos.some((carNo) => !allowed.has(carNo))) {
          recordFailure(failures, { severity: 'P0', code: 'GUIDANCE_ANCHOR_WINDOW_TOO_WIDE', caseId: matrixCase.id, message: `leg ${index + 1}: anchors=${anchorCars.join(',')}, candidates=${leg.candidateCarNos.join(',')}` });
        }
      }
    }
    checkTextSafety({ failures, caseId: matrixCase.id, text: [leg.positionLabel, leg.message].join('\n') });
  });

  if (response.routeChoice.mode === 'ANCHOR_WINDOW') {
    if (!response.routeChoice.candidateCarNos.includes(response.routeChoice.selectedCarNo)) {
      recordFailure(failures, { severity: 'P0', code: 'ROUTE_CHOICE_SELECTED_OUTSIDE_CANDIDATES', caseId: matrixCase.id, message: `selected=${response.routeChoice.selectedCarNo}, candidates=${response.routeChoice.candidateCarNos.join(',')}` });
    }
    if (response.recommendedCar.carNo !== response.routeChoice.selectedCarNo) {
      recordFailure(failures, { severity: 'P0', code: 'RECOMMENDED_ROUTE_CHOICE_MISMATCH', caseId: matrixCase.id, message: `recommended=${response.recommendedCar.carNo}, selected=${response.routeChoice.selectedCarNo}` });
    }
    if (!response.routeChoice.anchorCarNo || !response.routeChoice.station) {
      recordFailure(failures, { severity: 'P0', code: 'ANCHOR_WINDOW_WITHOUT_ANCHOR', caseId: matrixCase.id, message: 'ANCHOR_WINDOW missing anchor fields' });
    }
    if (response.routeChoice.anchorDoorNo && (response.routeChoice.anchorDoorNo < 1 || response.routeChoice.anchorDoorNo > 4)) {
      recordFailure(failures, { severity: 'P0', code: 'ROUTE_CHOICE_DOOR_OUT_OF_RANGE', caseId: matrixCase.id, message: `door=${response.routeChoice.anchorDoorNo}` });
    }
    const maxCar = carCountForLine(request.line);
    if (response.routeChoice.candidateCarNos.some((carNo) => carNo < 1 || carNo > maxCar)) {
      recordFailure(failures, { severity: 'P0', code: 'ROUTE_CHOICE_CAR_OUT_OF_RANGE', caseId: matrixCase.id, message: `line=${request.line}, candidates=${response.routeChoice.candidateCarNos.join(',')}` });
    }
    const anchorCars = response.routeChoice.anchorCarNos?.length ? response.routeChoice.anchorCarNos : response.routeChoice.anchorCarNo ? [response.routeChoice.anchorCarNo] : [];
    if (anchorCars.length) {
      const allowed = new Set(anchorCars.flatMap((anchorCarNo) => [anchorCarNo - 1, anchorCarNo, anchorCarNo + 1]).filter((carNo) => carNo >= 1 && carNo <= maxCar));
      if (response.routeChoice.candidateCarNos.some((carNo) => !allowed.has(carNo))) {
        recordFailure(failures, { severity: 'P0', code: 'ROUTE_CHOICE_ANCHOR_WINDOW_TOO_WIDE', caseId: matrixCase.id, message: `anchors=${anchorCars.join(',')}, candidates=${response.routeChoice.candidateCarNos.join(',')}` });
      }
    }
  } else {
    if (response.routeChoice.anchorCarNo || response.routeChoice.anchorDoorNo) {
      recordFailure(failures, { severity: 'P0', code: 'COMFORT_ONLY_EXPOSES_ANCHOR', caseId: matrixCase.id, message: `anchor=${response.routeChoice.anchorCarNo}-${response.routeChoice.anchorDoorNo}` });
    }
  }
  checkTextSafety({ failures, caseId: matrixCase.id, text: [response.routeChoice.message, response.routeGuidance.summary, response.routeGuidance.disclaimer, ...response.reasons, response.safetyNotice].join('\n') });
}

function sampleLinePairs(): MatrixCase[] {
  const cases: MatrixCase[] = [];
  const offsets = [1, 2, 3, 5, 8, 13, 21, -1, -2, -3, -5, -8, -13, -21];
  for (const [line, config] of Object.entries(LINE_ORDERS)) {
    const stations = config.stations;
    for (let originIndex = 0; originIndex < stations.length; originIndex += 1) {
      for (const offset of offsets) {
        let destinationIndex = originIndex + offset;
        if (config.circular) destinationIndex = (destinationIndex + stations.length) % stations.length;
        if (destinationIndex < 0 || destinationIndex >= stations.length || destinationIndex === originIndex) continue;
        cases.push({
          id: `direct:${line}:${stations[originIndex]}:${stations[destinationIndex]}`,
          originStation: stations[originIndex],
          destinationStation: stations[destinationIndex],
          line,
          destinationLine: line,
          source: 'direct-line-offset-matrix',
        });
      }
    }
  }
  return cases;
}

function neighborOnLine(line: string, stationName: string, delta: -1 | 1) {
  const order = LINE_ORDERS[line]?.stations;
  if (!order) return undefined;
  const index = order.findIndex((station) => normalizeStation(station) === normalizeStation(stationName));
  if (index < 0) return undefined;
  const targetIndex = index + delta;
  if (targetIndex >= 0 && targetIndex < order.length) return order[targetIndex];
  return order[index - delta];
}

function inventoryTransferCases(): MatrixCase[] {
  const payload = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as InventoryPayload;
  const cases: MatrixCase[] = [];
  for (const station of payload.inventory) {
    for (const pair of station.linePairs) {
      const originStation = neighborOnLine(pair.fromLine, station.stationName, -1);
      const destinationStation = neighborOnLine(pair.toLine, station.stationName, 1);
      if (!originStation || !destinationStation) continue;
      cases.push({
        id: `inventory:${station.priority}:${station.stationName}:${pair.fromLine}:${pair.toLine}`,
        originStation,
        destinationStation,
        line: pair.fromLine,
        destinationLine: pair.toLine,
        transferStations: [station.stationName],
        routeLines: [pair.fromLine, pair.toLine],
        source: `inventory-${station.priority}`,
      });
    }
  }
  return cases;
}

const criticalCases: MatrixCase[] = [
  { id: 'critical:gudi-daehwa-via-hongdae-daegok', originStation: '구로디지털단지역', destinationStation: '대화역', line: '2호선', destinationLine: '3호선', transferStations: ['홍대입구역', '대곡역'], routeLines: ['2호선', '경의중앙선', '3호선'], source: 'critical-multi-transfer' },
  { id: 'critical:gudi-olympicpark-route-plans', originStation: '구로디지털단지역', destinationStation: '올림픽공원역', line: '2호선', destinationLine: '9호선', source: 'critical-route-plan' },
  { id: 'critical:gudi-olympicpark-via-dangsan', originStation: '구로디지털단지역', destinationStation: '올림픽공원역', line: '2호선', destinationLine: '9호선', transferStations: ['당산역'], routeLines: ['2호선', '9호선'], source: 'critical-user-transfer' },
  { id: 'critical:gudi-olympicpark-via-sportscomplex', originStation: '구로디지털단지역', destinationStation: '올림픽공원역', line: '2호선', destinationLine: '9호선', transferStations: ['종합운동장역'], routeLines: ['2호선', '9호선'], source: 'critical-user-transfer' },
  { id: 'critical:yeoksam-pangyo-via-gangnam', originStation: '역삼역', destinationStation: '판교역', line: '2호선', destinationLine: '신분당선', transferStations: ['강남역'], routeLines: ['2호선', '신분당선'], source: 'critical-user-transfer' },
  { id: 'critical:baebang-gudi', originStation: '배방역', destinationStation: '구로디지털단지역', line: '1호선', destinationLine: '2호선', source: 'critical-route-plan-ranking' },
  { id: 'critical:namyeong-seoul', originStation: '남영역', destinationStation: '서울역', line: '1호선', destinationLine: '1호선', source: 'critical-final-exit' },
];

function pickCandidateForRecommendation(plan: RoutePlansResponse) {
  return plan.candidates.find((candidate) => candidate.type !== 'UNRESOLVED') ?? plan.candidates[0];
}

async function runCase(matrixCase: MatrixCase, failures: Failure[]) {
  const plan = await buildRoutePlanCandidates({
    line: matrixCase.line,
    originStation: matrixCase.originStation,
    destinationStation: matrixCase.destinationStation,
    destinationLine: matrixCase.destinationLine,
    transferStations: matrixCase.transferStations,
    routeLines: matrixCase.routeLines,
    maxCandidates: 6,
  });
  checkRoutePlan(plan, matrixCase, failures);

  const selected = matrixCase.transferStations?.length
    ? undefined
    : pickCandidateForRecommendation(plan);
  const patch: Partial<RoutePlanCandidate['recommendRequestPatch']> = selected?.recommendRequestPatch ?? {};
  const request: RecommendRequest = {
    line: matrixCase.line,
    originStation: matrixCase.originStation,
    destinationStation: matrixCase.destinationStation,
    destinationLine: matrixCase.destinationLine,
    transferStations: matrixCase.transferStations ?? patch.transferStations,
    routeLines: matrixCase.routeLines ?? patch.routeLines,
    direction: patch.direction,
    comfortType: 'HOT_SENSITIVE',
  };
  const response = await recommend(request);
  checkRecommendation(response, matrixCase, failures);
  return { candidateCount: plan.candidates.length, selectedCandidateId: selected?.id, routeChoiceMode: response.routeChoice.mode, guidanceStatus: response.routeGuidance.status };
}

async function main() {
  const generatedCases = [...inventoryTransferCases(), ...sampleLinePairs()];
  const seen = new Set<string>();
  const cases = [...criticalCases, ...generatedCases]
    .filter((matrixCase) => {
      if (seen.has(matrixCase.id)) return false;
      seen.add(matrixCase.id);
      return true;
    })
    .slice(0, 1400);
  const failures: Failure[] = [];
  const results = [];
  for (const matrixCase of cases) {
    try {
      results.push({ caseId: matrixCase.id, source: matrixCase.source, ...(await runCase(matrixCase, failures)) });
    } catch (error) {
      recordFailure(failures, { severity: 'P0', code: 'CASE_RUNTIME_ERROR', caseId: matrixCase.id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const failureCounts = {
    P0: failures.filter((failure) => failure.severity === 'P0').length,
    P1: failures.filter((failure) => failure.severity === 'P1').length,
    P2: failures.filter((failure) => failure.severity === 'P2').length,
  };
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    totalCases: cases.length,
    failureCounts,
    failures,
    samples: results.slice(0, 30),
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  assert(failureCounts.P0 === 0, `route matrix P0 failures: ${failureCounts.P0}. See ${OUT_PATH}`);
  console.log(JSON.stringify({ ok: true, reportPath: OUT_PATH, totalCases: cases.length, failureCounts, sampleResults: results.slice(0, 8) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
