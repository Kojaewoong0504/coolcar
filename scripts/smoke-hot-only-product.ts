import { readFileSync } from 'node:fs';
import { recommend } from '../src/lib/recommendation';

const productFiles = [
  'src/app/page.tsx',
  'src/app/saved/page.tsx',
  'src/app/result/page.tsx',
  'src/app/settings/page.tsx',
  'src/app/data-source/page.tsx',
  'src/app/login/page.tsx',
  'src/app/privacy/page.tsx',
  'src/components/TabBar.tsx',
  'src/components/auth/AuthMergeOnLoad.tsx',
];

const forbiddenProductCopy = [
  '추위형',
  '혼잡회피',
  '밸런스',
  '약냉방·중앙',
  '덜 붐비는 칸',
  '균형 추천',
  '내 취향',
  '추웠어요',
  '익명 기록',
  'API 캐싱',
  'quota',
  'fallback',
  'Personalization',
  'Trust & Source',
  '데이터 출처',
  'OPTIONAL LOGIN',
  '익명 기록',
  'API 캐싱',
];

for (const file of productFiles) {
  const text = readFileSync(file, 'utf8');
  for (const forbidden of forbiddenProductCopy) {
    if (text.includes(forbidden)) {
      throw new Error(`${file} still exposes removed consumer copy: ${forbidden}`);
    }
  }
}

async function main() {
  const result = await recommend({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '올림픽공원역',
    destinationLine: '9호선',
    transferStations: ['당산역'],
    comfortType: 'HOT_SENSITIVE',
    egressPreference: 'ANY',
    waitToleranceMin: 3,
    avoidPrioritySeatArea: true,
  });

  if (result.request.comfortType !== 'HOT_SENSITIVE') {
    throw new Error(`Product recommendation should stay HOT_SENSITIVE, got ${result.request.comfortType}`);
  }

  if (!result.reasons.join(' ').includes('더위')) {
    throw new Error(`Hot-only product reason should mention heat/cooling: ${result.reasons.join(' / ')}`);
  }

  console.log(JSON.stringify({
    ok: true,
    product: 'hot-only',
    carNo: result.recommendedCar.carNo,
    reason: result.reasons[1],
    legs: result.routeGuidance.legs.map((leg) => `${leg.line}:${leg.fromStation}->${leg.toStation}:${leg.goal}`),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
