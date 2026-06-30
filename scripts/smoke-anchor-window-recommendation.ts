import { recommend } from '../src/lib/recommendation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const anchored = await recommend({
    line: '1호선',
    originStation: '남영역',
    destinationStation: '서울역',
    destinationLine: '1호선',
    direction: '시청',
    comfortType: 'BALANCED',
  });

  assert(anchored.routeChoice.mode === 'ANCHOR_WINDOW', '서울역 빠른하차 fixture는 anchor window 모드여야 합니다.');
  assert(anchored.routeChoice.anchorCarNo === 9, '서울역 시청 방향 기준칸은 9번째 칸이어야 합니다.');
  assert(anchored.routeChoice.anchorDoorNo === 3, '서울역 시청 방향 기준 문은 3번 문이어야 합니다.');
  assert(JSON.stringify(anchored.routeChoice.candidateCarNos) === JSON.stringify([8, 9, 10]), 'anchor 9의 후보는 8,9,10번째 칸이어야 합니다.');
  assert(anchored.routeChoice.candidateCarNos.includes(anchored.recommendedCar.carNo), '최종 추천칸은 anchor±1 후보 안에 있어야 합니다.');
  assert(anchored.routeChoice.selectedCarNo === anchored.recommendedCar.carNo, 'routeChoice selectedCarNo와 recommendedCar가 일치해야 합니다.');
  assert(anchored.routeGuidance.legs[0]?.anchorCarNo === 9, 'routeGuidance는 기준칸을 유지해야 합니다.');
  assert(anchored.routeGuidance.legs[0]?.candidateCarNos?.includes(anchored.recommendedCar.carNo), 'routeGuidance 후보 범위에 추천칸이 있어야 합니다.');

  const noDirection = await recommend({
    line: '1호선',
    originStation: '남영역',
    destinationStation: '서울역',
    destinationLine: '1호선',
    comfortType: 'BALANCED',
  });

  assert(noDirection.routeChoice.mode === 'COMFORT_ONLY', '방향이 없어 anchor가 불확실하면 전체 쾌적도 모드여야 합니다.');
  assert(noDirection.routeGuidance.legs[0]?.status === 'needs_direction', '방향 누락은 needs_direction으로 표시해야 합니다.');

  const gangnamTransfer = await recommend({
    line: '2호선',
    originStation: '역삼역',
    destinationStation: '판교역',
    destinationLine: '신분당선',
    direction: '교대',
    transferStations: ['강남역'],
    comfortType: 'BALANCED',
  });

  assert(gangnamTransfer.routeChoice.mode === 'ANCHOR_WINDOW', '검증된 강남역 환승 fixture는 anchor window 모드여야 합니다.');
  assert(gangnamTransfer.routeChoice.goal === 'NEXT_TRANSFER', '강남역 anchor goal은 NEXT_TRANSFER여야 합니다.');
  assert(gangnamTransfer.routeChoice.anchorCarNo === 6, '강남역 2호선→신분당선 교대 방향 기준칸은 6번째 칸이어야 합니다.');
  assert(gangnamTransfer.routeChoice.anchorDoorNo === 3, '강남역 2호선→신분당선 교대 방향 기준 문은 3번 문이어야 합니다.');
  assert(JSON.stringify(gangnamTransfer.routeChoice.candidateCarNos) === JSON.stringify([5, 6, 7]), 'anchor 6의 후보는 5,6,7번째 칸이어야 합니다.');
  assert(gangnamTransfer.routeChoice.candidateCarNos.includes(gangnamTransfer.recommendedCar.carNo), '강남역 최종 추천칸은 환승 anchor±1 후보 안에 있어야 합니다.');
  assert(gangnamTransfer.routeGuidance.legs[0]?.status === 'available', '강남역 첫 환승 leg는 available이어야 합니다.');
  assert(gangnamTransfer.routeGuidance.legs[0]?.recommendedDoorNo === 3, '강남역 첫 환승 leg는 3번 문을 유지해야 합니다.');

  const gangnamTransferNoDirection = await recommend({
    line: '2호선',
    originStation: '역삼역',
    destinationStation: '판교역',
    destinationLine: '신분당선',
    transferStations: ['강남역'],
    comfortType: 'BALANCED',
  });

  assert(gangnamTransferNoDirection.routeChoice.mode === 'ANCHOR_WINDOW', '강남역 방향은 역 순서로 자동 추론되어 환승 anchor를 적용해야 합니다.');
  assert(gangnamTransferNoDirection.routeGuidance.legs[0]?.status === 'available', '강남역 자동 방면 추론 후 available이어야 합니다.');

  console.log(JSON.stringify({
    ok: true,
    anchored: {
      recommendedCarNo: anchored.recommendedCar.carNo,
      anchorCarNo: anchored.routeChoice.anchorCarNo,
      anchorDoorNo: anchored.routeChoice.anchorDoorNo,
      candidateCarNos: anchored.routeChoice.candidateCarNos,
      mode: anchored.routeChoice.mode,
    },
    noDirection: {
      mode: noDirection.routeChoice.mode,
      legStatus: noDirection.routeGuidance.legs[0]?.status,
    },
    gangnamTransfer: {
      recommendedCarNo: gangnamTransfer.recommendedCar.carNo,
      anchorCarNo: gangnamTransfer.routeChoice.anchorCarNo,
      anchorDoorNo: gangnamTransfer.routeChoice.anchorDoorNo,
      candidateCarNos: gangnamTransfer.routeChoice.candidateCarNos,
      mode: gangnamTransfer.routeChoice.mode,
      legStatus: gangnamTransfer.routeGuidance.legs[0]?.status,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
