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
  assert(anchored.routeChoice.anchorDoorNo === 2, '서울역 시청 방향 기준 문은 2번 문이어야 합니다.');
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

  assert(noDirection.routeChoice.mode === 'ANCHOR_WINDOW', '역 순서로 방면 추론 가능한 직통 구간은 anchor window 모드여야 합니다.');
  assert(noDirection.routeGuidance.legs[0]?.status === 'available', '자동 방면 추론 후 위치 안내가 가능해야 합니다.');

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

  const sportsTransfer = await recommend({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '올림픽공원역',
    destinationLine: '9호선',
    transferStations: ['종합운동장역'],
    comfortType: 'HOT_SENSITIVE',
  });

  assert(sportsTransfer.routeChoice.mode === 'ANCHOR_WINDOW', '종합운동장 2호선→9호선 환승 fixture는 자동 방면 추론 후 anchor window 모드여야 합니다.');
  assert(sportsTransfer.routeChoice.goal === 'NEXT_TRANSFER', '종합운동장 anchor goal은 NEXT_TRANSFER여야 합니다.');
  assert(sportsTransfer.routeChoice.anchorCarNo === 3, '구로디지털단지→종합운동장 진행 방향 기준칸은 3번째 칸이어야 합니다.');
  assert(sportsTransfer.routeChoice.anchorDoorNo === 1, '구로디지털단지→종합운동장 진행 방향 기준 문은 1번 문이어야 합니다.');
  assert(JSON.stringify(sportsTransfer.routeChoice.candidateCarNos) === JSON.stringify([2, 3, 4]), 'anchor 3의 후보는 2,3,4번째 칸이어야 합니다.');
  assert(sportsTransfer.routeChoice.candidateCarNos.includes(sportsTransfer.recommendedCar.carNo), '종합운동장 최종 추천칸은 환승 anchor±1 후보 안에 있어야 합니다.');
  assert(sportsTransfer.routeGuidance.legs[0]?.status === 'available', '종합운동장 첫 환승 leg는 available이어야 합니다.');
  assert(sportsTransfer.routeGuidance.legs[0]?.recommendedDoorNo === 1, '종합운동장 첫 환승 leg는 1번 문을 유지해야 합니다.');
  assert(!JSON.stringify(sportsTransfer).includes('환승문 데이터 부족'), '종합운동장 추천 응답에는 실패 문구가 없어야 합니다.');

  const hongdaeAirport = await recommend({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '인천공항2터미널역',
    destinationLine: '공항철도',
    transferStations: ['홍대입구역'],
    comfortType: 'HOT_SENSITIVE',
  });

  assert(hongdaeAirport.routeChoice.mode === 'ANCHOR_WINDOW', '홍대입구 2호선→공항철도 신촌 방면은 anchor window 모드여야 합니다.');
  assert(JSON.stringify(hongdaeAirport.routeChoice.anchorDoorLabels) === JSON.stringify(['7-2']), '홍대입구 신촌 방면은 대표 anchor 7-2만 한 추천창에 사용해야 합니다.');
  assert(JSON.stringify(hongdaeAirport.routeChoice.candidateCarNos) === JSON.stringify([6, 7, 8]), '홍대입구 신촌 방면 후보는 대표 anchor 7 주변 6~8번째 칸이어야 합니다.');
  assert(hongdaeAirport.routeChoice.candidateCarNos.includes(hongdaeAirport.recommendedCar.carNo), '홍대입구 최종 추천칸은 대표 anchor±1 후보 안에 있어야 합니다.');
  assert([6, 7, 8].includes(hongdaeAirport.recommendedCar.carNo), '홍대입구 최종 추천칸은 대표 anchor 주변 칸이어야 합니다.');
  assert(!hongdaeAirport.routeChoice.candidateCarNos.includes(2), '홍대입구 신촌 방면 후보에는 2번째 칸이 들어가면 안 됩니다.');
  assert(!hongdaeAirport.routeChoice.candidateCarNos.includes(9), '홍대입구 신촌 방면 후보에는 다른 통로 anchor를 같은 추천창에 섞지 않습니다.');
  assert(!JSON.stringify(hongdaeAirport).includes('환승문 데이터 부족'), '홍대입구 추천 응답에는 실패 문구가 없어야 합니다.');

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
