import { lookupDoorGuide } from '../src/lib/doorGuidance/resolver';
import { normalizeDirection, normalizeLine, normalizeStationName, parseCarDoor } from '../src/lib/doorGuidance/normalize';
import { inferLineDirection } from '../src/lib/routeDirection';
import { buildRouteGuidance } from '../src/lib/routeGuidance';
import type { CarComfort, RecommendRequest } from '../src/lib/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const car: CarComfort = {
  carNo: 5,
  label: '5번째 칸 중앙',
  position: 'middle',
  crowdScore: 50,
  coolingScore: 50,
  convenienceScore: 50,
  totalComfortScore: 50,
  isWeakAc: false,
  isPrioritySeatArea: false,
  tags: [],
};

async function main() {
  assert(normalizeLine('01호선') === '1호선', 'line alias failed');
  assert(normalizeLine('경의선') === '경의중앙선', '경의선 alias failed');
  assert(normalizeLine('수인분당') === '수인분당선', '수인분당 alias failed');
  assert(normalizeStationName(' 서울역 ') === '서울', 'station trim/역 normalization failed');
  assert(normalizeStationName('서울') === normalizeStationName('서울역'), '서울/서울역 alias failed');
  assert(normalizeDirection('시청 방면') === 'TOWARD_시청', 'direction 방면 normalization failed');
  assert(normalizeDirection('교대(법원.검찰청)') === 'TOWARD_교대', 'direction parenthesis normalization failed');
  assert(parseCarDoor('9-3')?.carNo === 9 && parseCarDoor('9-3')?.doorNo === 3, 'door parse failed');
  assert(parseCarDoor('13-1') === undefined, 'invalid carNo should be rejected');
  assert(parseCarDoor('2-9') === undefined, 'invalid doorNo should be rejected');

  const available = await lookupDoorGuide({ line: '1호선', toStation: '서울역', direction: '시청', goal: 'FINAL_EXIT' });
  assert(available.status === 'available', '서울역 1호선 시청 방향 should be available');
  assert(available.record.carNo === 9 && available.record.doorNo === 3, '서울역 시청 direction should map to 9-3');

  const gangnamTransfer = await lookupDoorGuide({
    line: '2호선',
    toStation: '강남역',
    direction: '교대',
    goal: 'NEXT_TRANSFER',
    targetLine: '신분당선',
  });
  assert(gangnamTransfer.status === 'available', '강남역 2호선→신분당선 교대 방향 transfer anchor should be available');
  assert(gangnamTransfer.record.carNo === 6 && gangnamTransfer.record.doorNo === 3, '강남역 교대 방향 transfer anchor should map to 6-3');

  const gangnamNoDirection = await lookupDoorGuide({
    line: '2호선',
    toStation: '강남역',
    goal: 'NEXT_TRANSFER',
    targetLine: '신분당선',
  });
  assert(gangnamNoDirection.status === 'needs_direction', 'directional transfer data without direction should need direction');

  const sportsDirection = inferLineDirection({
    line: '2호선',
    originStation: '구로디지털단지역',
    targetStation: '종합운동장역',
  });
  assert(sportsDirection?.doorGuideDirection === '잠실새내', '구로디지털단지→종합운동장 inferred local direction should be 잠실새내');
  const sportsTransfer = await lookupDoorGuide({
    line: '2호선',
    toStation: '종합운동장역',
    direction: sportsDirection.doorGuideDirection,
    goal: 'NEXT_TRANSFER',
    targetLine: '9호선',
  });
  assert(sportsTransfer.status === 'available', '종합운동장역 2호선→9호선 자동 추론 방향 transfer anchor should be available');
  assert(sportsTransfer.record.carNo === 3 && sportsTransfer.record.doorNo === 1, '종합운동장 건대입구 방면 side should map to 3-1');

  const daegokDirection = inferLineDirection({
    line: '경의중앙선',
    originStation: '홍대입구역',
    targetStation: '대곡역',
  });
  assert(daegokDirection?.doorGuideDirection === '곡산', '홍대입구→대곡 inferred local direction should be 곡산');
  const daegokTransfer = await lookupDoorGuide({
    line: '경의중앙선',
    toStation: '대곡역',
    direction: daegokDirection.doorGuideDirection,
    goal: 'NEXT_TRANSFER',
    targetLine: '3호선',
  });
  assert(daegokTransfer.status === 'available', '대곡역 경의중앙선→3호선 문산 방향 transfer anchor should be available');
  assert(daegokTransfer.record.carNo === 4 && daegokTransfer.record.doorNo === 2, '대곡역 문산 방향 transfer anchor should map to 4-2');

  const daegokReverseTransfer = await lookupDoorGuide({
    line: '경의중앙선',
    toStation: '대곡역',
    direction: '능곡',
    goal: 'NEXT_TRANSFER',
    targetLine: '3호선',
  });
  assert(daegokReverseTransfer.status === 'available', '대곡역 경의중앙선→3호선 용산 방향 transfer anchor should be available');
  assert(daegokReverseTransfer.record.carNo === 5 && daegokReverseTransfer.record.doorNo === 3, '대곡역 용산 방향 transfer anchor should map to 5-3');

  const sadangDirection = inferLineDirection({
    line: '4호선',
    originStation: '남태령역',
    targetStation: '사당역',
  });
  assert(sadangDirection?.doorGuideDirection === '총신대입구', '남태령→사당 inferred local direction should be 총신대입구');
  const sadangTransfer = await lookupDoorGuide({
    line: '4호선',
    toStation: '사당역',
    direction: sadangDirection.doorGuideDirection,
    goal: 'NEXT_TRANSFER',
    targetLine: '2호선',
  });
  assert(sadangTransfer.status === 'available', '사당역 4호선→2호선 총신대입구 방향 transfer anchor should be available');
  assert(sadangTransfer.record.carNo === 4 && sadangTransfer.record.doorNo === 2, '사당역 총신대입구 방향 transfer anchor should map to 4-2');

  const hongdaeToAirportSinchon = await lookupDoorGuide({
    line: '2호선',
    toStation: '홍대입구역',
    direction: '신촌',
    goal: 'NEXT_TRANSFER',
    targetLine: '공항철도',
  });
  assert(hongdaeToAirportSinchon.status === 'available', '홍대입구역 2호선→공항철도 신촌 방면 should be available');
  assert(hongdaeToAirportSinchon.record.carNo === 7 && hongdaeToAirportSinchon.record.doorNo === 2, '홍대입구 신촌 방면 primary transfer anchor should be 7-2');
  assert(hongdaeToAirportSinchon.records?.some((record) => record.carNo === 9 && record.doorNo === 2), '홍대입구 신촌 방면 secondary transfer anchor should include 9-2');

  const hongdaeToAirportHapjeong = await lookupDoorGuide({
    line: '2호선',
    toStation: '홍대입구역',
    direction: '합정',
    goal: 'NEXT_TRANSFER',
    targetLine: '공항철도',
  });
  assert(hongdaeToAirportHapjeong.status === 'available', '홍대입구역 2호선→공항철도 합정 방면 should be available');
  assert(hongdaeToAirportHapjeong.record.carNo === 2 && hongdaeToAirportHapjeong.record.doorNo === 2, '홍대입구 합정 방면 primary transfer anchor should be 2-2');
  assert(hongdaeToAirportHapjeong.records?.some((record) => record.carNo === 4 && record.doorNo === 2), '홍대입구 합정 방면 secondary transfer anchor should include 4-2');

  const noDirection = await lookupDoorGuide({ line: '1호선', toStation: '서울역', goal: 'FINAL_EXIT' });
  assert(noDirection.status === 'needs_direction', 'directional data without direction should need direction');

  const unsupported = await lookupDoorGuide({ line: '2호선', toStation: '강남역', direction: '내선', goal: 'FINAL_EXIT' });
  assert(unsupported.status === 'needs_data', 'unsupported fixture should need data');

  const request: RecommendRequest = {
    line: '1호선',
    originStation: '남영역',
    destinationStation: '서울역',
    destinationLine: '1호선',
    direction: '시청',
    comfortType: 'BALANCED',
  };
  const guidance = await buildRouteGuidance(request, car);
  assert(guidance.legs.length === 1, 'direct route should have one leg');
  assert(guidance.legs[0].status === 'available', 'direct Seoul Station fixture should be available');
  assert(guidance.legs[0].recommendedCarNo === 9, 'route guidance car should use door guide car');
  assert(guidance.legs[0].recommendedDoorNo === 3, 'route guidance door should use door guide door');
  assert(guidance.legs[0].positionLabel.includes('9번째 칸'), 'position label should include car');
  assert(guidance.legs[0].positionLabel.includes('3번 문'), 'position label should include door');

  const ambiguousRequest: RecommendRequest = {
    line: '1호선',
    originStation: '남영역',
    destinationStation: '서울역',
    destinationLine: '1호선',
    comfortType: 'BALANCED',
  };
  const ambiguousGuidance = await buildRouteGuidance(ambiguousRequest, car);
  assert(ambiguousGuidance.legs[0].status === 'available', '역 순서로 방면 추론 가능한 직통 구간은 빠른하차 기준을 적용해야 합니다.');
  assert(ambiguousGuidance.legs[0].recommendedDoorNo === 3, '자동 방면 추론 후 문 번호를 유지해야 합니다.');

  console.log(JSON.stringify({
    ok: true,
    fixtures: {
      seoulStationSicheong: { carNo: available.record.carNo, doorNo: available.record.doorNo },
      gangnam2ToShinbundang: gangnamTransfer.status === 'available'
        ? { carNo: gangnamTransfer.record.carNo, doorNo: gangnamTransfer.record.doorNo }
        : undefined,
    },
    routeGuidance: {
      status: guidance.legs[0].status,
      positionLabel: guidance.legs[0].positionLabel,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
