import { recommend } from '../src/lib/recommendation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const guroToOlympic = await recommend({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '올림픽공원역',
    destinationLine: '9호선',
    comfortType: 'HOT_SENSITIVE',
    waitToleranceMin: 3,
    avoidPrioritySeatArea: true,
    transferStations: [],
  });

  assert(guroToOlympic.routeGuidance.status === 'needs_route', '구로디지털단지→올림픽공원은 환승역 없으면 needs_route여야 합니다.');
  assert(guroToOlympic.routeChoice.mode === 'COMFORT_ONLY', '환승역 미확정이면 환승문 anchor가 아닌 COMFORT_ONLY여야 합니다.');
  assert(guroToOlympic.routeGuidance.legs.length === 1, '환승역 미확정이면 확정 구간을 여러 개로 만들면 안 됩니다.');
  assert(guroToOlympic.routeGuidance.legs[0]?.status === 'needs_route', '첫 leg는 경로 확인 필요 상태여야 합니다.');
  assert(guroToOlympic.routeGuidance.legs[0]?.anchorCarNo == null, '환승역 미확정이면 anchorCarNo를 만들면 안 됩니다.');
  assert(guroToOlympic.routeGuidance.legs[0]?.anchorDoorNo == null, '환승역 미확정이면 anchorDoorNo를 만들면 안 됩니다.');
  assert(guroToOlympic.routeChoice.anchorCarNo == null, 'COMFORT_ONLY에서는 환승 기준칸을 노출하면 안 됩니다.');
  assert(guroToOlympic.routeChoice.message.includes('확정되지 않아'), '추천 메시지는 환승·하차 위치 미확정을 설명해야 합니다.');
  assert(guroToOlympic.routeGuidance.summary.includes('환승이 필요한 경로'), '구간 안내 summary는 환승 필요를 알려야 합니다.');
  assert(guroToOlympic.routeGuidance.legs[0]?.message.includes('전체 환승 경로가 확정되지 않아'), 'leg 메시지는 전체 환승 경로 미확정을 알려야 합니다.');

  const gangnamTransferNoDirection = await recommend({
    line: '2호선',
    originStation: '역삼역',
    destinationStation: '판교역',
    destinationLine: '신분당선',
    transferStations: ['강남역'],
    comfortType: 'BALANCED',
  });

  assert(gangnamTransferNoDirection.routeChoice.mode === 'COMFORT_ONLY', '방면 없으면 검증된 환승역이 있어도 COMFORT_ONLY여야 합니다.');
  assert(gangnamTransferNoDirection.routeGuidance.legs[0]?.status === 'needs_direction', '방면 없으면 첫 환승 leg는 needs_direction이어야 합니다.');
  assert(gangnamTransferNoDirection.routeGuidance.legs[0]?.anchorDoorNo == null, '방면 없으면 문번호를 확정하면 안 됩니다.');

  console.log(JSON.stringify({
    ok: true,
    guroToOlympic: {
      recommendedCar: guroToOlympic.recommendedCar.label,
      routeChoiceMode: guroToOlympic.routeChoice.mode,
      routeGuidanceStatus: guroToOlympic.routeGuidance.status,
      legStatus: guroToOlympic.routeGuidance.legs[0]?.status,
      summary: guroToOlympic.routeGuidance.summary,
    },
    gangnamTransferNoDirection: {
      routeChoiceMode: gangnamTransferNoDirection.routeChoice.mode,
      legStatus: gangnamTransferNoDirection.routeGuidance.legs[0]?.status,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
