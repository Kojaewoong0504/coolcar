import { recommend } from '../src/lib/recommendation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const cases = [
  {
    name: '김포공항 5호선→김포골드라인',
    request: { line: '5호선', originStation: '화곡역', destinationStation: '고촌역', destinationLine: '김포골드라인', transferStations: ['김포공항역'], routeLines: ['5호선', '김포골드라인'], comfortType: 'HOT_SENSITIVE' as const },
    expectedStatus: 'available',
  },
  {
    name: '김포공항 9호선→서해선',
    request: { line: '9호선', originStation: '마곡나루역', destinationStation: '원종역', destinationLine: '서해선', transferStations: ['김포공항역'], routeLines: ['9호선', '서해선'], comfortType: 'HOT_SENSITIVE' as const },
    expectedStatus: 'available',
  },
  {
    name: '신설동 1호선→우이신설선',
    request: { line: '1호선', originStation: '제기동역', destinationStation: '보문역', destinationLine: '우이신설선', transferStations: ['신설동역'], routeLines: ['1호선', '우이신설선'], comfortType: 'HOT_SENSITIVE' as const },
    expectedStatus: 'available',
  },
  {
    name: '신설동 2호선→우이신설선',
    request: { line: '2호선', originStation: '성수역', destinationStation: '보문역', destinationLine: '우이신설선', transferStations: ['신설동역'], routeLines: ['2호선', '우이신설선'], comfortType: 'HOT_SENSITIVE' as const },
    expectedStatus: 'available',
  },
  {
    name: '이수 4호선→7호선',
    request: { line: '4호선', originStation: '사당역', destinationStation: '내방역', destinationLine: '7호선', transferStations: ['이수역'], routeLines: ['4호선', '7호선'], comfortType: 'HOT_SENSITIVE' as const },
    expectedStatus: 'available',
  },
  {
    name: '이수 7호선→4호선',
    request: { line: '7호선', originStation: '내방역', destinationStation: '사당역', destinationLine: '4호선', transferStations: ['이수역'], routeLines: ['7호선', '4호선'], comfortType: 'HOT_SENSITIVE' as const },
    expectedStatus: 'available',
  },
  {
    name: '청량리 1호선→수인분당선',
    request: { line: '1호선', originStation: '제기동역', destinationStation: '수원역', destinationLine: '수인분당선', transferStations: ['청량리역'], routeLines: ['1호선', '수인분당선'], comfortType: 'HOT_SENSITIVE' as const },
    expectedStatus: 'available',
  },
];

async function main() {
  const results = [];
  for (const item of cases) {
    const response = await recommend(item.request);
    const leg = response.routeGuidance.legs[0];
    assert(response.routeChoice.mode === 'ANCHOR_WINDOW', `${item.name}: should use ANCHOR_WINDOW`);
    assert(leg.status === item.expectedStatus, `${item.name}: first leg should be available`);
    assert(leg.recommendedDoorNo, `${item.name}: should expose verified/curated door number`);
    assert(leg.candidateCarNos?.includes(response.recommendedCar.carNo), `${item.name}: recommended car should be inside anchor window`);
    results.push({
      name: item.name,
      mode: response.routeChoice.mode,
      status: leg.status,
      recommendedCarNo: leg.recommendedCarNo,
      recommendedDoorNo: leg.recommendedDoorNo,
      candidateCarNos: leg.candidateCarNos,
    });
  }
  console.log(JSON.stringify({ ok: true, checked: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
