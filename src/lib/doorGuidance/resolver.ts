import { isSameLineDirectionSide } from '../routeDirection';
import { makeDoorGuideKey, normalizeDirection, normalizeFacilityType, normalizeLine, normalizeStationName } from './normalize';
import { fetchPublicDoorGuideRecords } from './publicAdapter';
import { STATIC_DOOR_GUIDES } from './staticFixture';
import type { DoorGuideLookupInput, DoorGuideLookupResult, DoorGuideRecord } from './types';

function keyForRecord(record: DoorGuideRecord) {
  return makeDoorGuideKey({
    line: record.line,
    stationName: record.stationName,
    goal: record.goal,
    targetLine: record.targetLine,
  });
}

function keyForInput(input: DoorGuideLookupInput) {
  return makeDoorGuideKey({
    line: input.line,
    stationName: input.toStation,
    goal: input.goal,
    targetLine: input.targetLine,
  });
}

const STATIC_DOOR_GUIDE_INDEX = STATIC_DOOR_GUIDES.reduce((index, record) => {
  const key = keyForRecord(record);
  const bucket = index.get(key) ?? [];
  bucket.push(record);
  index.set(key, bucket);
  return index;
}, new Map<string, DoorGuideRecord[]>());

function directionStationFromKey(directionKey?: string) {
  return directionKey?.startsWith('TOWARD_') ? directionKey.replace(/^TOWARD_/, '') : undefined;
}

function directionMatches(input: DoorGuideLookupInput, record: DoorGuideRecord, directionKey?: string) {
  if (!record.directionKey) return true;
  if (!directionKey) return false;
  if (record.directionKey === directionKey) return true;

  const inputDirectionStation = directionStationFromKey(directionKey);
  const recordDirectionStation = directionStationFromKey(record.directionKey);
  if (!inputDirectionStation || !recordDirectionStation) return false;

  return isSameLineDirectionSide({
    line: normalizeLine(input.line),
    atStation: normalizeStationName(input.toStation),
    inputDirection: inputDirectionStation,
    recordDirection: recordDirectionStation,
  });
}

function recordFacilityType(record: DoorGuideRecord) {
  return record.facilityType ?? normalizeFacilityType(record.facility);
}

function facilityRank(input: DoorGuideLookupInput, record: DoorGuideRecord) {
  const type = recordFacilityType(record);
  const preference = input.goal === 'FINAL_EXIT' ? input.egressPreference ?? 'ANY' : 'ANY';
  if (preference !== 'ANY') return type === preference ? 0 : 10;
  if (type === 'ESCALATOR') return 0;
  if (type === 'STAIRS') return 1;
  if (type === 'ELEVATOR') return 2;
  if (type === 'TRANSFER_PASSAGE') return 3;
  return 4;
}

export function resolveDoorGuideRecords(input: DoorGuideLookupInput, records: DoorGuideRecord[]): DoorGuideLookupResult {
  const candidates = records.filter((record) => keyForRecord(record) === keyForInput(input));
  if (candidates.length === 0) {
    return { status: 'needs_data', reason: '아직 이 구간의 문 위치 정보가 충분하지 않아요.' };
  }

  const directionKey = normalizeDirection(input.direction);
  const directionalCandidates = candidates.filter((record) => record.directionKey);

  if (directionalCandidates.length > 0 && !directionKey) {
    return { status: 'needs_direction', reason: '타는 방향에 따라 문 위치가 달라질 수 있어요.' };
  }

  const matched = directionKey
    ? (() => {
        const exact = candidates.filter((record) => record.directionKey === directionKey);
        return exact.length > 0 ? exact : candidates.filter((record) => directionMatches(input, record, directionKey));
      })()
    : candidates;

  if (matched.length === 0) {
    return { status: 'needs_data', reason: '해당 방향의 문 위치 정보가 아직 없어요.' };
  }

  const preferredMatched = input.goal === 'FINAL_EXIT' && input.egressPreference && input.egressPreference !== 'ANY'
    ? matched.filter((record) => facilityRank(input, record) === 0)
    : [];
  const rankedRecords = preferredMatched.length > 0 ? preferredMatched : matched;
  const sorted = [...rankedRecords].sort((a, b) => {
    return facilityRank(input, a) - facilityRank(input, b) || a.carNo - b.carNo || a.doorNo - b.doorNo;
  });

  const best = sorted[0];
  if (!best) return { status: 'needs_data', reason: '문 위치 정보를 찾지 못했어요.' };
  return { status: 'available', record: best, records: sorted };
}

export function lookupStaticDoorGuide(input: DoorGuideLookupInput): DoorGuideLookupResult {
  return resolveDoorGuideRecords(input, STATIC_DOOR_GUIDE_INDEX.get(keyForInput(input)) ?? []);
}

export async function lookupDoorGuide(input: DoorGuideLookupInput): Promise<DoorGuideLookupResult> {
  const staticResult = lookupStaticDoorGuide(input);
  if (staticResult.status === 'available' || staticResult.status === 'needs_direction') return staticResult;

  const apiRecords = await fetchPublicDoorGuideRecords(input);
  if (apiRecords.length > 0) {
    const apiResult = resolveDoorGuideRecords(input, apiRecords);
    if (apiResult.status === 'available') return apiResult;
    if (apiResult.status === 'needs_direction') return apiResult;
  }
  return staticResult;
}

export function listStaticDoorGuides() {
  return [...STATIC_DOOR_GUIDES];
}
