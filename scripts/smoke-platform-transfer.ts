import { recommend } from '../src/lib/recommendation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const cases = [
  {
    name: '금정 1호선 북행→4호선 북행 평면환승',
    request: {
      line: '1호선',
      originStation: '수원역',
      destinationStation: '사당역',
      destinationLine: '4호선',
      transferStations: ['금정역'],
      routeLines: ['1호선', '4호선'],
      comfortType: 'HOT_SENSITIVE' as const,
    },
  },
  {
    name: '금정 4호선 남행→1호선 남행 평면환승',
    request: {
      line: '4호선',
      originStation: '사당역',
      destinationStation: '수원역',
      destinationLine: '1호선',
      transferStations: ['금정역'],
      routeLines: ['4호선', '1호선'],
      comfortType: 'HOT_SENSITIVE' as const,
    },
  },
];

async function main() {
  const results = [];
  for (const item of cases) {
    const response = await recommend(item.request);
    const firstLeg = response.routeGuidance.legs[0];
    assert(firstLeg.status === 'available', `${item.name}: first leg should be available`);
    assert(response.routeChoice.mode === 'COMFORT_ONLY', `${item.name}: routeChoice should not pretend there is a single car-door anchor`);
    assert(firstLeg.transferKind === 'CROSS_PLATFORM', `${item.name}: should be CROSS_PLATFORM`);
    assert(firstLeg.recommendedDoorNo === undefined, `${item.name}: must not expose a fake door number`);
    assert(firstLeg.anchorDoorNo === undefined, `${item.name}: must not expose fake anchor door`);
    assert(firstLeg.positionLabel.includes('같은 승강장') || firstLeg.positionLabel.includes('맞은편'), `${item.name}: label should explain same platform, got ${firstLeg.positionLabel}`);
    assert(firstLeg.message.includes('맞은편'), `${item.name}: message should explain opposite train`);
    assert((firstLeg.candidateCarNos?.length ?? 0) >= 6, `${item.name}: all/most cars should stay usable, not anchor±1`);
    results.push({
      name: item.name,
      routeChoiceMode: response.routeChoice.mode,
      status: firstLeg.status,
      transferKind: firstLeg.transferKind,
      recommendedCarNo: firstLeg.recommendedCarNo,
      recommendedDoorNo: firstLeg.recommendedDoorNo,
      positionLabel: firstLeg.positionLabel,
      candidateCarNos: firstLeg.candidateCarNos,
    });
  }
  console.log(JSON.stringify({ ok: true, checked: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
