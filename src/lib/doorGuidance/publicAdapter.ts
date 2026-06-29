import { getSeoulOpenApiBaseUrl, getSeoulOpenApiKey, getSeoulOpenApiTimeoutMs } from './config';
import { normalizeDirection, normalizeLine, normalizeStationName, parseCarDoor } from './normalize';
import type { DoorGuideLookupInput, DoorGuideRecord } from './types';

type SeoulGetFstExitRow = {
  lineNm?: unknown;
  stnCd?: unknown;
  stnNm?: unknown;
  crtrYmd?: unknown;
  drtnInfo?: unknown;
  qckgffVhclDoorNo?: unknown;
  plfmCmgFac?: unknown;
};

type FetchLike = typeof fetch;

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractRows(payload: unknown): SeoulGetFstExitRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;

  // Seoul Open API may respond with either {getFstExit:{row:[]}} or
  // public-data gateway shape {response:{body:{items:{item:[]}}}}.
  const getFstExit = root.getFstExit;
  if (getFstExit && typeof getFstExit === 'object') {
    const row = (getFstExit as Record<string, unknown>).row;
    return Array.isArray(row) ? row as SeoulGetFstExitRow[] : [];
  }

  const response = root.response;
  if (response && typeof response === 'object') {
    const body = (response as Record<string, unknown>).body;
    const items = body && typeof body === 'object' ? (body as Record<string, unknown>).items : undefined;
    const item = items && typeof items === 'object' ? (items as Record<string, unknown>).item : undefined;
    return Array.isArray(item) ? item as SeoulGetFstExitRow[] : [];
  }

  return [];
}

export function rowToDoorGuideRecord(row: SeoulGetFstExitRow, input: DoorGuideLookupInput): DoorGuideRecord | undefined {
  if (input.goal !== 'FINAL_EXIT') return undefined;

  const line = asString(row.lineNm);
  const stationName = asString(row.stnNm);
  const door = asString(row.qckgffVhclDoorNo);
  if (!line || !stationName || !door) return undefined;
  if (normalizeLine(line) !== normalizeLine(input.line)) return undefined;
  if (normalizeStationName(stationName) !== normalizeStationName(input.toStation)) return undefined;

  const parsed = parseCarDoor(door);
  if (!parsed) return undefined;

  return {
    line,
    stationName,
    stationCode: asString(row.stnCd) || undefined,
    directionKey: normalizeDirection(asString(row.drtnInfo)),
    goal: 'FINAL_EXIT',
    carNo: parsed.carNo,
    doorNo: parsed.doorNo,
    facility: asString(row.plfmCmgFac) || undefined,
    source: 'SEOUL_OPENAPI_GET_FST_EXIT',
    confidence: 'MEDIUM',
    updatedAt: asString(row.crtrYmd) || new Date().toISOString().slice(0, 10),
  };
}

function buildUrl(input: DoorGuideLookupInput) {
  const base = getSeoulOpenApiBaseUrl();
  const key = encodeURIComponent(getSeoulOpenApiKey());
  const line = encodeURIComponent(normalizeLine(input.line));
  const station = encodeURIComponent(normalizeStationName(input.toStation));
  // Path-style optional parameters follow Seoul Open API docs.
  return `${base}/${key}/json/getFstExit/1/50/lineNm/${line}/stnNm/${station}/`;
}

export async function fetchPublicDoorGuideRecords(input: DoorGuideLookupInput, fetchImpl: FetchLike = fetch): Promise<DoorGuideRecord[]> {
  const key = getSeoulOpenApiKey();
  if (!key || input.goal !== 'FINAL_EXIT') return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getSeoulOpenApiTimeoutMs());
  try {
    const response = await fetchImpl(buildUrl(input), { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => undefined);
    return extractRows(payload)
      .map((row) => rowToDoorGuideRecord(row, input))
      .filter((record): record is DoorGuideRecord => Boolean(record));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
