const LINE_ALIASES = new Map<string, string>([
  ['01호선', '1호선'],
  ['1', '1호선'],
  ['02호선', '2호선'],
  ['2', '2호선'],
  ['경의선', '경의중앙선'],
  ['수인분당', '수인분당선'],
]);

const STATION_ALIASES = new Map<string, string>([
  ['서울', '서울'],
  ['서울역', '서울'],
  ['고속터미널역', '고속터미널'],
  ['고속터미널', '고속터미널'],
]);

export function normalizeLine(value?: string) {
  const compact = (value ?? '').trim().replace(/\s+/g, '');
  return LINE_ALIASES.get(compact) ?? compact;
}

export function normalizeStationName(value?: string) {
  const compact = (value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\(.+?\)/g, '')
    .replace(/역$/, '');
  return STATION_ALIASES.get(compact) ?? compact;
}

export function normalizeDirection(value?: string) {
  const compact = (value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\(.+?\)/g, '')
    .replace(/쪽$/, '')
    .replace(/방향$/, '')
    .replace(/방면$/, '')
    .replace(/행$/, '')
    .replace(/역$/, '');
  const aliased = STATION_ALIASES.get(compact) ?? compact;
  if (!aliased) return undefined;
  if (aliased === '내선') return 'INNER';
  if (aliased === '외선') return 'OUTER';
  if (aliased === '상행') return 'UP';
  if (aliased === '하행') return 'DOWN';
  return `TOWARD_${aliased}`;
}

export function makeDoorGuideKey(params: { line: string; stationName: string; goal: string; targetLine?: string }) {
  return [
    normalizeLine(params.line),
    normalizeStationName(params.stationName),
    params.goal,
    params.targetLine ? normalizeLine(params.targetLine) : '',
  ].join('|');
}

export function normalizeFacilityType(value?: string) {
  const text = (value ?? '').trim();
  if (!text) return 'UNKNOWN' as const;
  if (text.includes('에스컬레이터') || /escalator/i.test(text)) return 'ESCALATOR' as const;
  if (text.includes('엘리베이터') || text.includes('승강기') || /elevator|lift/i.test(text)) return 'ELEVATOR' as const;
  if (text.includes('계단') || /stair/i.test(text)) return 'STAIRS' as const;
  if (text.includes('환승')) return 'TRANSFER_PASSAGE' as const;
  return 'UNKNOWN' as const;
}

export function parseCarDoor(value: string) {
  const match = value.trim().match(/^(\d{1,2})-(\d)$/);
  if (!match) return undefined;
  const carNo = Number(match[1]);
  const doorNo = Number(match[2]);
  if (!Number.isInteger(carNo) || !Number.isInteger(doorNo)) return undefined;
  if (carNo < 1 || carNo > 12 || doorNo < 1 || doorNo > 4) return undefined;
  return { carNo, doorNo };
}
