import { STATIONS, searchStations } from '../src/lib/stations';

const requiredQueries = ['역삼', '삼성', '시청', '잠실', '여의도', '강남'];
const failures: string[] = [];

for (const query of requiredQueries) {
  const results = searchStations(query, { limit: 10 });
  if (!results.some((station) => station.name.replace(/역$/, '') === query)) {
    failures.push(`${query}: no exact station result`);
  }
}

const lineBrowse = searchStations('', { line: '2호선', limit: 50 });
if (lineBrowse.length < 30) failures.push(`2호선 browse returned too few rows: ${lineBrowse.length}`);

const stationLineRows = STATIONS.length;
if (stationLineRows < 500) failures.push(`station master too small: ${stationLineRows}`);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, stationLineRows, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, stationLineRows, checkedQueries: requiredQueries, lineBrowse2: lineBrowse.length }, null, 2));
