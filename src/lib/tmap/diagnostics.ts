import { getKoreaTimeParts, getTmapConfig, normalizeStationName, redactSecret, safeEndpointParts } from './config';
import { findStationCode } from '../stations';
import { cacheGet, cacheSet, coalesce } from '../cache';

export type TmapDiagnosticCode =
  | 'LIVE_DISABLED'
  | 'ENV_MISSING'
  | 'UNAUTHORIZED_KEY'
  | 'PRODUCT_NOT_AUTHORIZED'
  | 'ACCESS_DENIED'
  | 'WRONG_ENDPOINT'
  | 'MALFORMED_PARAMS'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'NON_JSON_RESPONSE'
  | 'SCHEMA_MISMATCH'
  | 'OK'
  | 'UNKNOWN_ERROR';

export type TmapProbeInput = {
  line?: string;
  station?: string;
  targetTime?: string;
  dow?: string;
  hh?: string;
  force?: boolean;
};

export type TmapDiagnosticRecord = {
  provider: 'TMAP_SK_OPEN_API';
  ok: boolean;
  code: TmapDiagnosticCode;
  httpStatus?: number;
  message: string;
  endpointHost: string;
  endpointPath: string;
  appKeyPresent: boolean;
  appKeySource?: string;
  appKeyRedacted: string | null;
  params: { routeNm: string; stationNm: string; stationCode?: string; dow: string; hh: string };
  responseSnippet?: string;
  cacheHit?: boolean;
  cacheTtlSeconds?: number;
  durationMs: number;
  errorName?: string;
  errorMessage?: string;
  createdAt: string;
};

export type TmapClientResult = TmapDiagnosticRecord & {
  payload?: unknown;
  congestionCars?: number[];
};

function safeSnippet(text: string) {
  return text
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[REDACTED_TOKEN]')
    .slice(0, 500);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace('%', '').trim();
    const n = Number(normalized);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function numericArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const numbers = value.map(parseNumber);
  if (numbers.length >= 4 && numbers.every((n) => n !== null)) return numbers as number[];
  return null;
}

function objectArrayToNumbers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const candidates = value.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    return parseNumber(record.congestion ?? record.congestionRate ?? record.congestionPercent ?? record.value ?? record.rate);
  });
  if (candidates.every((n) => n !== null)) return candidates as number[];
  return null;
}

export function findTmapCongestionCars(payload: unknown): number[] | null {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) {
    const direct = numericArray(payload) ?? objectArrayToNumbers(payload);
    if (direct) return direct;
    for (const item of payload) {
      const found = findTmapCongestionCars(item);
      if (found) return found;
    }
    return null;
  }

  const record = payload as Record<string, unknown>;
  const exactKeys = [
    'congestionCar',
    'congestionCars',
    'carCongestion',
    'carCongestions',
    'subwayCarCongestion',
    'congestionList',
  ];

  for (const key of exactKeys) {
    const direct = numericArray(record[key]) ?? objectArrayToNumbers(record[key]);
    if (direct) return direct;
  }

  const containers = ['contents', 'stat', 'data', 'result', 'content', 'body', 'response'];
  for (const key of containers) {
    const found = findTmapCongestionCars(record[key]);
    if (found) return found;
  }

  return null;
}

function classifyHttp(status: number, bodyText: string): TmapDiagnosticCode {
  const upper = bodyText.toUpperCase();
  if (status === 401) return 'UNAUTHORIZED_KEY';
  if (status === 400) return 'MALFORMED_PARAMS';
  if (status === 404) return 'WRONG_ENDPOINT';
  if (status === 429) return upper.includes('QUOTA') ? 'QUOTA_EXCEEDED' : 'RATE_LIMITED';
  if (status === 403) {
    if (upper.includes('ACCESS_DENIED') || upper.includes('WHITELIST') || upper.includes('IP')) return 'ACCESS_DENIED';
    if (upper.includes('QUOTA')) return 'QUOTA_EXCEEDED';
    return 'PRODUCT_NOT_AUTHORIZED';
  }
  return 'UNKNOWN_ERROR';
}

function humanMessage(code: TmapDiagnosticCode, status?: number) {
  const messages: Record<TmapDiagnosticCode, string> = {
    LIVE_DISABLED: 'TMAP 월 10회 무료 quota 보호를 위해 실시간 외부 호출을 비활성화했습니다. 캐시 또는 추정으로 안내합니다.',
    ENV_MISSING: '서버 환경변수에 TMAP appKey가 없습니다.',
    UNAUTHORIZED_KEY: 'TMAP 게이트웨이가 appKey를 인증하지 못했습니다. 값/공백/앱 매핑을 확인해야 합니다.',
    PRODUCT_NOT_AUTHORIZED: 'appKey가 속한 앱의 TMAP 대중교통 상품/API 권한, 상품 활성 상태, 앱-상품 매핑, 또는 IP whitelist 허용 상태를 확인해야 합니다.',
    ACCESS_DENIED: '접근 허용 IP 또는 whitelist 정책에 막혔을 가능성이 있습니다.',
    WRONG_ENDPOINT: '요청 endpoint 또는 method가 문서와 다릅니다.',
    MALFORMED_PARAMS: '노선/역/요일/시간 파라미터 형식이 API 요구사항과 맞지 않습니다.',
    QUOTA_EXCEEDED: 'TMAP 상품 quota를 초과했습니다.',
    RATE_LIMITED: 'TMAP 호출 속도 제한에 걸렸습니다.',
    NETWORK_ERROR: 'TMAP 네트워크 호출에 실패했습니다.',
    TIMEOUT: 'TMAP 호출이 제한 시간 안에 끝나지 않았습니다.',
    NON_JSON_RESPONSE: 'TMAP 응답이 JSON이 아닙니다.',
    SCHEMA_MISMATCH: 'TMAP 응답은 성공했지만 칸별 혼잡도 배열 구조를 찾지 못했습니다.',
    OK: 'TMAP 칸별 혼잡도 응답을 정상 파싱했습니다.',
    UNKNOWN_ERROR: '분류되지 않은 TMAP 오류입니다.',
  };
  return status ? `${messages[code]} (HTTP ${status})` : messages[code];
}

function makeRecord<T extends Omit<TmapDiagnosticRecord, 'createdAt' | 'provider'>>(partial: T): T & TmapDiagnosticRecord {
  return { provider: 'TMAP_SK_OPEN_API', createdAt: new Date().toISOString(), ...partial };
}

export async function runTmapDiagnosticProbe(input: TmapProbeInput = {}): Promise<TmapClientResult> {
  const started = Date.now();
  const config = getTmapConfig();
  const endpoint = config.endpoint;
  const { endpointHost, endpointPath } = safeEndpointParts(endpoint);
  const parts = input.dow && input.hh ? { dow: input.dow, hh: input.hh } : getKoreaTimeParts(input.targetTime);
  const stationNm = normalizeStationName(input.station ?? '강남');
  const routeNm = input.line ?? '2호선';
  const stationCode = findStationCode(routeNm, stationNm) ?? undefined;
  const params = {
    routeNm,
    stationNm,
    stationCode,
    dow: parts.dow,
    hh: parts.hh,
  };

  const base = {
    endpointHost,
    endpointPath,
    appKeyPresent: Boolean(config.appKey),
    appKeySource: config.appKeySource,
    appKeyRedacted: redactSecret(config.appKey),
    params,
  };

  const appKey = config.appKey;
  if (!appKey) {
    return makeRecord({ ...base, ok: false, code: 'ENV_MISSING', message: humanMessage('ENV_MISSING'), durationMs: Date.now() - started });
  }

  if (!stationCode) {
    return makeRecord({
      ...base,
      ok: false,
      code: 'MALFORMED_PARAMS',
      message: `지하철 혼잡도 상품은 stationCode path parameter가 필요합니다. ${routeNm} ${stationNm}의 역 코드를 확인해야 합니다.`,
      durationMs: Date.now() - started,
    });
  }

  if (!config.liveEnabled && !input.force) {
    return makeRecord({
      ...base,
      ok: false,
      code: 'LIVE_DISABLED',
      message: humanMessage('LIVE_DISABLED'),
      cacheHit: false,
      cacheTtlSeconds: Number(process.env.TMAP_CACHE_TTL_SECONDS ?? 21600),
      durationMs: Date.now() - started,
    });
  }

  const cacheTtlSeconds = Number(process.env.TMAP_CACHE_TTL_SECONDS ?? 21600);
  const cacheKey = `tmap:congestion:stat-car:v2:${stationCode}:${params.dow}:${params.hh}`;
  if (!input.force) {
    const cached = await cacheGet<number[]>(cacheKey);
    if (cached) {
      return makeRecord({
        ...base,
        ok: true,
        code: 'OK',
        httpStatus: 200,
        message: 'TMAP 칸별 혼잡도 캐시를 사용했습니다.',
        cacheHit: true,
        cacheTtlSeconds,
        durationMs: Date.now() - started,
        congestionCars: cached,
      });
    }
  }

  return coalesce(`probe:${cacheKey}`, async () => {
    let response: Response;
    let bodyText = '';
  try {
    const url = new URL(`${endpoint.replace(/\/$/, '')}/${encodeURIComponent(stationCode)}`);
    url.searchParams.set('dow', params.dow);
    url.searchParams.set('hh', params.hh);

    response = await fetch(url, {
      method: 'GET',
      headers: { appKey, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    bodyText = await response.text();
  } catch (error) {
    const err = error as Error;
    const code: TmapDiagnosticCode = err.name === 'TimeoutError' || err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
    return makeRecord({
      ...base,
      ok: false,
      code,
      message: humanMessage(code),
      durationMs: Date.now() - started,
      errorName: err.name,
      errorMessage: safeSnippet(err.message),
    });
  }

  if (!response.ok) {
    const code = classifyHttp(response.status, bodyText);
    return makeRecord({
      ...base,
      ok: false,
      code,
      httpStatus: response.status,
      message: humanMessage(code, response.status),
      responseSnippet: safeSnippet(bodyText),
      durationMs: Date.now() - started,
    });
  }

  let payload: unknown;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    return makeRecord({
      ...base,
      ok: false,
      code: 'NON_JSON_RESPONSE',
      httpStatus: response.status,
      message: humanMessage('NON_JSON_RESPONSE', response.status),
      responseSnippet: safeSnippet(bodyText),
      durationMs: Date.now() - started,
    });
  }

  const congestionCars = findTmapCongestionCars(payload);
  if (!congestionCars) {
    return makeRecord({
      ...base,
      ok: false,
      code: 'SCHEMA_MISMATCH',
      httpStatus: response.status,
      message: humanMessage('SCHEMA_MISMATCH', response.status),
      responseSnippet: safeSnippet(bodyText),
      durationMs: Date.now() - started,
      payload,
    });
  }

  await cacheSet(cacheKey, congestionCars, cacheTtlSeconds);

  return makeRecord({
    ...base,
    ok: true,
    code: 'OK',
    httpStatus: response.status,
    message: humanMessage('OK', response.status),
    responseSnippet: safeSnippet(bodyText),
    cacheHit: false,
    cacheTtlSeconds,
    durationMs: Date.now() - started,
    payload,
    congestionCars,
  });
  });
}
