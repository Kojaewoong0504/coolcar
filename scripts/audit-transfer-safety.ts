import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { listStaticDoorGuides } from '../src/lib/doorGuidance/resolver';
import { makeDoorGuideKey } from '../src/lib/doorGuidance/normalize';
import type { DoorGuideRecord } from '../src/lib/doorGuidance/types';

type Priority = 'P0' | 'P1' | 'P2';

type InventoryPayload = {
  stats: {
    totalStations: number;
    totalDirectedTransferPairs: number;
    needsMasterData: number;
  };
  inventory: Array<{
    stationName: string;
    normalizedName: string;
    priority: Priority;
    lines: string[];
    linePairs: Array<{ fromLine: string; toLine: string }>;
  }>;
};

type Failure = {
  severity: 'P0' | 'P1' | 'P2';
  code: string;
  message: string;
  stationName?: string;
  fromLine?: string;
  toLine?: string;
};

const INVENTORY_PATH = join(process.cwd(), 'data/door-guidance/transfer-inventory.json');
const OUT_DIR = join(process.cwd(), 'artifacts');
const OUT_PATH = join(OUT_DIR, 'transfer-safety-audit.json');
const OFFICIAL_SOURCES = new Set(['SEOUL_METRO_TRANSFER_CSV', 'MOLIT_QUICK_TRANSFER_CSV']);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function transferKey(stationName: string, fromLine: string, toLine: string) {
  return makeDoorGuideKey({
    line: fromLine,
    stationName,
    goal: 'NEXT_TRANSFER',
    targetLine: toLine,
  });
}

function recordKey(record: DoorGuideRecord) {
  return transferKey(record.stationName, record.line, record.targetLine ?? '');
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

function stationRiskScore(params: { priority: Priority; totalPairs: number; officialMissing: number; productionMissing: number; zeroOfficial: boolean; lines: string[] }) {
  const priorityWeight = params.priority === 'P0' ? 100 : params.priority === 'P1' ? 60 : 25;
  const zeroPenalty = params.zeroOfficial ? 50 : 0;
  const complexityPenalty = Math.max(0, params.lines.length - 2) * 12;
  return priorityWeight + params.officialMissing * 20 + params.productionMissing * 8 + zeroPenalty + complexityPenalty;
}

function main() {
  const payload = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as InventoryPayload;
  const records = listStaticDoorGuides();
  const nextTransferRecords = records.filter((record) => record.goal === 'NEXT_TRANSFER' && record.targetLine);
  const officialRecords = nextTransferRecords.filter((record) => OFFICIAL_SOURCES.has(record.source));

  const productionKeys = new Set(nextTransferRecords.map(recordKey));
  const officialKeys = new Set(officialRecords.map(recordKey));
  const inventoryKeys = new Set<string>();
  const failures: Failure[] = [];

  for (const record of nextTransferRecords) {
    if (record.carNo < 1 || record.carNo > 12) failures.push({ severity: 'P0', code: 'CAR_OUT_OF_RANGE', message: `${record.line} ${record.stationName} ${record.targetLine}: carNo=${record.carNo}` });
    if (record.doorNo < 1 || record.doorNo > 4) failures.push({ severity: 'P0', code: 'DOOR_OUT_OF_RANGE', message: `${record.line} ${record.stationName} ${record.targetLine}: doorNo=${record.doorNo}` });
  }

  const keyedRecords = new Map<string, DoorGuideRecord[]>();
  for (const record of nextTransferRecords) {
    const key = `${recordKey(record)}|${record.directionKey ?? 'NO_DIRECTION'}|${record.source}`;
    keyedRecords.set(key, [...(keyedRecords.get(key) ?? []), record]);
  }
  for (const [key, group] of keyedRecords) {
    const uniqueCarDoors = new Set(group.map((record) => `${record.carNo}-${record.doorNo}`));
    // Multiple same-direction anchor doors can be legitimate: users may have two nearby stairways/transfer passages.
    // The generator already suppresses known ambiguous official conflicts before production exposure; here we only flag
    // suspiciously broad same-key groups that would make the anchor window too wide to be useful.
    if (uniqueCarDoors.size > 4) {
      failures.push({ severity: 'P1', code: 'BROAD_MULTI_ANCHOR_REVIEW_REQUIRED', message: `${key}: unusually many car-door values ${[...uniqueCarDoors].join(', ')}` });
    }
  }

  const stations = payload.inventory.map((station) => {
    const pairs = station.linePairs.map((pair) => {
      const key = transferKey(station.stationName, pair.fromLine, pair.toLine);
      inventoryKeys.add(key);
      return {
        ...pair,
        hasProductionAnchor: productionKeys.has(key),
        hasOfficialAnchor: officialKeys.has(key),
      };
    });
    const productionVerified = pairs.filter((pair) => pair.hasProductionAnchor).length;
    const officialVerified = pairs.filter((pair) => pair.hasOfficialAnchor).length;
    const totalPairs = pairs.length;
    const officialMissingPairs = pairs.filter((pair) => !pair.hasOfficialAnchor);
    return {
      stationName: station.stationName,
      priority: station.priority,
      lines: station.lines,
      totalPairs,
      productionVerifiedPairs: productionVerified,
      productionMissingPairs: totalPairs - productionVerified,
      productionCoverageRatio: pct(productionVerified, totalPairs),
      officialVerifiedPairs: officialVerified,
      officialMissingPairs: totalPairs - officialVerified,
      officialCoverageRatio: pct(officialVerified, totalPairs),
      riskScore: stationRiskScore({
        priority: station.priority,
        totalPairs,
        officialMissing: totalPairs - officialVerified,
        productionMissing: totalPairs - productionVerified,
        zeroOfficial: officialVerified === 0,
        lines: station.lines,
      }),
      missingOfficialPairs: officialMissingPairs.map(({ fromLine, toLine }) => ({ fromLine, toLine })),
      pairs,
    };
  }).sort((a, b) => b.riskScore - a.riskScore || a.stationName.localeCompare(b.stationName, 'ko'));

  for (const key of productionKeys) {
    if (!inventoryKeys.has(key)) {
      failures.push({ severity: 'P1', code: 'PRODUCTION_ANCHOR_OUTSIDE_INVENTORY', message: `Production NEXT_TRANSFER anchor is not represented in inventory: ${key}` });
    }
  }

  for (const station of stations.filter((item) => item.priority === 'P0')) {
    if (station.totalPairs > 0 && station.productionVerifiedPairs === 0) {
      failures.push({ severity: 'P1', code: 'P0_STATION_ZERO_PRODUCTION_COVERAGE', stationName: station.stationName, message: `${station.stationName}: P0 transfer station has no production NEXT_TRANSFER anchors` });
    }
    if (station.totalPairs > 0 && station.officialVerifiedPairs === 0) {
      failures.push({ severity: 'P1', code: 'P0_STATION_ZERO_OFFICIAL_COVERAGE', stationName: station.stationName, message: `${station.stationName}: P0 transfer station has no official/public NEXT_TRANSFER anchors` });
    }
  }

  const summary = {
    totalStations: payload.stats.totalStations,
    totalDirectedTransferPairs: payload.stats.totalDirectedTransferPairs,
    needsMasterData: payload.stats.needsMasterData,
    productionVerifiedPairs: stations.reduce((sum, station) => sum + station.productionVerifiedPairs, 0),
    productionMissingPairs: stations.reduce((sum, station) => sum + station.productionMissingPairs, 0),
    productionCoverageRatio: pct(stations.reduce((sum, station) => sum + station.productionVerifiedPairs, 0), payload.stats.totalDirectedTransferPairs),
    officialVerifiedPairs: stations.reduce((sum, station) => sum + station.officialVerifiedPairs, 0),
    officialMissingPairs: stations.reduce((sum, station) => sum + station.officialMissingPairs, 0),
    officialCoverageRatio: pct(stations.reduce((sum, station) => sum + station.officialVerifiedPairs, 0), payload.stats.totalDirectedTransferPairs),
    nextTransferStaticRecords: nextTransferRecords.length,
    officialNextTransferStaticRecords: officialRecords.length,
  };

  assert(summary.totalStations === payload.inventory.length, 'inventory stats totalStations mismatch');
  assert(summary.totalDirectedTransferPairs === stations.reduce((sum, station) => sum + station.totalPairs, 0), 'inventory stats pair count mismatch');
  assert(summary.needsMasterData === 0, 'station master still has unresolved major transfer gaps');

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: {
      productionAnchorRule: 'Use only verified DoorGuideRecord rows for NEXT_TRANSFER. Inventory rows never create car/door anchors.',
      officialCoverageRule: 'Official/public source coverage is tracked separately from curated field overrides.',
    },
    summary,
    failures,
    topGaps: stations.slice(0, 12).map((station) => ({
      stationName: station.stationName,
      priority: station.priority,
      lines: station.lines,
      riskScore: station.riskScore,
      officialCoverageRatio: station.officialCoverageRatio,
      officialMissingPairs: station.officialMissingPairs,
      productionCoverageRatio: station.productionCoverageRatio,
      productionMissingPairs: station.productionMissingPairs,
    })),
    stations,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  const p0Failures = failures.filter((failure) => failure.severity === 'P0');
  assert(p0Failures.length === 0, `P0 transfer safety audit failures: ${p0Failures.map((failure) => failure.code).join(', ')}`);

  console.log(JSON.stringify({
    ok: true,
    reportPath: OUT_PATH,
    summary,
    failureCounts: {
      P0: p0Failures.length,
      P1: failures.filter((failure) => failure.severity === 'P1').length,
      P2: failures.filter((failure) => failure.severity === 'P2').length,
    },
    topGaps: report.topGaps.slice(0, 6),
  }, null, 2));
}

main();
