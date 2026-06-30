import { normalizeStationName } from './stations';

export type InferredDirection = {
  line: string;
  originStation: string;
  targetStation: string;
  boardDirectionStation: string;
  boardDirectionLabel: string;
  doorGuideDirection: string;
  path: string[];
};

const LINE_ORDERS: Record<string, { circular?: boolean; stations: string[] }> = {
  '2호선': {
    circular: true,
    stations: [
      '시청역', '을지로입구역', '을지로3가역', '을지로4가역', '동대문역사문화공원역', '신당역', '상왕십리역', '왕십리역',
      '한양대역', '뚝섬역', '성수역', '건대입구역', '구의역', '강변역', '잠실나루역', '잠실역', '잠실새내역', '종합운동장역',
      '삼성역', '선릉역', '역삼역', '강남역', '교대역', '서초역', '방배역', '사당역', '낙성대역', '서울대입구역',
      '봉천역', '신림역', '신대방역', '구로디지털단지역', '대림역', '신도림역', '문래역', '영등포구청역', '당산역',
      '합정역', '홍대입구역', '신촌역', '이대역', '아현역', '충정로역',
    ],
  },
};

function stationKey(value: string) {
  return normalizeStationName(value);
}

function withStationSuffix(value: string) {
  return value.endsWith('역') ? value : `${value}역`;
}

function pathBetween(order: string[], fromIndex: number, toIndex: number, direction: 1 | -1, circular: boolean) {
  const path = [order[fromIndex]];
  let cursor = fromIndex;
  while (cursor !== toIndex) {
    cursor += direction;
    if (circular) {
      if (cursor < 0) cursor = order.length - 1;
      if (cursor >= order.length) cursor = 0;
    }
    if (!circular && (cursor < 0 || cursor >= order.length)) return [];
    path.push(order[cursor]);
    if (path.length > order.length + 1) return [];
  }
  return path;
}

export function inferLineDirection(params: { line: string; originStation: string; targetStation?: string }): InferredDirection | undefined {
  const config = LINE_ORDERS[params.line];
  if (!config || !params.targetStation) return undefined;

  const order = config.stations;
  const originKey = stationKey(params.originStation);
  const targetKey = stationKey(params.targetStation);
  const originIndex = order.findIndex((station) => stationKey(station) === originKey);
  const targetIndex = order.findIndex((station) => stationKey(station) === targetKey);
  if (originIndex < 0 || targetIndex < 0 || originIndex === targetIndex) return undefined;

  const forwardPath = pathBetween(order, originIndex, targetIndex, 1, Boolean(config.circular));
  const backwardPath = pathBetween(order, originIndex, targetIndex, -1, Boolean(config.circular));
  const candidates = [forwardPath, backwardPath].filter((path) => path.length >= 2);
  if (!candidates.length) return undefined;
  const path = candidates.sort((a, b) => a.length - b.length)[0];
  const boardDirectionStation = path[1];
  const boardSecond = path[2] && path[2] !== params.targetStation ? path[2] : undefined;
  const targetOrderIndex = order.findIndex((station) => stationKey(station) === stationKey(path[path.length - 1]));
  const prevIndex = order.findIndex((station) => stationKey(station) === stationKey(path[path.length - 2]));
  const step = ((targetOrderIndex - prevIndex + order.length) % order.length) === 1 ? 1 : -1;
  let nextAfterTarget = targetOrderIndex + step;
  if (config.circular) {
    if (nextAfterTarget < 0) nextAfterTarget = order.length - 1;
    if (nextAfterTarget >= order.length) nextAfterTarget = 0;
  }
  const doorGuideDirection = order[nextAfterTarget] ?? boardDirectionStation;
  return {
    line: params.line,
    originStation: withStationSuffix(params.originStation),
    targetStation: withStationSuffix(params.targetStation),
    boardDirectionStation,
    boardDirectionLabel: boardSecond ? `${stationKey(boardDirectionStation)}/${stationKey(boardSecond)} 방면` : `${stationKey(boardDirectionStation)} 방면`,
    doorGuideDirection: stationKey(doorGuideDirection),
    path,
  };
}
