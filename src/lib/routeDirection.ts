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

export const LINE_ORDERS: Record<string, { circular?: boolean; stations: string[] }> = {
  '1호선': {
    circular: false,
    stations: [
      '연천역', '전곡역', '청산역', '소요산역', '동두천역', '보산역', '동두천중앙역', '지행역', '덕정역', '덕계역',
      '양주역', '녹양역', '가능역', '의정부역', '회룡역', '망월사역', '도봉산역', '도봉역', '방학역', '창동역',
      '녹천역', '월계역', '광운대역', '석계역', '신이문역', '외대앞역', '회기역', '청량리역', '제기동역',
      '신설동역', '동묘앞역', '동대문역', '종로5가역', '종로3가역', '종각역', '시청역', '서울역', '남영역',
      '용산역', '노량진역', '대방역', '신길역', '영등포역', '신도림역', '구로역', '가산디지털단지역', '독산역',
      '금천구청역', '석수역', '관악역', '안양역', '명학역', '금정역', '군포역', '당정역', '의왕역', '성균관대역',
      '화서역', '수원역', '세류역', '병점역', '세마역', '오산대역', '오산역', '진위역', '송탄역', '서정리역',
      '평택지제역', '평택역', '성환역', '직산역', '두정역', '천안역', '봉명역', '쌍용역', '아산역', '탕정역',
      '배방역', '온양온천역', '신창역',
    ],
  },
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
  '9호선': {
    circular: false,
    stations: [
      '개화역', '김포공항역', '공항시장역', '신방화역', '마곡나루역', '양천향교역', '가양역', '증미역',
      '등촌역', '염창역', '신목동역', '선유도역', '당산역', '국회의사당역', '여의도역', '샛강역',
      '노량진역', '노들역', '흑석역', '동작역', '구반포역', '신반포역', '고속터미널역', '사평역',
      '신논현역', '언주역', '선정릉역', '삼성중앙역', '봉은사역', '종합운동장역', '삼전역',
      '석촌고분역', '석촌역', '송파나루역', '한성백제역', '올림픽공원역', '둔촌오륜역', '중앙보훈병원역',
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

function directionSide(order: string[], atStation: string, directionStation: string, circular: boolean) {
  const atKey = stationKey(atStation);
  const directionKey = stationKey(directionStation);
  const atIndex = order.findIndex((station) => stationKey(station) === atKey);
  const directionIndex = order.findIndex((station) => stationKey(station) === directionKey);
  if (atIndex < 0 || directionIndex < 0 || atIndex === directionIndex) return undefined;

  if (!circular) return directionIndex > atIndex ? 1 : -1;

  const forwardDistance = (directionIndex - atIndex + order.length) % order.length;
  const backwardDistance = (atIndex - directionIndex + order.length) % order.length;
  return forwardDistance <= backwardDistance ? 1 : -1;
}

export function isSameLineDirectionSide(params: { line: string; atStation: string; inputDirection: string; recordDirection: string }) {
  const config = LINE_ORDERS[params.line];
  if (!config) return false;
  const inputSide = directionSide(config.stations, params.atStation, params.inputDirection, Boolean(config.circular));
  const recordSide = directionSide(config.stations, params.atStation, params.recordDirection, Boolean(config.circular));
  return inputSide !== undefined && inputSide === recordSide;
}

export function estimateStationDistance(params: { line: string; originStation: string; targetStation?: string }): number | undefined {
  const config = LINE_ORDERS[params.line];
  if (!config || !params.targetStation) return undefined;

  const order = config.stations;
  const originKey = stationKey(params.originStation);
  const targetKey = stationKey(params.targetStation);
  const originIndex = order.findIndex((station) => stationKey(station) === originKey);
  const targetIndex = order.findIndex((station) => stationKey(station) === targetKey);
  if (originIndex < 0 || targetIndex < 0) return undefined;
  const raw = Math.abs(targetIndex - originIndex);
  return config.circular ? Math.min(raw, order.length - raw) : raw;
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
