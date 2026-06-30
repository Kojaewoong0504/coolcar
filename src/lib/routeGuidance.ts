import type { CarComfort, RecommendRequest, RouteChoice, RouteGuidance, RouteLegGuidance } from './types';
import { lookupDoorGuide } from './doorGuidance/resolver';
import { inferLineDirection } from './routeDirection';

export type RouteAnchor = {
  goal: 'FINAL_EXIT' | 'NEXT_TRANSFER';
  station: string;
  carNo: number;
  doorNo?: number;
  facility?: string;
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
  candidateCarNos?: number[];
  positionLabel: string;
  facility?: string;
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
    candidateCarNos: params.candidateCarNos,
    positionLabel: params.positionLabel,
    facility: params.facility,
    message: params.message,
  };
}

async function applyDoorGuide(params: {
  line: string;
  toStation: string;
  direction?: string;
  goal: RouteLegGuidance['goal'];
  targetLine?: string;
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

  const result = await lookupDoorGuide({
    line: params.line,
    toStation: params.toStation,
    direction: params.direction,
    goal: params.goal,
    targetLine: params.targetLine,
  });

  if (result.status === 'available') {
    return {
      status: 'available' as const,
      recommendedCarNo: result.record.carNo,
      recommendedDoorNo: result.record.doorNo,
      positionLabel: `${result.record.carNo}번째 칸 · ${result.record.doorNo}번 문 근처`,
      facility: result.record.facility,
      message: result.record.facility
        ? `${result.record.facility}와 가까운 참고 위치예요.`
        : '내릴 때 이동하기 좋은 참고 위치예요.',
    };
  }

  if (result.status === 'needs_direction') {
    return {
      status: 'needs_direction' as const,
      recommendedCarNo: params.fallbackCarNo,
      positionLabel: params.fallbackCarNo ? `${params.fallbackCarNo}번째 칸 근처` : '쾌적칸 중심',
      message: '방면을 비워둔 상태라 문 위치 대신 쾌적칸 중심으로 안내해요.',
    };
  }

  return {
    status: 'needs_data' as const,
    recommendedCarNo: params.fallbackCarNo,
    positionLabel: params.fallbackCarNo ? `${params.fallbackCarNo}번째 칸 근처` : '탑승 위치 확인 필요',
    message: params.fallbackMessage,
  };
}

export async function resolveRouteAnchor(request: RecommendRequest): Promise<RouteAnchor | undefined> {
  const origin = cleanStationName(request.originStation);
  const destination = cleanStationName(request.destinationStation) || '목적지';
  const transfers = uniqueStations(request.transferStations, origin, destination);

  const anchorTarget = transfers.length > 0
    ? {
        station: transfers[0],
        goal: 'NEXT_TRANSFER' as const,
        targetLine: transfers.length === 1 ? request.destinationLine : undefined,
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
  const result = await lookupDoorGuide({
    line: request.line,
    toStation: anchorTarget.station,
    direction: inferredDirection,
    goal: anchorTarget.goal,
    targetLine: anchorTarget.targetLine,
  });

  if (result.status !== 'available') return undefined;

  return {
    goal: anchorTarget.goal,
    station: anchorTarget.station,
    carNo: result.record.carNo,
    doorNo: result.record.doorNo,
    facility: result.record.facility,
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
      fallbackCarNo: recommendedCar.carNo,
      fallbackMessage: '빠른하차 문 정보가 없으면 추천 칸을 기준으로 안내해요. 문 위치는 승강장에서 한 번 더 확인해 주세요.',
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
          anchorCarNo: routeChoice?.mode === 'ANCHOR_WINDOW' && doorGuide.status === 'available' ? doorGuide.recommendedCarNo : undefined,
          anchorDoorNo: doorGuide.recommendedDoorNo,
          candidateCarNos: routeChoice?.mode === 'ANCHOR_WINDOW' ? routeChoice.candidateCarNos : undefined,
          positionLabel: routeChoice?.mode === 'ANCHOR_WINDOW'
            ? `${recommendedCar.carNo}번째 칸 추천 · ${routeChoice.anchorCarNo}번째 칸 주변`
            : doorGuide.positionLabel,
          facility: doorGuide.facility,
          message: routeChoice?.mode === 'ANCHOR_WINDOW'
            ? `${routeChoice.anchorCarNo}번째 칸${routeChoice.anchorDoorNo ? ` · ${routeChoice.anchorDoorNo}번 문` : ''} 근처와 양옆 칸을 먼저 보고, 그 안에서 쾌적한 칸을 골랐어요.`
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
  const legs = await Promise.all(waypoints.slice(0, -1).map(async (fromStation, index) => {
    const toStation = waypoints[index + 1];
    const isLast = index === waypoints.length - 2;
    const line = index === 0 ? request.line : (isLast ? request.destinationLine || '환승 후 노선' : '환승 후 노선');
    const goal = isLast ? 'FINAL_EXIT' : 'NEXT_TRANSFER';
    const effectiveDirection = index === 0 ? (request.direction ?? inferLineDirection({ line, originStation: fromStation, targetStation: toStation })?.doorGuideDirection) : undefined;
    const doorGuide = await applyDoorGuide({
      line,
      toStation,
      direction: effectiveDirection,
      goal,
      targetLine: !isLast && transfers.length === 1 ? request.destinationLine : undefined,
      fallbackCarNo: index === 0 ? recommendedCar.carNo : undefined,
      fallbackMessage: index === 0
        ? '이 환승 구간의 문 위치 정보가 아직 부족해요. 지금은 추천 칸을 기준으로 안내해요.'
        : '다음 노선의 방면에 따라 추천 위치가 달라질 수 있어요.',
    });
    return baseLeg({
      legNo: index + 1,
      fromStation,
      toStation,
      line,
      direction: index === 0 ? request.direction : undefined,
      goal,
      status: index === 0 ? doorGuide.status : (doorGuide.status === 'available' ? 'available' : 'needs_route'),
      recommendedCarNo: index === 0 && routeChoice?.mode === 'ANCHOR_WINDOW' ? recommendedCar.carNo : doorGuide.recommendedCarNo,
      recommendedDoorNo: doorGuide.recommendedDoorNo,
      anchorCarNo: index === 0 && routeChoice?.mode === 'ANCHOR_WINDOW' && doorGuide.status === 'available' ? doorGuide.recommendedCarNo : undefined,
      anchorDoorNo: index === 0 ? doorGuide.recommendedDoorNo : undefined,
      candidateCarNos: index === 0 && routeChoice?.mode === 'ANCHOR_WINDOW' ? routeChoice.candidateCarNos : undefined,
      positionLabel: index === 0 && routeChoice?.mode === 'ANCHOR_WINDOW'
        ? `${recommendedCar.carNo}번째 칸 추천 · ${routeChoice.anchorCarNo}번째 칸 주변`
        : index === 0 || doorGuide.status === 'available' ? doorGuide.positionLabel : '환승 후 탑승 위치 확인 필요',
      facility: doorGuide.facility,
      message: index === 0 && routeChoice?.mode === 'ANCHOR_WINDOW'
        ? `${routeChoice.anchorCarNo}번째 칸${routeChoice.anchorDoorNo ? ` · ${routeChoice.anchorDoorNo}번 문` : ''} 근처와 양옆 칸을 먼저 보고, 그 안에서 쾌적한 칸을 골랐어요.`
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
