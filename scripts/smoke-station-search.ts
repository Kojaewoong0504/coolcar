import { STATIONS, isSearchableMetroStation, searchStations } from '../src/lib/stations';

const requiredQueries = ['역삼', '삼성', '시청', '잠실', '여의도', '강남'];
const airportResults = searchStations('인천공항', { limit: 10 });
const failures: string[] = [];

for (const query of requiredQueries) {
  const results = searchStations(query, { limit: 10 });
  if (!results.some((station) => station.name.replace(/역$/, '') === query)) {
    failures.push(`${query}: no exact station result`);
  }
}

const requiredExactRows = [
  { query: '구로디지털단지', name: '구로디지털단지역', line: '2호선' },
  { query: '구로', name: '구로역', line: '1호선' },
  { query: '구반포', name: '구반포역', line: '9호선' },
  { query: '구의', name: '구의역', line: '2호선' },
  { query: '국회의사당', name: '국회의사당역', line: '9호선' },
  { query: '수원', name: '수원역', line: '1호선' },
  { query: '천안', name: '천안역', line: '1호선' },
  { query: '배방', name: '배방역', line: '1호선' },
  { query: '신창', name: '신창역', line: '1호선' },
];

for (const expected of requiredExactRows) {
  const results = searchStations(expected.query, { limit: 20 });
  if (!results.some((station) => station.name === expected.name && station.line === expected.line)) {
    failures.push(`${expected.query}: expected ${expected.name}/${expected.line} missing`);
  }
}

const pollutedQueries = ['구남', '부산', '대구', '서면', '광주송정', '유성온천'];
for (const query of pollutedQueries) {
  const results = searchStations(query, { limit: 20 });
  if (results.length > 0) {
    failures.push(`${query}: non-service-area stations returned: ${results.map((station) => `${station.name}/${station.line}/${station.operator}`).join(', ')}`);
  }
}

const guResults = searchStations('구', { limit: 50 });
if (!airportResults.some((station) => station.name === '인천공항1터미널역' && station.line === '공항철도')) failures.push('인천공항 search missing 인천공항1터미널역/공항철도');
if (!airportResults.some((station) => station.name === '인천공항2터미널역' && station.line === '공항철도')) failures.push('인천공항 search missing 인천공항2터미널역/공항철도');
if (guResults.some((station) => station.name === '구남역')) failures.push('구 search returned polluted 구남역');
if (guResults.some((station) => station.name === '구회의사당역')) failures.push('구 search returned typo 구회의사당역');
if (!guResults.some((station) => station.name === '구로디지털단지역' && station.line === '2호선')) failures.push('구 search missing 구로디지털단지역/2호선');
if (!guResults.some((station) => station.name === '구반포역' && station.line === '9호선')) failures.push('구 search missing 구반포역/9호선');

const gyodae = searchStations('교대', { limit: 20 });
if (gyodae.some((station) => station.name === '교대역' && station.line === '1호선')) failures.push('교대 search returned polluted non-metro 1호선');
if (!gyodae.some((station) => station.name === '교대역' && station.line === '2호선')) failures.push('교대 search missing Seoul 2호선');
if (!gyodae.some((station) => station.name === '교대역' && station.line === '3호선')) failures.push('교대 search missing Seoul 3호선');

const pollutedSearchableRows = STATIONS.filter((station) => !isSearchableMetroStation(station) && searchStations(station.name.replace(/역$/, ''), { limit: 50 }).some((result) => result.name === station.name && result.line === station.line));
if (pollutedSearchableRows.length > 0) {
  failures.push(`non-service-area rows are searchable: ${pollutedSearchableRows.slice(0, 10).map((station) => `${station.name}/${station.line}`).join(', ')}`);
}

const lineBrowse = searchStations('', { line: '2호선', limit: 50 });
if (lineBrowse.length < 30) failures.push(`2호선 browse returned too few rows: ${lineBrowse.length}`);
if (lineBrowse.some((station) => station.name === '구남역')) failures.push('2호선 browse returned polluted 구남역');

const stationLineRows = STATIONS.length;
if (stationLineRows < 500) failures.push(`station master too small: ${stationLineRows}`);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, stationLineRows, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, stationLineRows, checkedQueries: requiredQueries, lineBrowse2: lineBrowse.length, guResults: guResults.map((station) => `${station.name}/${station.line}`).slice(0, 12) }, null, 2));
