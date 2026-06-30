import { lookupDoorGuide } from '../src/lib/doorGuidance/resolver';
import { rowToDoorGuideRecord } from '../src/lib/doorGuidance/publicAdapter';
import { recommend } from '../src/lib/recommendation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const escalator = await lookupDoorGuide({
    line: '1호선',
    toStation: '서울역',
    direction: '남영',
    goal: 'FINAL_EXIT',
    egressPreference: 'ESCALATOR',
  });
  assert(escalator.status === 'available', '서울역 남영 방면 에스컬레이터 하차 위치가 있어야 합니다.');
  assert(escalator.record.facilityType === 'ESCALATOR', '에스컬레이터 선호는 ESCALATOR record를 선택해야 합니다.');
  assert(escalator.record.carNo === 2 && escalator.record.doorNo === 3, '서울역 에스컬레이터 sample은 2-3이어야 합니다.');

  const elevator = await lookupDoorGuide({
    line: '1호선',
    toStation: '서울역',
    direction: '남영',
    goal: 'FINAL_EXIT',
    egressPreference: 'ELEVATOR',
  });
  assert(elevator.status === 'available', '서울역 남영 방면 엘리베이터 하차 위치가 있어야 합니다.');
  assert(elevator.record.facilityType === 'ELEVATOR', '엘리베이터 선호는 ELEVATOR record를 선택해야 합니다.');
  assert(elevator.record.carNo === 4 && elevator.record.doorNo === 4, '서울역 엘리베이터 sample은 4-4이어야 합니다.');

  const stairs = await lookupDoorGuide({
    line: '1호선',
    toStation: '서울역',
    direction: '남영',
    goal: 'FINAL_EXIT',
    egressPreference: 'STAIRS',
  });
  assert(stairs.status === 'available', '서울역 남영 방면 계단 하차 위치가 있어야 합니다.');
  assert(stairs.record.facilityType === 'STAIRS', '계단 선호는 STAIRS record를 선택해야 합니다.');
  assert(stairs.record.carNo === 10 && stairs.record.doorNo === 4, '서울역 계단 sample은 10-4이어야 합니다.');

  const parsed = rowToDoorGuideRecord({
    lineNm: '1호선',
    stnNm: '서울역',
    stnCd: '0150',
    drtnInfo: '남영',
    qckgffVhclDoorNo: '4-4',
    plfmCmgFac: '엘리베이터',
    crtrYmd: '20241231',
  }, { line: '1호선', toStation: '서울역', direction: '남영', goal: 'FINAL_EXIT' });
  assert(parsed?.facilityType === 'ELEVATOR', 'public getFstExit row의 plfmCmgFac는 facilityType으로 구조화되어야 합니다.');

  const direct = await recommend({
    line: '1호선',
    originStation: '시청역',
    destinationStation: '서울역',
    destinationLine: '1호선',
    comfortType: 'BALANCED',
    egressPreference: 'ELEVATOR',
    avoidPrioritySeatArea: true,
    waitToleranceMin: 3,
  });
  assert(direct.routeChoice.mode === 'ANCHOR_WINDOW', '검증된 FINAL_EXIT 시설 위치가 있으면 ANCHOR_WINDOW여야 합니다.');
  assert(direct.routeChoice.goal === 'FINAL_EXIT', 'direct 추천은 FINAL_EXIT anchor를 사용해야 합니다.');
  assert(direct.routeChoice.facilityType === 'ELEVATOR', 'routeChoice에 facilityType이 전달되어야 합니다.');
  assert(direct.routeGuidance.legs[0].facilityType === 'ELEVATOR', 'direct leg에 facilityType이 전달되어야 합니다.');
  assert(direct.routeGuidance.legs[0].recommendedDoorNo === 4, '검증된 엘리베이터 문 위치는 4번 문이어야 합니다.');

  const oneTransfer = await recommend({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '올림픽공원역',
    destinationLine: '9호선',
    transferStations: ['종합운동장역'],
    comfortType: 'HOT_SENSITIVE',
    egressPreference: 'ELEVATOR',
    avoidPrioritySeatArea: true,
    waitToleranceMin: 3,
  });
  const secondLeg = oneTransfer.routeGuidance.legs[1];
  assert(oneTransfer.routeGuidance.legs[0].goal === 'NEXT_TRANSFER', '1회 환승 첫 구간은 NEXT_TRANSFER여야 합니다.');
  assert(secondLeg.goal === 'FINAL_EXIT', '1회 환승 마지막 구간은 FINAL_EXIT여야 합니다.');
  assert(secondLeg.egressPreference === 'ELEVATOR', '마지막 구간에 egressPreference가 전달되어야 합니다.');
  assert(typeof secondLeg.recommendedCarNo === 'number', '시설 데이터가 없어도 마지막 구간은 쾌적칸 fallback 추천이 있어야 합니다.');
  assert(secondLeg.recommendedDoorNo === undefined && secondLeg.anchorDoorNo === undefined, '검증되지 않은 하차문은 확정 노출하지 않아야 합니다.');
  assert(secondLeg.positionLabel.startsWith('쾌적도 기준'), 'FINAL_EXIT 데이터가 없는 구간은 하차 기준처럼 보이지 않도록 쾌적도 기준 문구를 써야 합니다.');

  console.log(JSON.stringify({
    ok: true,
    lookup: {
      escalator: `${escalator.record.carNo}-${escalator.record.doorNo}`,
      elevator: `${elevator.record.carNo}-${elevator.record.doorNo}`,
      stairs: `${stairs.record.carNo}-${stairs.record.doorNo}`,
    },
    direct: {
      mode: direct.routeChoice.mode,
      facilityType: direct.routeChoice.facilityType,
      selectedCarNo: direct.routeChoice.selectedCarNo,
      labels: direct.routeChoice.anchorDoorLabels,
    },
    oneTransfer: {
      firstGoal: oneTransfer.routeGuidance.legs[0].goal,
      finalGoal: secondLeg.goal,
      finalStatus: secondLeg.status,
      finalCarNo: secondLeg.recommendedCarNo,
      finalDoorNo: secondLeg.recommendedDoorNo,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
