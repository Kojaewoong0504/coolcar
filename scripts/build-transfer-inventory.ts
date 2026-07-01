import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { STATIONS, type Station } from '../src/lib/stations';

const OUTPUT_PATH = join(process.cwd(), 'data/door-guidance/transfer-inventory.json');
const SEOUL_METRO_BBOX = {
  minLat: 37.0,
  maxLat: 37.85,
  minLng: 126.7,
  maxLng: 127.25,
};
const CLUSTER_THRESHOLD_METERS = 300;

const MAJOR_TRANSFER_SEEDS = [
  { name: '서울역', lines: ['1호선', '4호선', '공항철도', '경의중앙선'], priority: 'P0' },
  { name: '강남역', lines: ['2호선', '신분당선'], priority: 'P0' },
  { name: '고속터미널역', lines: ['3호선', '7호선', '9호선'], priority: 'P0' },
  { name: '교대역', lines: ['2호선', '3호선'], priority: 'P0' },
  { name: '사당역', lines: ['2호선', '4호선'], priority: 'P0' },
  { name: '신도림역', lines: ['1호선', '2호선'], priority: 'P0' },
  { name: '잠실역', lines: ['2호선', '8호선'], priority: 'P0' },
  { name: '홍대입구역', lines: ['2호선', '공항철도', '경의중앙선'], priority: 'P0' },
  { name: '종로3가역', lines: ['1호선', '3호선', '5호선'], priority: 'P0' },
  { name: '동대문역사문화공원역', lines: ['2호선', '4호선', '5호선'], priority: 'P0' },
  { name: '여의도역', lines: ['5호선', '9호선'], priority: 'P0' },
  { name: '공덕역', lines: ['5호선', '6호선', '공항철도', '경의중앙선'], priority: 'P0' },
  { name: '왕십리역', lines: ['2호선', '5호선', '수인분당선', '경의중앙선'], priority: 'P0' },
  { name: '건대입구역', lines: ['2호선', '7호선'], priority: 'P0' },
  { name: '합정역', lines: ['2호선', '6호선'], priority: 'P0' },
  { name: '김포공항역', lines: ['5호선', '9호선', '공항철도', '김포골드라인', '서해선'], priority: 'P0' },
  { name: '대곡역', lines: ['3호선', '경의중앙선'], priority: 'P1' },
  { name: '노량진역', lines: ['1호선', '9호선'], priority: 'P1' },
  { name: '동작역', lines: ['4호선', '9호선'], priority: 'P1' },
  { name: '충무로역', lines: ['3호선', '4호선'], priority: 'P1' },
  { name: '을지로3가역', lines: ['2호선', '3호선'], priority: 'P1' },
  { name: '가산디지털단지역', lines: ['1호선', '7호선'], priority: 'P1' },
  { name: '대림역', lines: ['2호선', '7호선'], priority: 'P1' },
  { name: '선릉역', lines: ['2호선', '수인분당선'], priority: 'P1' },
  { name: '연신내역', lines: ['3호선', '6호선'], priority: 'P1' },
  { name: '불광역', lines: ['3호선', '6호선'], priority: 'P1' },
  { name: '약수역', lines: ['3호선', '6호선'], priority: 'P1' },
  { name: '동묘앞역', lines: ['1호선', '6호선'], priority: 'P1' },
  { name: '신설동역', lines: ['1호선', '2호선', '우이신설선'], priority: 'P1' },
  { name: '청구역', lines: ['5호선', '6호선'], priority: 'P1' },
  { name: '군자역', lines: ['5호선', '7호선'], priority: 'P1' },
  { name: '천호역', lines: ['5호선', '8호선'], priority: 'P1' },
  { name: '가락시장역', lines: ['3호선', '8호선'], priority: 'P1' },
  { name: '수서역', lines: ['3호선', '수인분당선'], priority: 'P1' },
] as const;

type Priority = 'P0' | 'P1' | 'P2';
type InventoryStatus = 'candidate' | 'needs_master_data';

type TransferInventoryItem = {
  stationName: string;
  normalizedName: string;
  lines: string[];
  linePairs: Array<{ fromLine: string; toLine: string }>;
  priority: Priority;
  status: InventoryStatus;
  source: Array<'STATION_MASTER_DERIVED' | 'MAJOR_TRANSFER_SEED'>;
  lat?: number;
  lng?: number;
  notes?: string[];
};

function normalizeStationName(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/역$/, '');
}

function isInSeoulMetroBbox(station: Station) {
  if (typeof station.lat !== 'number' || typeof station.lng !== 'number') return false;
  return station.lat >= SEOUL_METRO_BBOX.minLat
    && station.lat <= SEOUL_METRO_BBOX.maxLat
    && station.lng >= SEOUL_METRO_BBOX.minLng
    && station.lng <= SEOUL_METRO_BBOX.maxLng;
}

function haversineMeters(a: Station, b: Station) {
  if (typeof a.lat !== 'number' || typeof a.lng !== 'number' || typeof b.lat !== 'number' || typeof b.lng !== 'number') return Number.POSITIVE_INFINITY;
  const earthRadius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function linePairs(lines: string[]) {
  const pairs: Array<{ fromLine: string; toLine: string }> = [];
  for (const fromLine of lines) {
    for (const toLine of lines) {
      if (fromLine !== toLine) pairs.push({ fromLine, toLine });
    }
  }
  return pairs;
}

function priorityFor(name: string, lineCount: number): Priority {
  const seed = MAJOR_TRANSFER_SEEDS.find((item) => normalizeStationName(item.name) === normalizeStationName(name));
  if (seed) return seed.priority;
  if (lineCount >= 3) return 'P1';
  return 'P2';
}

function centroid(stations: Station[]) {
  const withCoords = stations.filter((station) => typeof station.lat === 'number' && typeof station.lng === 'number');
  if (withCoords.length === 0) return {};
  return {
    lat: Number((withCoords.reduce((sum, station) => sum + Number(station.lat), 0) / withCoords.length).toFixed(6)),
    lng: Number((withCoords.reduce((sum, station) => sum + Number(station.lng), 0) / withCoords.length).toFixed(6)),
  };
}

function areClustered(stations: Station[]) {
  for (let i = 0; i < stations.length; i += 1) {
    for (let j = i + 1; j < stations.length; j += 1) {
      if (haversineMeters(stations[i], stations[j]) > CLUSTER_THRESHOLD_METERS) return false;
    }
  }
  return true;
}

function buildDerivedInventory(): TransferInventoryItem[] {
  const byName = new Map<string, Station[]>();
  for (const station of STATIONS.filter(isInSeoulMetroBbox)) {
    const key = normalizeStationName(station.name);
    byName.set(key, [...(byName.get(key) ?? []), station]);
  }

  const items: TransferInventoryItem[] = [];
  for (const [normalizedName, rows] of byName.entries()) {
    const byLine = new Map<string, Station>();
    for (const row of rows) if (!byLine.has(row.line)) byLine.set(row.line, row);
    const uniqueRows = [...byLine.values()];
    const lines = [...byLine.keys()].sort((a, b) => a.localeCompare(b, 'ko'));
    if (lines.length < 2) continue;

    const notes: string[] = [];
    if (!areClustered(uniqueRows)) {
      notes.push(`same-name rows are farther than ${CLUSTER_THRESHOLD_METERS}m; review for homonyms or station master errors`);
      continue;
    }

    const { lat, lng } = centroid(uniqueRows);
    items.push({
      stationName: `${normalizedName}역`,
      normalizedName,
      lines,
      linePairs: linePairs(lines),
      priority: priorityFor(`${normalizedName}역`, lines.length),
      status: 'candidate',
      source: ['STATION_MASTER_DERIVED'],
      lat,
      lng,
      notes,
    });
  }
  return items;
}

function mergeMajorSeeds(items: TransferInventoryItem[]) {
  const byName = new Map(items.map((item) => [item.normalizedName, item]));
  for (const seed of MAJOR_TRANSFER_SEEDS) {
    const normalizedName = normalizeStationName(seed.name);
    const existing = byName.get(normalizedName);
    const seedLines = [...seed.lines].sort((a, b) => a.localeCompare(b, 'ko'));
    if (!existing) {
      byName.set(normalizedName, {
        stationName: seed.name,
        normalizedName,
        lines: seedLines,
        linePairs: linePairs(seedLines),
        priority: seed.priority,
        status: 'needs_master_data',
        source: ['MAJOR_TRANSFER_SEED'],
        notes: ['major transfer seed is missing or incomplete in current station master; do not create anchors until station rows and official transfer evidence are verified'],
      });
      continue;
    }

    const mergedLines = [...new Set([...existing.lines, ...seedLines])].sort((a, b) => a.localeCompare(b, 'ko'));
    existing.lines = mergedLines;
    existing.linePairs = linePairs(mergedLines);
    existing.priority = seed.priority < existing.priority ? seed.priority : existing.priority;
    existing.source = [...new Set([...existing.source, 'MAJOR_TRANSFER_SEED' as const])];
    const missingLines = seedLines.filter((line) => !STATIONS.some((station) => normalizeStationName(station.name) === normalizedName && station.line === line && isInSeoulMetroBbox(station)));
    if (missingLines.length > 0) {
      existing.status = 'needs_master_data';
      existing.notes = [...(existing.notes ?? []), `station master missing expected lines: ${missingLines.join(', ')}`];
    }
  }
  return [...byName.values()];
}

function sortInventory(items: TransferInventoryItem[]) {
  const priorityRank: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };
  const statusRank: Record<InventoryStatus, number> = { candidate: 0, needs_master_data: 1 };
  return [...items].sort((a, b) => {
    if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    if (b.lines.length !== a.lines.length) return b.lines.length - a.lines.length;
    return a.stationName.localeCompare(b.stationName, 'ko');
  });
}

function main() {
  const generatedAt = new Date().toISOString();
  const inventory = sortInventory(mergeMajorSeeds(buildDerivedInventory()));
  const payload = {
    schemaVersion: 1,
    generatedAt,
    policy: {
      purpose: 'Inventory of Seoul metro transfer station/line pairs that need NEXT_TRANSFER anchor verification.',
      safety: 'This file is not a production door guide. Do not use inventory rows to create carNo/doorNo anchors without official source evidence or manual field verification.',
      productionRule: 'Only verified DoorGuideRecord rows may be used by lookupDoorGuide() for NEXT_TRANSFER ANCHOR_WINDOW recommendations.',
    },
    stats: {
      totalStations: inventory.length,
      p0: inventory.filter((item) => item.priority === 'P0').length,
      p1: inventory.filter((item) => item.priority === 'P1').length,
      p2: inventory.filter((item) => item.priority === 'P2').length,
      needsMasterData: inventory.filter((item) => item.status === 'needs_master_data').length,
      totalDirectedTransferPairs: inventory.reduce((sum, item) => sum + item.linePairs.length, 0),
    },
    inventory,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, outputPath: OUTPUT_PATH, stats: payload.stats }, null, 2));
}

main();
