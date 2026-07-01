import type { DoorGuideRecord } from './doorGuidance/types';
import type { CarComfort, ComfortType, RecommendRequest, RouteChoice, RouteGuidance, RouteLegGuidance } from './types';
import { lookupDoorGuide } from './doorGuidance/resolver';
import { generateCars } from './providers';
import { inferLineDirection, isSameLineDirectionSide } from './routeDirection';

export type RouteAnchor = {
  goal: 'FINAL_EXIT' | 'NEXT_TRANSFER';
  station: string;
  carNo: number;
  doorNo?: number;
  records?: DoorGuideRecord[];
  facility?: string;
  facilityType?: RouteLegGuidance['facilityType'];
  egressPreference?: RouteLegGuidance['egressPreference'];
  message: string;
};

function cleanStationName(value?: string) {
  return (value ?? '').trim();
}

function uniqueStations(stations: string[] | undefined, origin: string, destination: string) {
  return [...new Set((stations ?? []).map(cleanStationName).filter(Boolean))]
    .filter((station) => station !== origin && station !== destination)
    .slice(0, 5);
}

function sameLine(request: RecommendRequest) {
  return !request.destinationLine || request.destinationLine === request.line;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreGeneratedCar(car: CarComfort, comfortType: ComfortType, avoidPrioritySeatArea?: boolean): CarComfort {
  const weights = comfortType === 'HOT_SENSITIVE'
    ? { cool: 0.48, crowd: 0.28, convenience: 0.24 }
    : comfortType === 'COLD_SENSITIVE'
      ? { cool: -0.28, crowd: 0.38, convenience: 0.34 }
      : comfortType === 'CROWD_AVOIDER'
        ? { cool: 0.22, crowd: 0.56, convenience: 0.22 }
        : { cool: 0.34, crowd: 0.34, convenience: 0.32 };
  const priorityPenalty = avoidPrioritySeatArea && car.isPrioritySeatArea ? 18 : 0;
  const weakAcBonus = comfortType === 'COLD_SENSITIVE' && car.isWeakAc ? 12 : 0;
  const total = (car.coolingScore * weights.cool) + (car.crowdScore * weights.crowd) + (car.convenienceScore * weights.convenience) + weakAcBonus - priorityPenalty;
  return { ...car, totalComfortScore: clampScore(total) };
}

function fallbackCarForLeg(params: {
  request: RecommendRequest;
  line: string;
  fromStation: string;
  direction?: string;
}) {
  const cars = generateCars({
    ...params.request,
    line: params.line,
    originStation: params.fromStation,
    direction: params.direction,
  }, 'estimated').map((car) => scoreGeneratedCar(car, params.request.comfortType, params.request.avoidPrioritySeatArea));
  return [...cars].sort((a, b) => {
    if (b.totalComfortScore !== a.totalComfortScore) return b.totalComfortScore - a.totalComfortScore;
    return Math.abs(a.carNo - (cars.length + 1) / 2) - Math.abs(b.carNo - (cars.length + 1) / 2);
  })[0];
}

function carCountForLine(line: string) {
  return line === '8호선' || line === '9호선' || line === '신분당선' || line === '수인분당선' || line === '공항철도' ? 6 : 10;
}

type PlatformTransferRule = {
  station: string;
  line: string;
  targetLine: string;
  lineDirection: string;
  targetDirection: string;
  kind: 'CROSS_PLATFORM' | 'ALL_DOORS';
  label: string;
  message: string;
};

const PLATFORM_TRANSFER_RULES: PlatformTransferRule[] = [
  {
    station: '금정역',
    line: '1호선',
    targetLine: '4호선',
    lineDirection: '청량리',
    targetDirection: '당고개',
    kind: 'CROSS_PLATFORM',
    label: '같은 승강장 맞은편 열차',
    message: '같은 방향 평면환승 구간이에요. 내린 뒤 같은 승강장 맞은편 4호선 열차를 타면 돼요.',
  },
  {
    station: '금정역',
    line: '1호선',
    targetLine: '4호선',
    lineDirection: '신창',
    targetDirection: '오이도',
    kind: 'CROSS_PLATFORM',
    label: '같은 승강장 맞은편 열차',
    message: '같은 방향 평면환승 구간이에요. 내린 뒤 같은 승강장 맞은편 4호선 열차를 타면 돼요.',
  },
  {
    station: '금정역',
    line: '4호선',
    targetLine: '1호선',
    lineDirection: '당고개',
    targetDirection: '청량리',
    kind: 'CROSS_PLATFORM',
    label: '같은 승강장 맞은편 열차',
    message: '같은 방향 평면환승 구간이에요. 내린 뒤 같은 승강장 맞은편 1호선 열차를 타면 돼요.',
  },
  {
    station: '금정역',
    line: '4호선',
    targetLine: '1호선',
    lineDirection: '오이도',
    targetDirection: '신창',
    kind: 'CROSS_PLATFORM',
    label: '같은 승강장 맞은편 열차',
    message: '같은 방향 평면환승 구간이에요. 내린 뒤 같은 승강장 맞은편 1호선 열차를 타면 돼요.',
  },
  {
    station: '초지역',
    line: '수인분당선',
    targetLine: '4호선',
    lineDirection: '왕십리',
    targetDirection: '당고개',
    kind: 'ALL_DOORS',
    label: '모든 문 환승 가능',
    message: '4호선과 같은 선로를 공유하는 구간이에요. 특정 문보다 방면을 확인하고 어느 문으로 내려도 환승할 수 있어요.',
  },
  {
    station: '초지역',
    line: '수인분당선',
    targetLine: '4호선',
    lineDirection: '청량리',
    targetDirection: '당고개',
    kind: 'ALL_DOORS',
    label: '모든 문 환승 가능',
    message: '4호선과 같은 선로를 공유하는 구간이에요. 특정 문보다 방면을 확인하고 어느 문으로 내려도 환승할 수 있어요.',
  },
  {
    station: '초지역',
    line: '수인분당선',
    targetLine: '4호선',
    lineDirection: '인천',
    targetDirection: '오이도',
    kind: 'ALL_DOORS',
    label: '모든 문 환승 가능',
    message: '4호선과 같은 선로를 공유하는 구간이에요. 특정 문보다 방면을 확인하고 어느 문으로 내려도 환승할 수 있어요.',
  },
];

function normalizeStation(value?: string) {
  return (value ?? '').trim().replace(/\s+/g, '').replace(/역$/, '');
}

function normalizeLineName(value?: string) {
  return (value ?? '').trim().replace(/\s+/g, '');
}

function platformTransferRule(params: {
  line: string;
  toStation: string;
  direction?: string;
  targetLine?: string;
  targetDirection?: string;
}) {
  if (!params.targetLine || !params.direction || !params.targetDirection) return undefined;
  return PLATFORM_TRANSFER_RULES.find((rule) => {
    if (normalizeStation(rule.station) !== normalizeStation(params.toStation)) return false;
    if (normalizeLineName(rule.line) !== normalizeLineName(params.line)) return false;
    if (normalizeLineName(rule.targetLine) !== normalizeLineName(params.targetLine)) return false;
    return isSameLineDirectionSide({ line: rule.line, atStation: rule.station, inputDirection: params.direction!, recordDirection: rule.lineDirection })
      && isSameLineDirectionSide({ line: rule.targetLine, atStation: rule.station, inputDirection: params.targetDirection!, recordDirection: rule.targetDirection });
  });
}

function allCarNosForLine(line: string) {
  return Array.from({ length: carCountForLine(line) }, (_, index) => index + 1);
}

function candidateCarsAroundAnchor(line: string, anchorCarNo?: number) {
  if (!anchorCarNo) return undefined;
  const maxCarNo = carCountForLine(line);
  return [anchorCarNo - 1, anchorCarNo, anchorCarNo + 1].filter((carNo) => carNo >= 1 && carNo <= maxCarNo);
}

function availableAnchorCar(status: RouteLegGuidance['status'], carNo?: number) {
  return status === 'available' ? carNo : undefined;
}

function availableCandidateCars(line: string, status: RouteLegGuidance['status'], carNo?: number) {
  return status === 'available' ? candidateCarsAroundAnchor(line, carNo) : undefined;
}

function baseLeg(params: {
  legNo: number;
  fromStation: string;
  toStation: string;
  line: string;
  direction?: string;
  goal: RouteLegGuidance['goal'];
  status: RouteLegGuidance['status'];
  recommendedCarNo?: number;
  recommendedDoorNo?: number;
  anchorCarNo?: number;
  anchorDoorNo?: number;
  anchorCarNos?: number[];
  candidateCarNos?: number[];
  positionLabel: string;
  facility?: string;
  facilityType?: RouteLegGuidance['facilityType'];
  egressPreference?: RouteLegGuidance['egressPreference'];
  transferKind?: RouteLegGuidance['transferKind'];
  message: string;
}): RouteLegGuidance {
  return {
    legNo: params.legNo,
    fromStation: params.fromStation,
    toStation: params.toStation,
    line: params.line,
    direction: params.direction,
    goal: params.goal,
    status: params.status,
    recommendedCarNo: params.recommendedCarNo,
    recommendedDoorNo: params.recommendedDoorNo,
    anchorCarNo: params.anchorCarNo,
    anchorDoorNo: params.anchorDoorNo,
    anchorCarNos: params.anchorCarNos,
    candidateCarNos: params.candidateCarNos,
    positionLabel: params.positionLabel,
    facility: params.facility,
    facilityType: params.facilityType,
    egressPreference: params.egressPreference,
    transferKind: params.transferKind,
    message: params.message,
  };
}

async function applyDoorGuide(params: {
  line: string;
  toStation: string;
  direction?: string;
  goal: RouteLegGuidance['goal'];
  targetLine?: string;
  targetDirection?: string;
  egressPreference?: RouteLegGuidance['egressPreference'];
  fallbackCarNo?: number;
  fallbackMessage: string;
}) {
  if (params.goal === 'BOARD_AFTER_TRANSFER') {
    return {
      status: 'needs_route' as const,
      recommendedCarNo: params.fallbackCarNo,
      positionLabel: params.fallbackCarNo ? `${params.fallbackCarNo}번째 칸 근처` : '환승 후 탑승 위치 확인 필요',
      message: params.fallbackMessage,
    };
  }

  if (params.goal === 'NEXT_TRANSFER') {
    const samePlatform = platformTransferRule({
      line: params.line,
      toStation: params.toStation,
      direction: params.direction,
      targetLine: params.targetLine,
      targetDirection: params.targetDirection,
    });
    if (samePlatform) {
      return {
        status: 'available' as const,
        recommendedCarNo: params.fallbackCarNo,
        candidateCarNos: allCarNosForLine(params.line),
        positionLabel: samePlatform.label,
        facility: '평면환승',
        facilityType: 'TRANSFER_PASSAGE' as const,
        transferKind: samePlatform.kind,
        message: samePlatform.message,
      };
    }
  }

  const result = await lookupDoorGuide({
    line: params.line,
    toStation: params.toStation,
    direction: params.direction,
    goal: params.goal,
    targetLine: params.targetLine,
    targetDirection: params.targetDirection,
    egressPreference: params.egressPreference,
  });

  if (result.status === 'available') {
    return {
      status: 'available' as const,
      recommendedCarNo: result.record.carNo,
      recommendedDoorNo: result.record.doorNo,
      anchorRecords: result.records,
      positionLabel: `${result.record.carNo}번째 칸 · ${result.record.doorNo}번 문 근처`,
      facility: result.record.facility,
      facilityType: result.record.facilityType,
      egressPreference: params.egressPreference,
      message: result.record.facility
        ? `${result.record.facility}와 가까운 참고 위치예요.`
        : '내릴 때 이동하기 좋은 참고 위치예요.',
    };
  }

  if (result.status === 'needs_direction') {
    const comfortPositionLabel = params.fallbackCarNo
      ? params.goal === 'FINAL_EXIT'
        ? `쾌적도 기준 ${params.fallbackCarNo}번째 칸`
        : `${params.fallbackCarNo}번째 칸 근처`
      : '쾌적칸 중심';
    return {
      status: 'needs_direction' as const,
      recommendedCarNo: params.fallbackCarNo,
      positionLabel: comfortPositionLabel,
      egressPreference: params.egressPreference,
      message: '방면 자동 계산이 어려운 구간이라 쾌적칸 중심으로 안내해요. 승강장 안내를 함께 확인해 주세요.',
    };
  }

  const comfortPositionLabel = params.fallbackCarNo
    ? params.goal === 'FINAL_EXIT'
      ? `쾌적도 기준 ${params.fallbackCarNo}번째 칸`
      : `${params.fallbackCarNo}번째 칸 근처`
    : params.goal === 'FINAL_EXIT'
      ? '쾌적칸 중심'
      : '탑승 위치 확인 필요';

  return {
    status: 'needs_data' as const,
    recommendedCarNo: params.fallbackCarNo,
    positionLabel: comfortPositionLabel,
    egressPreference: params.egressPreference,
    message: params.fallbackMessage,
  };
}

export async function resolveRouteAnchor(request: RecommendRequest): Promise<RouteAnchor | undefined> {
  const origin = cleanStationName(request.originStation);
  const destination = cleanStationName(request.destinationStation) || '목적지';
  const transfers = uniqueStations(request.transferStations, origin, destination);

  const routeLines = request.routeLines?.filter(Boolean) ?? [];
  const anchorTarget = transfers.length > 0
    ? {
        station: transfers[0],
        goal: 'NEXT_TRANSFER' as const,
        targetLine: routeLines[1] ?? (transfers.length === 1 ? request.destinationLine : undefined),
      }
    : sameLine(request)
      ? {
          station: destination,
          goal: 'FINAL_EXIT' as const,
          targetLine: undefined,
        }
      : undefined;

  if (!anchorTarget) return undefined;

  const inferredDirection = request.direction ?? inferLineDirection({ line: request.line, originStation: origin, targetStation: anchorTarget.station })?.doorGuideDirection;
  const firstTargetDirection = anchorTarget.goal === 'NEXT_TRANSFER' && anchorTarget.targetLine
    ? inferLineDirection({ line: anchorTarget.targetLine, originStation: anchorTarget.station, targetStation: transfers[1] ?? destination })?.doorGuideDirection
    : undefined;
  if (anchorTarget.goal === 'NEXT_TRANSFER' && platformTransferRule({
    line: request.line,
    toStation: anchorTarget.station,
    direction: inferredDirection,
    targetLine: anchorTarget.targetLine,
    targetDirection: firstTargetDirection,
  })) {
    return undefined;
  }
  const result = await lookupDoorGuide({
    line: request.line,
    toStation: anchorTarget.station,
    direction: inferredDirection,
    goal: anchorTarget.goal,
    targetLine: anchorTarget.targetLine,
    targetDirection: firstTargetDirection,
    egressPreference: anchorTarget.goal === 'FINAL_EXIT' ? request.egressPreference : undefined,
  });

  if (result.status !== 'available') return undefined;

  return {
    goal: anchorTarget.goal,
    station: anchorTarget.station,
    carNo: result.record.carNo,
    doorNo: result.record.doorNo,
    records: result.records,
    facility: result.record.facility,
    facilityType: result.record.facilityType,
    egressPreference: anchorTarget.goal === 'FINAL_EXIT' ? request.egressPreference : undefined,
    message: result.record.facility
      ? `${result.record.facility}와 가까운 위치를 기준으로 주변 칸을 비교했어요.`
      : '환승·하차 위치와 가까운 칸 주변을 먼저 비교했어요.',
  };
}

export async function buildRouteGuidance(request: RecommendRequest, recommendedCar: CarComfort, routeChoice?: RouteChoice): Promise<RouteGuidance> {
  const origin = cleanStationName(request.originStation);
  const destination = cleanStationName(request.destinationStation) || '목적지';
  const transfers = uniqueStations(request.transferStations, origin, destination);
  const disclaimer = '전체 이동 경로를 대신 정해주는 기능이 아니라, 선택한 이동 경로에서 타기 좋은 위치를 안내하는 참고 정보예요.';

  if (transfers.length === 0 && sameLine(request)) {
    const effectiveDirection = request.direction ?? inferLineDirection({ line: request.line, originStation: origin, targetStation: destination })?.doorGuideDirection;
    const doorGuide = await applyDoorGuide({
      line: request.line,
      toStation: destination,
      direction: effectiveDirection,
      goal: 'FINAL_EXIT',
      egressPreference: request.egressPreference,
      fallbackCarNo: recommendedCar.carNo,
      fallbackMessage: '빠른하차 위치가 확인되지 않은 구간은 추천 칸을 기준으로 안내해요. 승강장에서 한 번 더 확인해 주세요.',
    });
    return {
      status: 'direct',
      summary: '환승 없이 가는 경로예요. 도착 후 내리기 편한 위치와 쾌적도를 함께 봤어요.',
      disclaimer,
      legs: [
        baseLeg({
          legNo: 1,
          fromStation: origin,
          toStation: destination,
          line: request.line,
          direction: request.direction,
          goal: 'FINAL_EXIT',
          status: doorGuide.status,
          recommendedCarNo: routeChoice?.mode === 'ANCHOR_WINDOW' ? recommendedCar.carNo : doorGuide.recommendedCarNo,
          recommendedDoorNo: doorGuide.recommendedDoorNo,
          anchorCarNo: routeChoice?.mode === 'ANCHOR_WINDOW' && doorGuide.status === 'available'
            ? doorGuide.recommendedCarNo
            : availableAnchorCar(doorGuide.status, doorGuide.recommendedCarNo),
          anchorDoorNo: doorGuide.recommendedDoorNo,
          anchorCarNos: routeChoice?.mode === 'ANCHOR_WINDOW' ? routeChoice.anchorCarNos : undefined,
          candidateCarNos: routeChoice?.mode === 'ANCHOR_WINDOW'
            ? routeChoice.candidateCarNos
            : (doorGuide.candidateCarNos ?? availableCandidateCars(request.line, doorGuide.status, doorGuide.recommendedCarNo)),
          positionLabel: routeChoice?.mode === 'ANCHOR_WINDOW'
            ? `${recommendedCar.carNo}번째 칸 추천 · ${routeChoice.anchorCarNo}번째 칸 주변`
            : doorGuide.positionLabel,
          facility: doorGuide.facility,
          facilityType: doorGuide.facilityType,
          egressPreference: doorGuide.egressPreference,
          transferKind: doorGuide.transferKind,
          message: routeChoice?.mode === 'ANCHOR_WINDOW'
            ? `${routeChoice.anchorDoorLabels?.length ? routeChoice.anchorDoorLabels.join(', ') : `${routeChoice.anchorCarNo}번째 칸${routeChoice.anchorDoorNo ? ` · ${routeChoice.anchorDoorNo}번 문` : ''}`} 근처와 양옆 칸을 먼저 보고, 그 안에서 쾌적한 칸을 골랐어요.`
            : doorGuide.message,
        }),
      ],
    };
  }

  if (transfers.length === 0) {
    return {
      status: 'needs_route',
      summary: '환승이 필요한 경로예요. 환승역을 추가하면 구간별 칸·문 위치를 나눠서 안내할 수 있어요.',
      disclaimer,
      legs: [
        baseLeg({
          legNo: 1,
          fromStation: origin,
          toStation: destination,
          line: request.line,
          direction: request.direction,
          goal: 'NEXT_TRANSFER',
          status: 'needs_route',
          recommendedCarNo: recommendedCar.carNo,
          positionLabel: `${recommendedCar.carNo}번째 칸 근처`,
          message: '현재는 전체 환승 경로가 확정되지 않아 쾌적칸 중심으로만 추천했어요.',
        }),
      ],
    };
  }

  const waypoints = [origin, ...transfers, destination];
  const routeLines = request.routeLines?.filter(Boolean) ?? [];
  const legs = await Promise.all(waypoints.slice(0, -1).map(async (fromStation, index) => {
    const toStation = waypoints[index + 1];
    const isLast = index === waypoints.length - 2;
    const line = routeLines[index] ?? (index === 0 ? request.line : (isLast ? request.destinationLine || '환승 후 노선' : '환승 후 노선'));
    const goal = isLast ? 'FINAL_EXIT' : 'NEXT_TRANSFER';
    const inferredDirection = inferLineDirection({ line, originStation: fromStation, targetStation: toStation })?.doorGuideDirection;
    const effectiveDirection = index === 0 ? (request.direction ?? inferredDirection) : inferredDirection;
    const nextLine = routeLines[index + 1] ?? (!isLast && transfers.length === 1 ? request.destinationLine : undefined);
    const targetDirection = !isLast && nextLine
      ? inferLineDirection({ line: nextLine, originStation: toStation, targetStation: waypoints[index + 2] })?.doorGuideDirection
      : undefined;
    const legFallbackCar = index === 0 ? recommendedCar : fallbackCarForLeg({ request, line, fromStation, direction: effectiveDirection });
    const doorGuide = await applyDoorGuide({
      line,
      toStation,
      direction: effectiveDirection,
      goal,
      targetLine: !isLast ? nextLine : undefined,
      targetDirection,
      egressPreference: isLast ? request.egressPreference : undefined,
      fallbackCarNo: legFallbackCar?.carNo,
      fallbackMessage: index === 0
        ? '이 환승 구간은 승강장 안내와 함께 확인해 주세요. 지금은 추천 칸을 기준으로 안내해요.'
        : isLast
          ? '도착역에서는 표지판을 보며 이동하면 돼요.'
          : `${toStation} 환승 위치는 승강장에서 한 번 더 확인해 주세요. 이 구간은 쾌적칸 중심으로 안내해요.`,
    });
    const usePrimaryRouteChoice = index === 0 && routeChoice?.mode === 'ANCHOR_WINDOW' && !doorGuide.transferKind;
    return baseLeg({
      legNo: index + 1,
      fromStation,
      toStation,
      line,
      direction: effectiveDirection,
      goal,
      status: doorGuide.status,
      recommendedCarNo: usePrimaryRouteChoice ? recommendedCar.carNo : doorGuide.recommendedCarNo,
      recommendedDoorNo: doorGuide.recommendedDoorNo,
      anchorCarNo: usePrimaryRouteChoice && doorGuide.status === 'available'
        ? doorGuide.recommendedCarNo
        : (doorGuide.transferKind ? undefined : availableAnchorCar(doorGuide.status, doorGuide.recommendedCarNo)),
      anchorDoorNo: doorGuide.transferKind ? undefined : doorGuide.status === 'available' ? doorGuide.recommendedDoorNo : undefined,
      anchorCarNos: usePrimaryRouteChoice ? routeChoice.anchorCarNos : undefined,
      candidateCarNos: usePrimaryRouteChoice
        ? routeChoice.candidateCarNos
        : (doorGuide.candidateCarNos ?? availableCandidateCars(line, doorGuide.status, doorGuide.recommendedCarNo)),
      positionLabel: usePrimaryRouteChoice
        ? `${recommendedCar.carNo}번째 칸 추천 · ${routeChoice.anchorCarNo}번째 칸 주변`
        : doorGuide.positionLabel,
      facility: doorGuide.facility,
      facilityType: doorGuide.facilityType,
      egressPreference: doorGuide.egressPreference,
      transferKind: doorGuide.transferKind,
      message: usePrimaryRouteChoice
        ? `${routeChoice.anchorDoorLabels?.length ? routeChoice.anchorDoorLabels.join(', ') : `${routeChoice.anchorCarNo}번째 칸${routeChoice.anchorDoorNo ? ` · ${routeChoice.anchorDoorNo}번 문` : ''}`} 근처와 양옆 칸을 먼저 보고, 그 안에서 쾌적한 칸을 골랐어요.`
        : doorGuide.message,
    });
  }));

  return {
    status: 'limited',
    summary: `환승역 ${transfers.length}개를 기준으로 ${legs.length}개 구간을 나눠봤어요.`,
    disclaimer,
    legs,
  };
}
