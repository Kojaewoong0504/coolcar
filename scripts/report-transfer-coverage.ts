import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { STATIC_DOOR_GUIDES } from '../src/lib/doorGuidance/staticFixture';

const INVENTORY_PATH = join(process.cwd(), 'data/door-guidance/transfer-inventory.json');
const OUTPUT_PATH = join(process.cwd(), 'data/door-guidance/transfer-coverage-report.json');

type InventoryPayload = {
  schemaVersion: number;
  generatedAt: string;
  stats: {
    totalStations: number;
    p0: number;
    p1: number;
    p2: number;
    needsMasterData: number;
    totalDirectedTransferPairs: number;
  };
  inventory: Array<{
    stationName: string;
    normalizedName: string;
    lines: string[];
    linePairs: Array<{ fromLine: string; toLine: string }>;
    priority: 'P0' | 'P1' | 'P2';
    status: 'candidate' | 'needs_master_data';
    notes?: string[];
  }>;
};

function normalizeStationName(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/역$/, '');
}

function normalizeLine(value?: string) {
  return (value ?? '').trim();
}

function transferKey(stationName: string, fromLine: string, toLine: string) {
  return `${normalizeStationName(stationName)}|${normalizeLine(fromLine)}|${normalizeLine(toLine)}`;
}

function main() {
  const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as InventoryPayload;
  const verifiedNextTransfer = STATIC_DOOR_GUIDES.filter((record) => record.goal === 'NEXT_TRANSFER' && record.targetLine);
  const verifiedTransferKeys = new Set(verifiedNextTransfer.map((record) => transferKey(record.stationName, record.line, record.targetLine ?? '')));

  const stations = inventory.inventory.map((item) => {
    const verifiedPairs = item.linePairs.filter((pair) => verifiedTransferKeys.has(transferKey(item.stationName, pair.fromLine, pair.toLine)));
    const missingPairs = item.linePairs.filter((pair) => !verifiedTransferKeys.has(transferKey(item.stationName, pair.fromLine, pair.toLine)));
    return {
      stationName: item.stationName,
      priority: item.priority,
      status: item.status,
      lines: item.lines,
      totalPairs: item.linePairs.length,
      verifiedNextTransferPairs: verifiedPairs.length,
      missingNextTransferPairs: missingPairs.length,
      coverageRatio: item.linePairs.length > 0 ? Number((verifiedPairs.length / item.linePairs.length).toFixed(4)) : 0,
      missingPairs,
      notes: item.notes ?? [],
    };
  });

  const totalVerifiedPairs = stations.reduce((sum, item) => sum + item.verifiedNextTransferPairs, 0);
  const totalPairs = inventory.stats.totalDirectedTransferPairs;
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceInventoryGeneratedAt: inventory.generatedAt,
    policy: {
      purpose: 'Operational coverage report for NEXT_TRANSFER anchors.',
      safety: 'Missing coverage is acceptable; fake or unverified car/door anchors are release blockers.',
      supportedRecommendationModes: ['ANCHOR_WINDOW only for verified DoorGuideRecord', 'COMFORT_ONLY for missing/ambiguous transfer anchors'],
    },
    summary: {
      totalStations: inventory.stats.totalStations,
      totalDirectedTransferPairs: totalPairs,
      verifiedNextTransferPairs: totalVerifiedPairs,
      missingNextTransferPairs: totalPairs - totalVerifiedPairs,
      coverageRatio: totalPairs > 0 ? Number((totalVerifiedPairs / totalPairs).toFixed(4)) : 0,
      p0Stations: inventory.stats.p0,
      p1Stations: inventory.stats.p1,
      p2Stations: inventory.stats.p2,
      needsMasterData: inventory.stats.needsMasterData,
      finalExitStaticRecords: STATIC_DOOR_GUIDES.filter((record) => record.goal === 'FINAL_EXIT').length,
      nextTransferStaticRecords: verifiedNextTransfer.length,
    },
    blockers: [
      ...(inventory.stats.needsMasterData > 0 ? [{ code: 'MASTER_DATA_INCOMPLETE', message: 'Station master has unresolved major transfer rows.' }] : []),
      ...(verifiedNextTransfer.length === 0 ? [{ code: 'NO_VERIFIED_NEXT_TRANSFER_ANCHORS', message: 'No verified NEXT_TRANSFER door anchors are available yet; product must stay in COMFORT_ONLY for these pairs.' }] : []),
    ],
    stations,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, outputPath: OUTPUT_PATH, summary: payload.summary, blockers: payload.blockers }, null, 2));
}

main();
