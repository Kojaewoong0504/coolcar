import { readFileSync } from 'fs';
import { join } from 'path';

const INVENTORY_PATH = join(process.cwd(), 'data/door-guidance/transfer-inventory.json');

type InventoryPayload = {
  schemaVersion: number;
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
    source: string[];
    lat?: number;
    lng?: number;
    notes?: string[];
  }>;
};

const requiredMajorStations = [
  '서울',
  '강남',
  '고속터미널',
  '교대',
  '사당',
  '신도림',
  '잠실',
  '홍대입구',
  '종로3가',
  '동대문역사문화공원',
  '여의도',
  '공덕',
  '왕십리',
  '건대입구',
  '합정',
  '김포공항',
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pairKey(pair: { fromLine: string; toLine: string }) {
  return `${pair.fromLine}->${pair.toLine}`;
}

function main() {
  const payload = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as InventoryPayload;
  assert(payload.schemaVersion === 1, 'inventory schemaVersion must be 1');
  assert(payload.inventory.length === payload.stats.totalStations, 'stats.totalStations mismatch');
  assert(payload.inventory.length >= 50, 'inventory should include broad Seoul transfer candidates');

  const byName = new Map(payload.inventory.map((item) => [item.normalizedName, item]));
  for (const name of requiredMajorStations) {
    assert(byName.has(name), `required major transfer station missing: ${name}`);
  }

  let directedPairCount = 0;
  for (const item of payload.inventory) {
    assert(item.stationName.endsWith('역'), `${item.stationName}: stationName must end with 역`);
    assert(item.lines.length >= 2, `${item.stationName}: transfer inventory item must have at least two lines`);
    assert(!('carNo' in item), `${item.stationName}: inventory must not contain carNo`);
    assert(!('doorNo' in item), `${item.stationName}: inventory must not contain doorNo`);
    assert(item.status === 'candidate' || item.status === 'needs_master_data', `${item.stationName}: invalid status`);

    const expectedPairCount = item.lines.length * (item.lines.length - 1);
    assert(item.linePairs.length === expectedPairCount, `${item.stationName}: directed line pair count mismatch`);
    const uniquePairs = new Set(item.linePairs.map(pairKey));
    assert(uniquePairs.size === item.linePairs.length, `${item.stationName}: duplicate line pairs`);
    for (const pair of item.linePairs) {
      assert(pair.fromLine !== pair.toLine, `${item.stationName}: self transfer pair is invalid`);
      assert(item.lines.includes(pair.fromLine), `${item.stationName}: fromLine missing from lines`);
      assert(item.lines.includes(pair.toLine), `${item.stationName}: toLine missing from lines`);
    }
    directedPairCount += item.linePairs.length;
  }

  assert(directedPairCount === payload.stats.totalDirectedTransferPairs, 'stats.totalDirectedTransferPairs mismatch');

  const major = payload.inventory.filter((item) => item.priority === 'P0');
  const needsMasterData = payload.inventory.filter((item) => item.status === 'needs_master_data');
  console.log(JSON.stringify({
    ok: true,
    totalStations: payload.stats.totalStations,
    directedTransferPairs: payload.stats.totalDirectedTransferPairs,
    p0Stations: major.length,
    needsMasterData: needsMasterData.map((item) => ({ stationName: item.stationName, lines: item.lines, notes: item.notes ?? [] })),
  }, null, 2));
}

main();
