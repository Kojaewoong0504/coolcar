export const TMAP_DEFAULT_ENDPOINT = 'https://apis.openapi.sk.com/puzzle/subway/congestion/stat/car/stations';

export type TmapConfig = {
  appKey?: string;
  appKeySource?: 'TMAP_APP_KEY' | 'TMAP_APPKEY';
  endpoint: string;
  timeoutMs: number;
  diagnosticsEnabled: boolean;
  diagnosticsToken?: string;
  liveEnabled: boolean;
  cacheOnly: boolean;
};

export function redactSecret(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function getTmapConfig(): TmapConfig {
  const primary = process.env.TMAP_APP_KEY?.trim();
  const legacy = process.env.TMAP_APPKEY?.trim();
  const timeoutRaw = Number(process.env.TMAP_TIMEOUT_MS ?? 3500);
  const appKey = primary || legacy || undefined;
  return {
    appKey,
    appKeySource: primary ? 'TMAP_APP_KEY' : legacy ? 'TMAP_APPKEY' : undefined,
    endpoint: process.env.TMAP_CONGESTION_ENDPOINT?.trim() || TMAP_DEFAULT_ENDPOINT,
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw >= 500 ? timeoutRaw : 3500,
    diagnosticsEnabled: process.env.TMAP_DIAGNOSTICS_ENABLED === 'true',
    diagnosticsToken: process.env.TMAP_DIAGNOSTICS_TOKEN?.trim() || undefined,
    liveEnabled: process.env.TMAP_LIVE_ENABLED === 'true',
    cacheOnly: process.env.TMAP_CACHE_ONLY !== 'false',
  };
}

export function normalizeStationName(station: string): string {
  const trimmed = station.trim();
  if (!trimmed) return trimmed;
  return trimmed.endsWith('역') ? trimmed : `${trimmed}역`;
}

export function getKoreaTimeParts(targetTime?: string) {
  const date = targetTime ? new Date(targetTime) : new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  const dowMap: Record<string, string> = { Mon: 'MON', Tue: 'TUE', Wed: 'WED', Thu: 'THU', Fri: 'FRI', Sat: 'SAT', Sun: 'SUN' };
  return { dow: dowMap[parts.weekday] ?? 'MON', hh: parts.hour ?? '08' };
}

export function safeEndpointParts(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return { endpointHost: url.host, endpointPath: url.pathname };
  } catch {
    return { endpointHost: 'invalid-url', endpointPath: endpoint.slice(0, 120) };
  }
}
