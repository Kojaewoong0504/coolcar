import { readFileSync } from 'fs';
import { join } from 'path';
import { recommend } from '../src/lib/recommendation';

type InventoryPayload = {
  inventory: Array<{
    stationName: string;
    lines: string[];
    priority: 'P0' | 'P1' | 'P2';
    linePairs: Array<{ fromLine: string; toLine: string }>;
  }>;
};

const INVENTORY_PATH = join(process.cwd(), 'data/door-guidance/transfer-inventory.json');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sampleByStation(payload: InventoryPayload, stationName: string) {
  const item = payload.inventory.find((row) => row.stationName === stationName);
  assert(item, `${stationName} missing from inventory`);
  const pair = item.linePairs[0];
  assert(pair, `${stationName} has no transfer pairs`);
  return { item, pair };
}

async function assertNoFakeAnchorForStation(payload: InventoryPayload, stationName: string) {
  const { item, pair } = sampleByStation(payload, stationName);
  const result = await recommend({
    line: pair.fromLine,
    originStation: `${stationName}이전역`,
    destinationStation: `${stationName}다음역`,
    destinationLine: pair.toLine,
    direction: stationName.replace(/역$/, ''),
    transferStations: [stationName],
    comfortType: 'BALANCED',
  });

  assert(result.routeChoice.mode === 'COMFORT_ONLY', `${stationName}: inventory-only transfer must not produce ANCHOR_WINDOW`);
  assert(result.routeChoice.anchorCarNo === undefined, `${stationName}: inventory-only transfer must not expose anchorCarNo`);
  assert(result.routeChoice.anchorDoorNo === undefined, `${stationName}: inventory-only transfer must not expose anchorDoorNo`);
  const firstLeg = result.routeGuidance.legs[0];
  assert(firstLeg?.status !== 'available', `${stationName}: inventory-only transfer leg must not be available`);
  assert(!firstLeg?.anchorDoorNo, `${stationName}: inventory-only transfer must not expose anchorDoorNo on leg`);
  assert(!firstLeg?.recommendedDoorNo, `${stationName}: inventory-only transfer must not expose recommendedDoorNo on leg`);

  return {
    stationName: item.stationName,
    pair,
    routeChoiceMode: result.routeChoice.mode,
    firstLegStatus: firstLeg?.status,
    recommendedCarNo: result.recommendedCar.carNo,
  };
}

async function main() {
  const payload = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as InventoryPayload;
  const stationsToProbe = ['강남역', '고속터미널역', '사당역', '신도림역', '잠실역', '홍대입구역', '공덕역', '왕십리역'];
  const results = [];
  for (const stationName of stationsToProbe) {
    results.push(await assertNoFakeAnchorForStation(payload, stationName));
  }

  console.log(JSON.stringify({ ok: true, checked: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
