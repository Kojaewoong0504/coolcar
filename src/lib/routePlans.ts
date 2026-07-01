import { STATIONS, isSearchableMetroStation, normalizeStationName } from './stations';
import { lookupDoorGuide } from './doorGuidance/resolver';
import { inferLineDirection, estimateStationDistance, LINE_ORDERS } from './routeDirection';
import type { ComfortType, EgressPreference, RoutePlanCandidate, RoutePlanCoverageStatus, RoutePlansResponse, RoutePlanWarning } from './types';

type BuildRoutePlansRequest = {
  line?: string;
  originLine?: string;
  originStation: string;
  destinationStation: string;
  destinationLine?: string;
  direction?: string;
  comfortType?: ComfortType;
  egressPreference?: EgressPreference;
  transferStations?: string[];
  routeLines?: string[];
  maxCandidates?: number;
};

const ROUTE_PLAN_DISCLAIMER = '로컬 역·노선 목록과 검증된 일부 칸·문 위치 데이터로 만든 후보예요. 실제 최단 경로와 소요시간은 지도 앱 안내도 함께 확인해 주세요.';
const MAX_CANDIDATES = 4;

function cleanStationName(value?: string) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return trimmed.endsWith('역') ? trimmed : `${trimmed}역`;
}

function stationKey(value: string) {
  return normalizeStationName(value);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

const searchableStations = STATIONS.filter(isSearchableMetroStation);

function linesForStation(stationName: string) {
  const key = stationKey(stationName);
  return unique(searchableStations
    .filter((station) => stationKey(station.name) === key)
    .map((station) => station.line))
    .sort((a, b) => a.localeCompare(b, 'ko'));
}

function transferStationsForLines(fromLine: string, toLine: string) {
  const linesByName = new Map<string, { name: string; lines: Set<string> }>();
  for (const station of searchableStations) {
    const key = stationKey(station.name);
    const existing = linesByName.get(key) ?? { name: station.name, lines: new Set<string>() };
    existing.lines.add(station.line);
    linesByName.set(key, existing);
  }

  return [...linesByName.values()]
    .filter((entry) => entry.lines.has(fromLine) && entry.lines.has(toLine))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'ko'));
}

function doorCoverageStatus(status: Awaited<ReturnType<typeof lookupDoorGuide>>['status']): RoutePlanCoverageStatus {
  if (status === 'available') return 'available';
  if (status === 'needs_direction') return 'needs_direction';
  return 'needs_data';
}

function candidateId(parts: string[]) {
  return parts.map((part) => stationKey(part).replace(/[^가-힣a-zA-Z0-9]/g, '')).join('-').toLowerCase();
}

function rankCandidate(candidate: RoutePlanCandidate) {
  if (candidate.type === 'UNRESOLVED') return -100000;
  let score = 100000;
  if (candidate.type === 'USER_SPECIFIED') score += 20000;
  if (typeof candidate.estimatedStationCount === 'number') score -= candidate.estimatedStationCount * 100;
  else score -= 50000;
  score -= candidate.transferStations.length * 850;
  if (candidate.type === 'DIRECT') score += 500;
  if (candidate.coverage.nextTransferDoorGuide === 'available') score += 250;
  if (candidate.coverage.nextTransferDoorGuide === 'needs_direction') score += 80;
  if (candidate.coverage.finalExitDoorGuide === 'available') score += 80;
  return score;
}

async function buildDirectCandidate(params: {
  originStation: string;
  destinationStation: string;
  line: string;
  direction?: string;
  egressPreference?: EgressPreference;
}): Promise<RoutePlanCandidate> {
  const inferred = params.direction ? undefined : inferLineDirection({ line: params.line, originStation: params.originStation, targetStation: params.destinationStation });
  const effectiveDirection = params.direction ?? inferred?.doorGuideDirection;
  const finalExit = await lookupDoorGuide({
    line: params.line,
    toStation: params.destinationStation,
    direction: effectiveDirection,
    egressPreference: params.egressPreference,
    goal: 'FINAL_EXIT',
  });
  const finalStatus = doorCoverageStatus(finalExit.status);
  const estimatedStationCount = estimateStationDistance({ line: params.line, originStation: params.originStation, targetStation: params.destinationStation });
  return {
    id: candidateId(['direct', params.line, params.originStation, params.destinationStation]),
    type: 'DIRECT',
    badge: '환승 없음',
    title: '바로 가는 경로 후보예요',
    summary: finalStatus === 'available'
      ? '도착역 하차 위치와 쾌적도를 함께 볼 수 있어요.'
      : '환승 없이 가는 후보예요. 하차 위치가 확인되지 않으면 쾌적칸 중심으로 안내해요.',
    originStation: params.originStation,
    destinationStation: params.destinationStation,
    transferStations: [],
    lines: [params.line],
    estimatedStationCount,
    legs: [{ legNo: 1, fromStation: params.originStation, toStation: params.destinationStation, line: params.line, goal: 'FINAL_EXIT' }],
    coverage: { nextTransferDoorGuide: 'not_applicable', finalExitDoorGuide: finalStatus },
    recommendRequestPatch: { line: params.line, destinationLine: params.line, transferStations: [], routeLines: [params.line], direction: effectiveDirection, egressPreference: params.egressPreference },
    reasonCodes: ['DIRECT_LINE', finalStatus === 'available' ? 'FINAL_EXIT_AVAILABLE' : 'FINAL_EXIT_LIMITED'],
    safetyNote: '환승 없이 가는 후보입니다. 실제 열차 운행과 승강장 안내는 현장에서 한 번 더 확인해 주세요.',
  };
}

async function buildTransferCandidate(params: {
  originStation: string;
  destinationStation: string;
  fromLine: string;
  toLine: string;
  transferStation: string;
  direction?: string;
  egressPreference?: EgressPreference;
  userSpecified?: boolean;
}): Promise<RoutePlanCandidate> {
  const inferred = params.direction ? undefined : inferLineDirection({ line: params.fromLine, originStation: params.originStation, targetStation: params.transferStation });
  const effectiveDirection = params.direction ?? inferred?.doorGuideDirection;
  const transferGuide = await lookupDoorGuide({
    line: params.fromLine,
    toStation: params.transferStation,
    direction: effectiveDirection,
    goal: 'NEXT_TRANSFER',
    targetLine: params.toLine,
  });
  const transferStatus = doorCoverageStatus(transferGuide.status);
  const finalInferred = inferLineDirection({ line: params.toLine, originStation: params.transferStation, targetStation: params.destinationStation });
  const finalExit = await lookupDoorGuide({
    line: params.toLine,
    toStation: params.destinationStation,
    direction: finalInferred?.doorGuideDirection,
    egressPreference: params.egressPreference,
    goal: 'FINAL_EXIT',
  });
  const finalStatus = doorCoverageStatus(finalExit.status);
  const firstLegDistance = estimateStationDistance({ line: params.fromLine, originStation: params.originStation, targetStation: params.transferStation });
  const secondLegDistance = estimateStationDistance({ line: params.toLine, originStation: params.transferStation, targetStation: params.destinationStation });
  const estimatedStationCount = typeof firstLegDistance === 'number' && typeof secondLegDistance === 'number'
    ? firstLegDistance + secondLegDistance
    : undefined;
  const type = params.userSpecified ? 'USER_SPECIFIED' : 'ONE_TRANSFER';
  return {
    id: candidateId([type, params.fromLine, params.transferStation, params.toLine, params.originStation, params.destinationStation]),
    type,
    badge: params.userSpecified ? '직접 설정' : transferStatus === 'available' ? '환승 위치 반영' : '환승 후보',
    title: params.userSpecified ? `${params.transferStation} 경유로 볼게요` : `${params.transferStation}에서 환승`,
    summary: transferStatus === 'available'
      ? `${params.transferStation}에서 갈아타기 가까운 위치 주변과 쾌적도를 함께 비교할 수 있어요.${inferred ? ` ${inferred.boardDirectionLabel}으로 계산했어요.` : ''}`
      : `${params.transferStation} 경유 후보예요. 확인된 위치가 없는 구간은 쾌적칸 중심으로 안내해요.`,
    originStation: params.originStation,
    destinationStation: params.destinationStation,
    transferStations: [params.transferStation],
    lines: [params.fromLine, params.toLine],
    estimatedStationCount,
    legs: [
      { legNo: 1, fromStation: params.originStation, toStation: params.transferStation, line: params.fromLine, goal: 'NEXT_TRANSFER', transferToLine: params.toLine },
      { legNo: 2, fromStation: params.transferStation, toStation: params.destinationStation, line: params.toLine, goal: 'FINAL_EXIT' },
    ],
    coverage: { nextTransferDoorGuide: transferStatus, finalExitDoorGuide: finalStatus },
    recommendRequestPatch: { line: params.fromLine, destinationLine: params.toLine, transferStations: [params.transferStation], routeLines: [params.fromLine, params.toLine], direction: effectiveDirection, egressPreference: params.egressPreference },
    reasonCodes: [type, transferStatus === 'available' ? 'NEXT_TRANSFER_AVAILABLE' : transferStatus === 'needs_direction' ? 'DIRECTION_REQUIRED_FOR_TRANSFER' : 'TRANSFER_DOOR_LIMITED'],
    safetyNote: '가능한 환승 후보입니다. 실제 최단 경로나 소요시간은 지도 앱에서 함께 확인해 주세요.',
  };
}

async function buildTwoTransferCandidate(params: {
  originStation: string;
  destinationStation: string;
  firstLine: string;
  middleLine: string;
  finalLine: string;
  firstTransferStation: string;
  secondTransferStation: string;
  direction?: string;
  egressPreference?: EgressPreference;
  userSpecified?: boolean;
}): Promise<RoutePlanCandidate | null> {
  const firstLegDistance = estimateStationDistance({ line: params.firstLine, originStation: params.originStation, targetStation: params.firstTransferStation });
  const middleLegDistance = estimateStationDistance({ line: params.middleLine, originStation: params.firstTransferStation, targetStation: params.secondTransferStation });
  const finalLegDistance = estimateStationDistance({ line: params.finalLine, originStation: params.secondTransferStation, targetStation: params.destinationStation });
  if (typeof firstLegDistance !== 'number' || typeof middleLegDistance !== 'number' || typeof finalLegDistance !== 'number') return null;
  if (firstLegDistance === 0 || middleLegDistance === 0 || finalLegDistance === 0) return null;

  const inferred = params.direction ? undefined : inferLineDirection({ line: params.firstLine, originStation: params.originStation, targetStation: params.firstTransferStation });
  const effectiveDirection = params.direction ?? inferred?.doorGuideDirection;
  const firstTransferGuide = await lookupDoorGuide({
    line: params.firstLine,
    toStation: params.firstTransferStation,
    direction: effectiveDirection,
    goal: 'NEXT_TRANSFER',
    targetLine: params.middleLine,
  });
  const transferStatus = doorCoverageStatus(firstTransferGuide.status);
  const finalInferred = inferLineDirection({ line: params.finalLine, originStation: params.secondTransferStation, targetStation: params.destinationStation });
  const finalExit = await lookupDoorGuide({
    line: params.finalLine,
    toStation: params.destinationStation,
    direction: finalInferred?.doorGuideDirection,
    egressPreference: params.egressPreference,
    goal: 'FINAL_EXIT',
  });
  const finalStatus = doorCoverageStatus(finalExit.status);
  const routeLines = [params.firstLine, params.middleLine, params.finalLine];
  const transferStations = [params.firstTransferStation, params.secondTransferStation];
  return {
    id: candidateId(['two-transfer', ...routeLines, ...transferStations, params.originStation, params.destinationStation]),
    type: params.userSpecified ? 'USER_SPECIFIED' : 'TWO_TRANSFER',
    badge: params.userSpecified ? '직접 설정' : '2회 환승 후보',
    title: `${params.firstTransferStation} · ${params.secondTransferStation} 경유`,
    summary: transferStatus === 'available'
      ? '첫 환승 위치와 구간별 쾌적도를 함께 볼 수 있어요. 실제 소요시간은 지도 앱도 함께 확인해 주세요.'
      : '환승역 2곳을 거치는 후보예요. 확인된 위치가 없는 구간은 쾌적칸 중심으로 안내해요.',
    originStation: params.originStation,
    destinationStation: params.destinationStation,
    transferStations,
    lines: routeLines,
    estimatedStationCount: firstLegDistance + middleLegDistance + finalLegDistance,
    legs: [
      { legNo: 1, fromStation: params.originStation, toStation: params.firstTransferStation, line: params.firstLine, goal: 'NEXT_TRANSFER', transferToLine: params.middleLine },
      { legNo: 2, fromStation: params.firstTransferStation, toStation: params.secondTransferStation, line: params.middleLine, goal: 'NEXT_TRANSFER', transferToLine: params.finalLine },
      { legNo: 3, fromStation: params.secondTransferStation, toStation: params.destinationStation, line: params.finalLine, goal: 'FINAL_EXIT' },
    ],
    coverage: { nextTransferDoorGuide: transferStatus, finalExitDoorGuide: finalStatus },
    recommendRequestPatch: { line: params.firstLine, destinationLine: params.finalLine, transferStations, routeLines, direction: effectiveDirection, egressPreference: params.egressPreference },
    reasonCodes: ['TWO_TRANSFER', transferStatus === 'available' ? 'FIRST_TRANSFER_AVAILABLE' : 'FIRST_TRANSFER_LIMITED'],
    safetyNote: '가능한 2회 환승 후보입니다. 실제 최단 경로나 소요시간은 지도 앱에서 함께 확인해 주세요.',
  };
}

function buildUnresolvedCandidate(params: {
  originStation: string;
  destinationStation: string;
  line: string;
  destinationLine?: string;
  direction?: string;
  egressPreference?: EgressPreference;
}): RoutePlanCandidate {
  return {
    id: candidateId(['unresolved', params.line, params.originStation, params.destinationStation, params.destinationLine ?? '']),
    type: 'UNRESOLVED',
    badge: '경로 미확정',
    title: '일단 쾌적칸 중심으로 볼게요',
    summary: '환승역이 정해지지 않아 빠른 환승 위치는 반영하지 못하지만, 출발 구간의 쾌적도를 기준으로 추천합니다.',
    originStation: params.originStation,
    destinationStation: params.destinationStation,
    transferStations: [],
    lines: unique([params.line, params.destinationLine].filter(Boolean) as string[]),
    legs: [{ legNo: 1, fromStation: params.originStation, toStation: params.destinationStation, line: params.line, goal: params.destinationLine && params.destinationLine !== params.line ? 'NEXT_TRANSFER' : 'FINAL_EXIT' }],
    coverage: { nextTransferDoorGuide: 'not_checked', finalExitDoorGuide: 'not_checked' },
    recommendRequestPatch: { line: params.line, destinationLine: params.destinationLine, transferStations: [], routeLines: unique([params.line, params.destinationLine].filter(Boolean) as string[]), direction: params.direction, egressPreference: params.egressPreference },
    reasonCodes: ['ROUTE_UNRESOLVED'],
    safetyNote: '환승 위치를 반영하지 않은 참고 추천입니다. 환승역을 선택하면 구간별 안내가 더 정확해져요.',
  };
}

export async function buildRoutePlanCandidates(request: BuildRoutePlansRequest): Promise<RoutePlansResponse> {
  const originStation = cleanStationName(request.originStation);
  const destinationStation = cleanStationName(request.destinationStation);
  const warnings: RoutePlanWarning[] = [];

  const originLines = request.originLine || request.line
    ? [request.originLine ?? request.line as string]
    : linesForStation(originStation);
  const destinationLines = request.destinationLine
    ? [request.destinationLine]
    : linesForStation(destinationStation);

  if (!originStation || originLines.length === 0) warnings.push({ code: 'UNKNOWN_ORIGIN_STATION', message: '출발역의 지원 노선을 찾지 못했어요.' });
  if (!destinationStation || destinationLines.length === 0) warnings.push({ code: 'UNKNOWN_DESTINATION_STATION', message: '도착역의 지원 노선을 찾지 못했어요.' });

  const candidates: RoutePlanCandidate[] = [];
  const maxCandidates = Math.min(Math.max(request.maxCandidates ?? MAX_CANDIDATES, 1), 6);
  const cleanTransfers = unique((request.transferStations ?? []).map(cleanStationName).filter(Boolean)).filter((station) => station !== originStation && station !== destinationStation).slice(0, 5);

  if (cleanTransfers.length > 1) {
    const routeLines = request.routeLines?.filter(Boolean) ?? [];
    const firstLine = routeLines[0] ?? originLines[0];
    const finalLine = routeLines[routeLines.length - 1] ?? destinationLines[0];
    const middleLine = routeLines[1]
      ?? linesForStation(cleanTransfers[0]).find((line) => line !== firstLine && linesForStation(cleanTransfers[1]).includes(line));
    if (firstLine && middleLine && finalLine) {
      const manualMulti = await buildTwoTransferCandidate({
        originStation,
        destinationStation,
        firstLine,
        middleLine,
        finalLine,
        firstTransferStation: cleanTransfers[0],
        secondTransferStation: cleanTransfers[1],
        direction: request.direction,
        egressPreference: request.egressPreference,
        userSpecified: true,
      });
      if (manualMulti) candidates.push(manualMulti);
      else warnings.push({ code: 'MULTI_TRANSFER_LIMITED', message: '직접 입력한 환승 순서는 저장했지만 일부 구간은 쾌적칸 중심으로 안내할 수 있어요.' });
    }
  }

  if (cleanTransfers.length === 1) {
    const transferStation = cleanTransfers[0];
    const transferLines = linesForStation(transferStation);
    if (transferLines.length === 0) warnings.push({ code: 'UNKNOWN_TRANSFER_STATION', message: `${transferStation}의 지원 노선을 찾지 못했어요.` });
    const fromLine = originLines.find((line) => transferLines.includes(line)) ?? originLines[0];
    const toLine = destinationLines.find((line) => transferLines.includes(line)) ?? destinationLines[0];
    if (fromLine && toLine && transferLines.includes(fromLine) && transferLines.includes(toLine)) {
      candidates.push(await buildTransferCandidate({ originStation, destinationStation, fromLine, toLine, transferStation, direction: request.direction, egressPreference: request.egressPreference, userSpecified: true }));
    }
  }

  for (const line of originLines) {
    if (destinationLines.includes(line) && candidates.length < maxCandidates) {
      candidates.push(await buildDirectCandidate({ originStation, destinationStation, line, direction: request.direction, egressPreference: request.egressPreference }));
    }
  }

  for (const fromLine of originLines) {
    for (const toLine of destinationLines) {
      if (fromLine === toLine) continue;
      const transfers = transferStationsForLines(fromLine, toLine)
        .filter((station) => station !== originStation && station !== destinationStation)
        .slice(0, 8);
      for (const transferStation of transfers) {
        candidates.push(await buildTransferCandidate({ originStation, destinationStation, fromLine, toLine, transferStation, direction: request.direction, egressPreference: request.egressPreference }));
      }
    }
  }

  const routableLines = Object.keys(LINE_ORDERS);
  for (const firstLine of originLines) {
    for (const finalLine of destinationLines) {
      if (firstLine === finalLine) continue;
      for (const middleLine of routableLines) {
        if (middleLine === firstLine || middleLine === finalLine) continue;
        const firstTransfers = transferStationsForLines(firstLine, middleLine)
          .filter((station) => station !== originStation && station !== destinationStation)
          .slice(0, 6);
        const secondTransfers = transferStationsForLines(middleLine, finalLine)
          .filter((station) => station !== originStation && station !== destinationStation)
          .slice(0, 6);
        for (const firstTransferStation of firstTransfers) {
          for (const secondTransferStation of secondTransfers) {
            if (firstTransferStation === secondTransferStation) continue;
            const candidate = await buildTwoTransferCandidate({
              originStation,
              destinationStation,
              firstLine,
              middleLine,
              finalLine,
              firstTransferStation,
              secondTransferStation,
              direction: request.direction,
              egressPreference: request.egressPreference,
            });
            if (candidate) candidates.push(candidate);
          }
        }
      }
    }
  }

  const fallbackLine = originLines[0] ?? request.line ?? '2호선';
  const fallbackDestinationLine = destinationLines[0] ?? request.destinationLine;
  if (candidates.length === 0) {
    candidates.push(buildUnresolvedCandidate({ originStation, destinationStation, line: fallbackLine, destinationLine: fallbackDestinationLine, direction: request.direction, egressPreference: request.egressPreference }));
  }

  const comparableCandidates = candidates.some((candidate) => typeof candidate.estimatedStationCount === 'number')
    ? candidates.filter((candidate) => candidate.type === 'USER_SPECIFIED' || candidate.type === 'DIRECT' || candidate.type === 'UNRESOLVED' || typeof candidate.estimatedStationCount === 'number')
    : candidates;

  const deduped = comparableCandidates
    .filter((candidate, index, list) => list.findIndex((item) => item.id === candidate.id) === index)
    .sort((a, b) => rankCandidate(b) - rankCandidate(a) || a.title.localeCompare(b.title, 'ko'))
    .slice(0, maxCandidates);

  if (deduped.length === 0) warnings.push({ code: 'NO_CANDIDATES', message: '표시할 경로 후보가 없어 쾌적칸 중심 추천만 사용할 수 있어요.' });

  return { candidates: deduped, warnings, disclaimer: ROUTE_PLAN_DISCLAIMER };
}
