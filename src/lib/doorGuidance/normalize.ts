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
    .replace(/\(.+?\)/g, '');
  if (!compact) return undefined;
  if (compact === '내선') return 'INNER';
  if (compact === '외선') return 'OUTER';
  if (compact === '상행') return 'UP';
  if (compact === '하행') return 'DOWN';
  if (compact.endsWith('방면')) return `TOWARD_${compact.replace(/방면$/, '')}`;
  return `TOWARD_${compact}`;
}

export function makeDoorGuideKey(params: { line: string; stationName: string; goal: string; targetLine?: string }) {
  return [
    normalizeLine(params.line),
    normalizeStationName(params.stationName),
    params.goal,
    params.targetLine ? normalizeLine(params.targetLine) : '',
  ].join('|');
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
