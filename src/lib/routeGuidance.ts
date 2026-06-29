import type { CarComfort, RecommendRequest, RouteGuidance, RouteLegGuidance } from './types';

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
  positionLabel: string;
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
    positionLabel: params.positionLabel,
    message: params.message,
  };
}

export function buildRouteGuidance(request: RecommendRequest, recommendedCar: CarComfort): RouteGuidance {
  const origin = cleanStationName(request.originStation);
  const destination = cleanStationName(request.destinationStation) || '목적지';
  const transfers = uniqueStations(request.transferStations, origin, destination);
  const disclaimer = '전체 이동 경로를 대신 정해주는 기능이 아니라, 선택한 이동 경로에서 타기 좋은 위치를 안내하는 참고 정보예요.';

  if (transfers.length === 0 && sameLine(request)) {
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
          status: 'needs_data',
          recommendedCarNo: recommendedCar.carNo,
          positionLabel: `${recommendedCar.carNo}번째 칸 근처`,
          message: '빠른하차 문 정보가 연결되면 몇 번 문까지 보여드릴게요. 지금은 쾌적칸 추천을 기준으로 안내해요.',
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
  const legs = waypoints.slice(0, -1).map((fromStation, index) => {
    const toStation = waypoints[index + 1];
    const isLast = index === waypoints.length - 2;
    const carNo = index === 0 ? recommendedCar.carNo : undefined;
    return baseLeg({
      legNo: index + 1,
      fromStation,
      toStation,
      line: index === 0 ? request.line : (isLast ? request.destinationLine || '환승 후 노선' : '환승 후 노선'),
      direction: index === 0 ? request.direction : undefined,
      goal: isLast ? 'FINAL_EXIT' : 'NEXT_TRANSFER',
      status: index === 0 ? 'needs_data' : 'needs_route',
      recommendedCarNo: carNo,
      positionLabel: carNo ? `${carNo}번째 칸 근처` : '환승 후 탑승 위치 확인 필요',
      message: index === 0
        ? '환승역을 기준으로 빠른 문 데이터가 연결되면 몇 번 문까지 표시할 수 있어요.'
        : '이 구간은 환승 후 노선과 방향 데이터가 더 필요해요. 잘못된 문 위치를 안내하지 않도록 참고 상태로 표시합니다.',
    });
  });

  return {
    status: 'limited',
    summary: `환승역 ${transfers.length}개를 기준으로 ${legs.length}개 구간을 나눠봤어요.`,
    disclaimer,
    legs,
  };
}
