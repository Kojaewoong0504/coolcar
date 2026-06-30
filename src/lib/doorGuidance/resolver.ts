import { isSameLineDirectionSide } from '../routeDirection';
import { makeDoorGuideKey, normalizeDirection, normalizeLine, normalizeStationName } from './normalize';
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
    ? candidates.filter((record) => directionMatches(input, record, directionKey))
    : candidates;

  if (matched.length === 0) {
    return { status: 'needs_data', reason: '해당 방향의 문 위치 정보가 아직 없어요.' };
  }

  // Prefer escalator/stair records over elevator-only records for a general commuter default.
  const sorted = [...matched].sort((a, b) => {
    const score = (record: DoorGuideRecord) => {
      const facility = record.facility ?? '';
      if (facility.includes('에스컬레이터')) return 0;
      if (facility.includes('계단')) return 1;
      if (facility.includes('엘리베이터')) return 2;
      return 3;
    };
    return score(a) - score(b) || a.carNo - b.carNo || a.doorNo - b.doorNo;
  });

  const best = sorted[0];
  if (!best) return { status: 'needs_data', reason: '문 위치 정보를 찾지 못했어요.' };
  return { status: 'available', record: best, records: sorted };
}

export function lookupStaticDoorGuide(input: DoorGuideLookupInput): DoorGuideLookupResult {
  return resolveDoorGuideRecords(input, STATIC_DOOR_GUIDES);
}

export async function lookupDoorGuide(input: DoorGuideLookupInput): Promise<DoorGuideLookupResult> {
  const staticResult = lookupStaticDoorGuide(input);
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
