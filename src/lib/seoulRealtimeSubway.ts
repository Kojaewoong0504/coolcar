export type SeoulRealtimeArrival = {
  subwayId: string;
  lineName?: string;
  updnLine: string;
  trainLineNm: string;
  statnNm: string;
  barvlDt: number | null;
  btrainNo: string;
  bstatnNm: string;
  recptnDt: string;
  arvlMsg2: string;
  arvlMsg3: string;
  arvlCd: string;
  arvlStatusLabel: string;
  lstcarAt: boolean;
};

type SeoulRealtimeRawRow = Record<string, unknown>;

const SUBWAY_ID_TO_LINE: Record<string, string> = {
  '1001': '1호선',
  '1002': '2호선',
  '1003': '3호선',
  '1004': '4호선',
  '1005': '5호선',
  '1006': '6호선',
  '1007': '7호선',
  '1008': '8호선',
  '1009': '9호선',
  '1061': '중앙선',
  '1063': '경의중앙선',
  '1065': '공항철도',
  '1067': '경춘선',
  '1075': '수인분당선',
  '1077': '신분당선',
  '1092': '우이신설선',
  '1032': 'GTX-A',
};

const ARRIVAL_CODE_LABEL: Record<string, string> = {
  '0': '진입',
  '1': '도착',
  '2': '출발',
  '3': '전역 출발',
  '4': '전역 진입',
  '5': '전역 도착',
  '99': '운행중',
};

const STATION_QUERY_ALIASES = new Map<string, string>([
  ['서울역', '서울'],
  ['응암역', '응암순환(상선)'],
  ['공릉역', '공릉(서울산업대입구)'],
  ['남한산성입구역', '남한산성입구(성남법원, 검찰청)'],
  ['대모산입구역', '대모산'],
  ['천호역', '천호(풍납토성)'],
  ['몽촌토성역', '몽촌토성(평화의문)'],
]);

function env(name: string) {
  return process.env[name]?.trim() ?? '';
}

export function getSeoulRealtimeSubwayKey() {
  return env('SEOUL_REALTIME_SUBWAY_API_KEY') || env('SEOUL_SUBWAY_REALTIME_API_KEY') || env('SEOUL_OPENAPI_KEY') || env('SEOUL_OPEN_API_KEY');
}

export function getSeoulRealtimeSubwayBaseUrl() {
  return (env('SEOUL_REALTIME_SUBWAY_BASE_URL') || 'http://swopenAPI.seoul.go.kr/api/subway').replace(/\/+$/, '');
}

export function isSeoulRealtimeSubwayEnabled() {
  return Boolean(getSeoulRealtimeSubwayKey()) && process.env.SEOUL_REALTIME_SUBWAY_ENABLED === 'true';
}

export function normalizeRealtimeStationQuery(stationName: string) {
  const trimmed = stationName.trim();
  const withSuffix = trimmed.endsWith('역') ? trimmed : `${trimmed}역`;
  return STATION_QUERY_ALIASES.get(withSuffix) ?? trimmed.replace(/역$/, '');
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function asSeconds(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeRealtimeArrival(row: SeoulRealtimeRawRow): SeoulRealtimeArrival {
  const subwayId = asString(row.subwayId);
  const arvlCd = asString(row.arvlCd);
  return {
    subwayId,
    lineName: SUBWAY_ID_TO_LINE[subwayId],
    updnLine: asString(row.updnLine),
    trainLineNm: asString(row.trainLineNm),
    statnNm: asString(row.statnNm),
    barvlDt: asSeconds(row.barvlDt),
    btrainNo: asString(row.btrainNo),
    bstatnNm: asString(row.bstatnNm),
    recptnDt: asString(row.recptnDt),
    arvlMsg2: asString(row.arvlMsg2),
    arvlMsg3: asString(row.arvlMsg3),
    arvlCd,
    arvlStatusLabel: ARRIVAL_CODE_LABEL[arvlCd] ?? '정보 없음',
    lstcarAt: asString(row.lstcarAt) === '1',
  };
}

export async function fetchSeoulRealtimeArrivals(params: {
  stationName: string;
  startIndex?: number;
  endIndex?: number;
  enabledOverride?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ status: 'available'; arrivals: SeoulRealtimeArrival[]; totalCount?: number } | { status: 'disabled' | 'needs_key' | 'needs_data' | 'error'; reason: string }> {
  const key = getSeoulRealtimeSubwayKey();
  if (!key) return { status: 'needs_key', reason: 'SEOUL_REALTIME_SUBWAY_API_KEY is not configured.' };
  if (!params.enabledOverride && !isSeoulRealtimeSubwayEnabled()) {
    return { status: 'disabled', reason: 'SEOUL_REALTIME_SUBWAY_ENABLED is not true.' };
  }

  const start = params.startIndex ?? 0;
  const end = params.endIndex ?? 10;
  const station = encodeURIComponent(normalizeRealtimeStationQuery(params.stationName));
  const url = `${getSeoulRealtimeSubwayBaseUrl()}/${encodeURIComponent(key)}/json/realtimeStationArrival/${start}/${end}/${station}`;
  const fetchImpl = params.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) return { status: 'error', reason: `HTTP ${response.status}` };
    const payload = await response.json() as Record<string, unknown>;
    const rawRows = Array.isArray(payload.realtimeArrivalList) ? payload.realtimeArrivalList as SeoulRealtimeRawRow[] : [];
    if (rawRows.length === 0) {
      const error = payload.errorMessage as Record<string, unknown> | undefined;
      return { status: 'needs_data', reason: asString(error?.message) || 'No realtime arrivals returned.' };
    }
    return {
      status: 'available',
      totalCount: Number(payload.list_total_count) || rawRows.length,
      arrivals: rawRows.map(normalizeRealtimeArrival),
    };
  } catch (error) {
    return { status: 'error', reason: error instanceof Error ? error.message : 'Unknown realtime API error' };
  }
}
