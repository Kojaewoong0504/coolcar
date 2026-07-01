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
  '5호선': {
    circular: false,
    stations: [
      '방화역', '개화산역', '김포공항역', '송정역', '마곡역', '발산역', '우장산역', '화곡역', '까치산역',
      '신정역', '목동역', '오목교역', '양평역', '영등포구청역', '영등포시장역', '신길역', '여의도역',
      '여의나루역', '마포역', '공덕역', '애오개역', '충정로역', '서대문역', '광화문역', '종로3가역',
      '을지로4가역', '동대문역사문화공원역', '청구역', '신금호역', '행당역', '왕십리역', '마장역',
      '답십리역', '장한평역', '군자역', '아차산역', '광나루역', '천호역', '강동역', '길동역', '굽은다리역',
      '명일역', '고덕역', '상일동역', '강일역', '미사역', '하남풍산역', '하남시청역', '하남검단산역',
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
  '3호선': {
    circular: false,
    stations: [
      '대화역', '주엽역', '정발산역', '마두역', '백석역', '대곡역', '화정역', '원당역', '원흥역', '삼송역',
      '지축역', '구파발역', '연신내역', '불광역', '녹번역', '홍제역', '무악재역', '독립문역', '경복궁역',
      '안국역', '종로3가역', '을지로3가역', '충무로역', '동대입구역', '약수역', '금호역', '옥수역',
      '압구정역', '신사역', '잠원역', '고속터미널역', '교대역', '남부터미널역', '양재역', '매봉역',
      '도곡역', '대치역', '학여울역', '대청역', '일원역', '수서역', '가락시장역', '경찰병원역', '오금역',
    ],
  },
  '4호선': {
    circular: false,
    stations: [
      '진접역', '오남역', '별내별가람역', '당고개역', '상계역', '노원역', '창동역', '쌍문역', '수유역', '미아역',
      '미아사거리역', '길음역', '성신여대입구역', '한성대입구역', '혜화역', '동대문역', '동대문역사문화공원역',
      '충무로역', '명동역', '회현역', '서울역', '숙대입구역', '삼각지역', '신용산역', '이촌역', '동작역',
      '이수역', '사당역', '남태령역', '선바위역', '경마공원역', '대공원역', '과천역', '정부과천청사역',
      '인덕원역', '평촌역', '범계역', '금정역', '산본역', '수리산역', '대야미역', '반월역', '상록수역',
      '한대앞역', '중앙역', '고잔역', '초지역', '안산역', '신길온천역', '정왕역', '오이도역',
    ],
  },
  '7호선': {
    circular: false,
    stations: [
      '장암역', '도봉산역', '수락산역', '마들역', '노원역', '중계역', '하계역', '공릉역', '태릉입구역',
      '먹골역', '중화역', '상봉역', '면목역', '사가정역', '용마산역', '중곡역', '군자역', '어린이대공원역',
      '건대입구역', '뚝섬유원지역', '청담역', '강남구청역', '학동역', '논현역', '반포역', '고속터미널역',
      '내방역', '이수역', '남성역', '숭실대입구역', '상도역', '장승배기역', '신대방삼거리역', '보라매역',
      '신풍역', '대림역', '남구로역', '가산디지털단지역', '철산역', '광명사거리역', '천왕역', '온수역',
      '까치울역', '부천종합운동장역', '춘의역', '신중동역', '부천시청역', '상동역', '삼산체육관역',
      '굴포천역', '부평구청역', '산곡역', '석남역',
    ],
  },
  '6호선': {
    circular: false,
    stations: [
      '응암역', '역촌역', '불광역', '독바위역', '연신내역', '구산역', '응암역', '새절역', '증산역',
      '디지털미디어시티역', '월드컵경기장역', '마포구청역', '망원역', '합정역', '상수역', '광흥창역',
      '대흥역', '공덕역', '효창공원앞역', '삼각지역', '녹사평역', '이태원역', '한강진역', '버티고개역',
      '약수역', '청구역', '신당역', '동묘앞역', '창신역', '보문역', '안암역', '고려대역', '월곡역',
      '상월곡역', '돌곶이역', '석계역', '태릉입구역', '화랑대역', '봉화산역', '신내역',
    ],
  },
  '경의중앙선': {
    circular: false,
    stations: [
      '문산역', '파주역', '월롱역', '금촌역', '금릉역', '운정역', '야당역', '탄현역', '일산역', '풍산역',
      '백마역', '곡산역', '대곡역', '능곡역', '행신역', '강매역', '화전역', '수색역', '디지털미디어시티역',
      '가좌역', '홍대입구역', '서강대역', '공덕역', '효창공원앞역', '용산역', '이촌역', '서빙고역',
      '한남역', '옥수역', '응봉역', '왕십리역', '청량리역', '회기역', '중랑역', '상봉역', '망우역',
      '양원역', '구리역', '도농역', '양정역', '덕소역',
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
