import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildRoutePlanCandidates } from '../src/lib/routePlans';
import { estimateStationDistance, LINE_ORDERS } from '../src/lib/routeDirection';
import { recommend } from '../src/lib/recommendation';
import type { RecommendRequest, RecommendationResponse, RoutePlanCandidate, RoutePlansResponse } from '../src/lib/types';

type Severity = 'P0' | 'P1' | 'P2';
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
type Failure = { severity: Severity; code: string; message: string; caseId: string; candidateId?: string };
type InventoryPayload = {
  inventory: Array<{
    stationName: string;
    priority: 'P0' | 'P1' | 'P2';
    linePairs: Array<{ fromLine: string; toLine: string }>;
  }>;
};

type CaseResult = {
  caseId: string;
  source: string;
  candidateCount: number;
  candidateTypes: string[];
  selectedCandidateId?: string;
  selectedCandidateType?: string;
  routeChoiceMode: string;
  guidanceStatus: string;
  legCount: number;
};

const OUT_DIR = join(process.cwd(), 'artifacts');
const OUT_PATH = join(OUT_DIR, 'large-transfer-matrix-report.json');
const INVENTORY_PATH = join(process.cwd(), 'data/door-guidance/transfer-inventory.json');
const DEFAULT_LIMIT = Number(process.env.ROUTE_MATRIX_LIMIT ?? 5000);
const FORBIDDEN_TEXT = ['최적 환승', '가장 빠른 환승', '공식 환승', '무조건 여기', '정확한 환승문', '확정 환승', '보장', 'undefined', 'null'];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalizeStation(value?: string) {
  if (!value) return '';
  return value.endsWith('역') ? value : `${value}역`;
}

function carCountForLine(line: string) {
  return line === '9호선' || line === '신분당선' ? 6 : 10;
}

function addFailure(failures: Failure[], failure: Failure) {
  failures.push(failure);
}

function checkTextSafety(failures: Failure[], caseId: string, text: string) {
  for (const word of FORBIDDEN_TEXT) {
    if (text.includes(word)) addFailure(failures, { severity: word === 'undefined' || word === 'null' ? 'P0' : 'P1', code: 'UNSAFE_VISIBLE_TEXT', caseId, message: `Unsafe visible text: ${word}` });
  }
}

function neighborsOnLine(line: string, stationName: string, radius = 3) {
  const order = LINE_ORDERS[line]?.stations;
  if (!order) return [];
  const index = order.findIndex((station) => normalizeStation(station) === normalizeStation(stationName));
  if (index < 0) return [];
  const values: string[] = [];
  for (const delta of [-radius, -2, -1, 1, 2, radius]) {
    const target = index + delta;
    if (target >= 0 && target < order.length) values.push(order[target]);
  }
  return [...new Set(values)];
}

function checkRouteCandidate(candidate: RoutePlanCandidate, matrixCase: MatrixCase, failures: Failure[]) {
  const expectedLegCount = candidate.type === 'UNRESOLVED' ? 1 : candidate.transferStations.length + 1;
  if (candidate.legs.length !== expectedLegCount) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_LEG_COUNT_MISMATCH', caseId: matrixCase.id, candidateId: candidate.id, message: `legs=${candidate.legs.length}, expected=${expectedLegCount}` });
  if (candidate.legs[0]?.fromStation !== candidate.originStation) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_START_MISMATCH', caseId: matrixCase.id, candidateId: candidate.id, message: `first leg starts at ${candidate.legs[0]?.fromStation}` });
  if (candidate.legs.at(-1)?.toStation !== candidate.destinationStation) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_END_MISMATCH', caseId: matrixCase.id, candidateId: candidate.id, message: `last leg ends at ${candidate.legs.at(-1)?.toStation}` });
  for (let index = 0; index < candidate.legs.length - 1; index += 1) {
    if (candidate.legs[index].toStation !== candidate.legs[index + 1].fromStation) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_CONTINUITY_BROKEN', caseId: matrixCase.id, candidateId: candidate.id, message: `${candidate.legs[index].toStation} -> ${candidate.legs[index + 1].fromStation}` });
  }
  const expectedTransfers = candidate.legs.slice(0, -1).map((leg) => leg.toStation);
  if (expectedTransfers.join('>') !== candidate.transferStations.join('>')) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_TRANSFER_ORDER_MISMATCH', caseId: matrixCase.id, candidateId: candidate.id, message: `${expectedTransfers.join('>')} vs ${candidate.transferStations.join('>')}` });
  if (candidate.type !== 'UNRESOLVED' && candidate.lines.length !== candidate.legs.length) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_LINE_COUNT_MISMATCH', caseId: matrixCase.id, candidateId: candidate.id, message: `lines=${candidate.lines.length}, legs=${candidate.legs.length}` });
  candidate.lines.forEach((line, index) => {
    if (candidate.legs[index] && candidate.legs[index].line !== line) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_LINE_ORDER_MISMATCH', caseId: matrixCase.id, candidateId: candidate.id, message: `leg ${index + 1}: ${candidate.legs[index].line} vs ${line}` });
  });
  if (candidate.type !== 'UNRESOLVED' && candidate.recommendRequestPatch.routeLines?.join('>') !== candidate.lines.join('>')) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_PATCH_LOSES_LINES', caseId: matrixCase.id, candidateId: candidate.id, message: `patch=${candidate.recommendRequestPatch.routeLines?.join('>')} lines=${candidate.lines.join('>')}` });
  if ((candidate.recommendRequestPatch.transferStations ?? []).join('>') !== candidate.transferStations.join('>')) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_PATCH_LOSES_TRANSFERS', caseId: matrixCase.id, candidateId: candidate.id, message: `patch=${candidate.recommendRequestPatch.transferStations?.join('>')} transfers=${candidate.transferStations.join('>')}` });
  if (candidate.type === 'TWO_TRANSFER' && (candidate.legs.length !== 3 || candidate.lines.length !== 3 || candidate.transferStations.length !== 2)) addFailure(failures, { severity: 'P0', code: 'TWO_TRANSFER_LEG_COUNT_MISMATCH', caseId: matrixCase.id, candidateId: candidate.id, message: `legs=${candidate.legs.length}, lines=${candidate.lines.length}, transfers=${candidate.transferStations.length}` });
  if (candidate.type !== 'UNRESOLVED') {
    const distances = candidate.legs.map((leg) => estimateStationDistance({ line: leg.line, originStation: leg.fromStation, targetStation: leg.toStation }));
    if (distances.every((distance) => typeof distance === 'number')) {
      const sum = distances.reduce((acc, distance) => acc + Number(distance), 0);
      if (candidate.estimatedStationCount !== sum) addFailure(failures, { severity: 'P1', code: 'ROUTE_PLAN_DISTANCE_MISMATCH', caseId: matrixCase.id, candidateId: candidate.id, message: `estimated=${candidate.estimatedStationCount}, sum=${sum}` });
      if (distances.some((distance) => Number(distance) <= 0)) addFailure(failures, { severity: 'P0', code: 'ROUTE_PLAN_ZERO_DISTANCE_LEG', caseId: matrixCase.id, candidateId: candidate.id, message: `distances=${distances.join(',')}` });
    }
  }
  checkTextSafety(failures, matrixCase.id, [candidate.title, candidate.summary, candidate.badge, candidate.safetyNote].join('\n'));
}

function checkRoutePlan(plan: RoutePlansResponse, matrixCase: MatrixCase, failures: Failure[]) {
  if (plan.candidates.length === 0) addFailure(failures, { severity: 'P0', code: 'NO_ROUTE_PLAN_CANDIDATES', caseId: matrixCase.id, message: 'route plan returned no candidates' });
  const ids = new Set<string>();
  for (const candidate of plan.candidates) {
    if (ids.has(candidate.id)) addFailure(failures, { severity: 'P1', code: 'DUPLICATE_CANDIDATE_ID', caseId: matrixCase.id, candidateId: candidate.id, message: 'duplicate candidate id' });
    ids.add(candidate.id);
    checkRouteCandidate(candidate, matrixCase, failures);
  }
  const direct = plan.candidates.find((candidate) => candidate.type === 'DIRECT');
  if (direct && typeof direct.estimatedStationCount === 'number') {
    for (const candidate of plan.candidates) {
      if (candidate.type !== 'DIRECT' && candidate.type !== 'USER_SPECIFIED' && typeof candidate.estimatedStationCount === 'number') {
        if (candidate.estimatedStationCount > Math.max(direct.estimatedStationCount + 3, Math.ceil(direct.estimatedStationCount * 1.25))) addFailure(failures, { severity: 'P1', code: 'DETOUR_SHOWN_WITH_DIRECT_ROUTE', caseId: matrixCase.id, candidateId: candidate.id, message: `${candidate.title}: ${candidate.estimatedStationCount} vs direct ${direct.estimatedStationCount}` });
      }
    }
  }
}

function checkRecommendation(response: RecommendationResponse, matrixCase: MatrixCase, failures: Failure[]) {
  const request = response.request;
  if (request.routeLines && response.routeGuidance.legs.length !== ((request.transferStations?.length ?? 0) + 1)) addFailure(failures, { severity: 'P0', code: 'GUIDANCE_LEG_COUNT_MISMATCH', caseId: matrixCase.id, message: `legs=${response.routeGuidance.legs.length}, transfers=${request.transferStations?.length ?? 0}` });
  response.routeGuidance.legs.forEach((leg, index) => {
    const expectedLine = request.routeLines?.[index] ?? (index === 0 ? request.line : undefined);
    if (expectedLine && leg.line !== expectedLine) addFailure(failures, { severity: 'P0', code: 'GUIDANCE_LINE_ORDER_MISMATCH', caseId: matrixCase.id, message: `leg ${index + 1}: ${leg.line} vs ${expectedLine}` });
    const expectedFrom = [request.originStation, ...(request.transferStations ?? [])][index];
    const expectedTo = [...(request.transferStations ?? []), request.destinationStation].filter(Boolean)[index];
    if (expectedFrom && normalizeStation(leg.fromStation) !== normalizeStation(expectedFrom)) addFailure(failures, { severity: 'P0', code: 'GUIDANCE_FROM_MISMATCH', caseId: matrixCase.id, message: `leg ${index + 1}: ${leg.fromStation} vs ${expectedFrom}` });
    if (expectedTo && normalizeStation(leg.toStation) !== normalizeStation(expectedTo)) addFailure(failures, { severity: 'P0', code: 'GUIDANCE_TO_MISMATCH', caseId: matrixCase.id, message: `leg ${index + 1}: ${leg.toStation} vs ${expectedTo}` });
    const last = index === response.routeGuidance.legs.length - 1;
    const expectedGoal = last ? 'FINAL_EXIT' : 'NEXT_TRANSFER';
    if (leg.goal !== expectedGoal && leg.goal !== 'BOARD_AFTER_TRANSFER') addFailure(failures, { severity: 'P0', code: 'GUIDANCE_GOAL_MISMATCH', caseId: matrixCase.id, message: `leg ${index + 1}: ${leg.goal} vs ${expectedGoal}` });
    if (leg.status !== 'available' && (leg.recommendedDoorNo || leg.anchorDoorNo)) addFailure(failures, { severity: 'P0', code: 'UNVERIFIED_LEG_EXPOSES_DOOR', caseId: matrixCase.id, message: `leg ${index + 1}: status=${leg.status}, door=${leg.recommendedDoorNo ?? leg.anchorDoorNo}` });
    if (leg.status === 'available' && leg.candidateCarNos?.length) {
      const maxCar = carCountForLine(leg.line);
      if (leg.candidateCarNos.some((carNo) => carNo < 1 || carNo > maxCar)) addFailure(failures, { severity: 'P0', code: 'GUIDANCE_CANDIDATE_CAR_OUT_OF_RANGE', caseId: matrixCase.id, message: `leg ${index + 1}: ${leg.line} candidates=${leg.candidateCarNos.join(',')}` });
      if (leg.recommendedCarNo && !leg.candidateCarNos.includes(leg.recommendedCarNo)) addFailure(failures, { severity: 'P0', code: 'GUIDANCE_RECOMMENDED_OUTSIDE_CANDIDATES', caseId: matrixCase.id, message: `leg ${index + 1}: rec=${leg.recommendedCarNo}, candidates=${leg.candidateCarNos.join(',')}` });
      if (leg.anchorDoorNo && (leg.anchorDoorNo < 1 || leg.anchorDoorNo > 4)) addFailure(failures, { severity: 'P0', code: 'GUIDANCE_DOOR_OUT_OF_RANGE', caseId: matrixCase.id, message: `leg ${index + 1}: door=${leg.anchorDoorNo}` });
      const anchors = leg.anchorCarNos?.length ? leg.anchorCarNos : leg.anchorCarNo ? [leg.anchorCarNo] : [];
      if (anchors.length) {
        const allowed = new Set(anchors.flatMap((carNo) => [carNo - 1, carNo, carNo + 1]).filter((carNo) => carNo >= 1 && carNo <= maxCar));
        if (leg.candidateCarNos.some((carNo) => !allowed.has(carNo))) addFailure(failures, { severity: 'P0', code: 'GUIDANCE_ANCHOR_WINDOW_TOO_WIDE', caseId: matrixCase.id, message: `leg ${index + 1}: anchors=${anchors.join(',')}, candidates=${leg.candidateCarNos.join(',')}` });
      }
    }
    checkTextSafety(failures, matrixCase.id, [leg.positionLabel, leg.message].join('\n'));
  });

  if (response.routeChoice.mode === 'ANCHOR_WINDOW') {
    if (!response.routeChoice.candidateCarNos.includes(response.routeChoice.selectedCarNo)) addFailure(failures, { severity: 'P0', code: 'ROUTE_CHOICE_SELECTED_OUTSIDE_CANDIDATES', caseId: matrixCase.id, message: `selected=${response.routeChoice.selectedCarNo}, candidates=${response.routeChoice.candidateCarNos.join(',')}` });
    if (response.recommendedCar.carNo !== response.routeChoice.selectedCarNo) addFailure(failures, { severity: 'P0', code: 'RECOMMENDED_ROUTE_CHOICE_MISMATCH', caseId: matrixCase.id, message: `recommended=${response.recommendedCar.carNo}, selected=${response.routeChoice.selectedCarNo}` });
    if (!response.routeChoice.anchorCarNo || !response.routeChoice.station) addFailure(failures, { severity: 'P0', code: 'ANCHOR_WINDOW_WITHOUT_ANCHOR', caseId: matrixCase.id, message: 'ANCHOR_WINDOW missing anchor fields' });
    if (response.routeChoice.anchorDoorNo && (response.routeChoice.anchorDoorNo < 1 || response.routeChoice.anchorDoorNo > 4)) addFailure(failures, { severity: 'P0', code: 'ROUTE_CHOICE_DOOR_OUT_OF_RANGE', caseId: matrixCase.id, message: `door=${response.routeChoice.anchorDoorNo}` });
    const maxCar = carCountForLine(request.line);
    if (response.routeChoice.candidateCarNos.some((carNo) => carNo < 1 || carNo > maxCar)) addFailure(failures, { severity: 'P0', code: 'ROUTE_CHOICE_CAR_OUT_OF_RANGE', caseId: matrixCase.id, message: `line=${request.line}, candidates=${response.routeChoice.candidateCarNos.join(',')}` });
    const anchors = response.routeChoice.anchorCarNos?.length ? response.routeChoice.anchorCarNos : response.routeChoice.anchorCarNo ? [response.routeChoice.anchorCarNo] : [];
    if (anchors.length) {
      const allowed = new Set(anchors.flatMap((carNo) => [carNo - 1, carNo, carNo + 1]).filter((carNo) => carNo >= 1 && carNo <= maxCar));
      if (response.routeChoice.candidateCarNos.some((carNo) => !allowed.has(carNo))) addFailure(failures, { severity: 'P0', code: 'ROUTE_CHOICE_ANCHOR_WINDOW_TOO_WIDE', caseId: matrixCase.id, message: `anchors=${anchors.join(',')}, candidates=${response.routeChoice.candidateCarNos.join(',')}` });
    }
  } else if (response.routeChoice.anchorCarNo || response.routeChoice.anchorDoorNo) {
    addFailure(failures, { severity: 'P0', code: 'COMFORT_ONLY_EXPOSES_ANCHOR', caseId: matrixCase.id, message: `anchor=${response.routeChoice.anchorCarNo}-${response.routeChoice.anchorDoorNo}` });
  }
  checkTextSafety(failures, matrixCase.id, [response.routeChoice.message, response.routeGuidance.summary, response.routeGuidance.disclaimer, ...response.reasons, response.safetyNotice].join('\n'));
}

function inventoryExplicitTransferCases(): MatrixCase[] {
  const payload = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as InventoryPayload;
  const cases: MatrixCase[] = [];
  for (const station of payload.inventory) {
    for (const pair of station.linePairs) {
      const origins = neighborsOnLine(pair.fromLine, station.stationName, 3);
      const destinations = neighborsOnLine(pair.toLine, station.stationName, 3);
      for (const originStation of origins) {
        for (const destinationStation of destinations) {
          if (normalizeStation(originStation) === normalizeStation(station.stationName) || normalizeStation(destinationStation) === normalizeStation(station.stationName)) continue;
          cases.push({
            id: `explicit:${station.priority}:${station.stationName}:${pair.fromLine}:${pair.toLine}:${originStation}:${destinationStation}`,
            originStation,
            destinationStation,
            line: pair.fromLine,
            destinationLine: pair.toLine,
            transferStations: [station.stationName],
            routeLines: [pair.fromLine, pair.toLine],
            source: `inventory-explicit-${station.priority}`,
          });
        }
      }
    }
  }
  return cases;
}

function autoDiscoveryCases(): MatrixCase[] {
  const payload = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as InventoryPayload;
  const cases: MatrixCase[] = [];
  const seenLinePairs = new Set<string>();
  for (const station of payload.inventory) {
    for (const pair of station.linePairs) {
      const linePairKey = `${pair.fromLine}>${pair.toLine}`;
      if (seenLinePairs.has(linePairKey)) continue;
      seenLinePairs.add(linePairKey);
      const origins = neighborsOnLine(pair.fromLine, station.stationName, 4).slice(0, 3);
      const destinations = neighborsOnLine(pair.toLine, station.stationName, 4).slice(-3);
      for (const originStation of origins) {
        for (const destinationStation of destinations) {
          cases.push({
            id: `auto:${pair.fromLine}:${pair.toLine}:${originStation}:${destinationStation}`,
            originStation,
            destinationStation,
            line: pair.fromLine,
            destinationLine: pair.toLine,
            source: 'auto-transfer-discovery',
          });
        }
      }
    }
  }
  return cases;
}

function directBaselineCases(): MatrixCase[] {
  const cases: MatrixCase[] = [];
  const offsets = [1, 2, 3, 5, 8, 13, 21, -1, -2, -3, -5, -8, -13, -21];
  for (const [line, config] of Object.entries(LINE_ORDERS)) {
    for (let originIndex = 0; originIndex < config.stations.length; originIndex += 1) {
      for (const offset of offsets) {
        let destinationIndex = originIndex + offset;
        if (config.circular) destinationIndex = (destinationIndex + config.stations.length) % config.stations.length;
        if (destinationIndex < 0 || destinationIndex >= config.stations.length || destinationIndex === originIndex) continue;
        cases.push({
          id: `direct:${line}:${config.stations[originIndex]}:${config.stations[destinationIndex]}`,
          originStation: config.stations[originIndex],
          destinationStation: config.stations[destinationIndex],
          line,
          destinationLine: line,
          source: 'direct-baseline',
        });
      }
    }
  }
  return cases;
}

const criticalCases: MatrixCase[] = [
  { id: 'critical:gudi-daehwa-via-hongdae-daegok', originStation: '구로디지털단지역', destinationStation: '대화역', line: '2호선', destinationLine: '3호선', transferStations: ['홍대입구역', '대곡역'], routeLines: ['2호선', '경의중앙선', '3호선'], source: 'critical-two-transfer' },
  { id: 'critical:gudi-daehwa-auto', originStation: '구로디지털단지역', destinationStation: '대화역', line: '2호선', destinationLine: '3호선', source: 'critical-auto-two-transfer' },
  { id: 'critical:gudi-olympicpark-via-dangsan', originStation: '구로디지털단지역', destinationStation: '올림픽공원역', line: '2호선', destinationLine: '9호선', transferStations: ['당산역'], routeLines: ['2호선', '9호선'], source: 'critical-one-transfer' },
  { id: 'critical:gudi-olympicpark-via-sportscomplex', originStation: '구로디지털단지역', destinationStation: '올림픽공원역', line: '2호선', destinationLine: '9호선', transferStations: ['종합운동장역'], routeLines: ['2호선', '9호선'], source: 'critical-one-transfer' },
  { id: 'critical:hongdae-airport', originStation: '신촌역', destinationStation: '인천공항1터미널역', line: '2호선', destinationLine: '공항철도', transferStations: ['홍대입구역'], routeLines: ['2호선', '공항철도'], source: 'critical-curated-transfer' },
  { id: 'critical:yeoksam-pangyo-via-gangnam', originStation: '역삼역', destinationStation: '판교역', line: '2호선', destinationLine: '신분당선', transferStations: ['강남역'], routeLines: ['2호선', '신분당선'], source: 'critical-one-transfer' },
  { id: 'critical:baebang-gudi-auto', originStation: '배방역', destinationStation: '구로디지털단지역', line: '1호선', destinationLine: '2호선', source: 'critical-ranking' },
  { id: 'critical:namyeong-seoul', originStation: '남영역', destinationStation: '서울역', line: '1호선', destinationLine: '1호선', source: 'critical-final-exit' },
];

function selectCandidate(plan: RoutePlansResponse) {
  return plan.candidates.find((candidate) => candidate.type !== 'UNRESOLVED') ?? plan.candidates[0];
}

async function runCase(matrixCase: MatrixCase, failures: Failure[]): Promise<CaseResult> {
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

  if (matrixCase.source.includes('critical-auto-two-transfer')) {
    const first = plan.candidates[0];
    if (first?.type !== 'TWO_TRANSFER') addFailure(failures, { severity: 'P0', code: 'CRITICAL_TWO_TRANSFER_NOT_PRIORITIZED', caseId: matrixCase.id, candidateId: first?.id, message: `first=${first?.type}:${first?.title}` });
  }

  const selected = matrixCase.transferStations?.length ? undefined : selectCandidate(plan);
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
  return {
    caseId: matrixCase.id,
    source: matrixCase.source,
    candidateCount: plan.candidates.length,
    candidateTypes: plan.candidates.map((candidate) => candidate.type),
    selectedCandidateId: selected?.id,
    selectedCandidateType: selected?.type,
    routeChoiceMode: response.routeChoice.mode,
    guidanceStatus: response.routeGuidance.status,
    legCount: response.routeGuidance.legs.length,
  };
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function balancedSample(groups: MatrixCase[][], limit: number) {
  const seen = new Set<string>();
  const cases: MatrixCase[] = [];
  for (const matrixCase of criticalCases) {
    if (!seen.has(matrixCase.id)) {
      seen.add(matrixCase.id);
      cases.push(matrixCase);
    }
  }
  let cursor = 0;
  while (cases.length < limit) {
    let added = false;
    for (const group of groups) {
      while (cursor < group.length && seen.has(group[cursor].id)) cursor += 1;
      const candidate = group[cursor];
      if (candidate && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        cases.push(candidate);
        added = true;
        if (cases.length >= limit) break;
      }
    }
    cursor += 1;
    if (!added && groups.every((group) => cursor >= group.length)) break;
  }
  return cases;
}

async function main() {
  const explicit = inventoryExplicitTransferCases();
  const auto = autoDiscoveryCases();
  const direct = directBaselineCases();
  const allCases = [...criticalCases, ...explicit, ...auto, ...direct];
  const cases = balancedSample([explicit, auto, direct], DEFAULT_LIMIT);

  const failures: Failure[] = [];
  const results: CaseResult[] = [];
  for (const matrixCase of cases) {
    try {
      results.push(await runCase(matrixCase, failures));
    } catch (error) {
      addFailure(failures, { severity: 'P0', code: 'CASE_RUNTIME_ERROR', caseId: matrixCase.id, message: error instanceof Error ? error.message : String(error) });
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
    totalGeneratedCases: allCases.length,
    totalCases: cases.length,
    caseCountsBySource: countBy(cases.map((matrixCase) => matrixCase.source)),
    candidateTypeCounts: countBy(results.flatMap((result) => result.candidateTypes)),
    selectedCandidateTypeCounts: countBy(results.map((result) => result.selectedCandidateType ?? 'explicit-request')),
    routeChoiceModeCounts: countBy(results.map((result) => result.routeChoiceMode)),
    guidanceStatusCounts: countBy(results.map((result) => result.guidanceStatus)),
    failureCounts,
    topFailureCodes: countBy(failures.map((failure) => `${failure.severity}:${failure.code}`)),
    failures,
    samples: results.slice(0, 50),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  assert(failureCounts.P0 === 0, `large transfer matrix P0 failures: ${failureCounts.P0}. See ${OUT_PATH}`);
  console.log(JSON.stringify({ ok: true, reportPath: OUT_PATH, totalGeneratedCases: allCases.length, totalCases: cases.length, failureCounts, caseCountsBySource: report.caseCountsBySource, routeChoiceModeCounts: report.routeChoiceModeCounts, guidanceStatusCounts: report.guidanceStatusCounts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
