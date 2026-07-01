import { recommend } from '../src/lib/recommendation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const result = await recommend({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '대화역',
    destinationLine: '3호선',
    transferStations: ['홍대입구역', '대곡역'],
    routeLines: ['2호선', '경의중앙선', '3호선'],
    comfortType: 'HOT_SENSITIVE',
    waitToleranceMin: 3,
    avoidPrioritySeatArea: true,
  });

  assert(result.routeGuidance.legs.length === 3, '2회 환승 추천은 3개 구간 안내를 가져야 합니다.');
  assert(result.routeGuidance.legs[0].line === '2호선', '1구간은 2호선이어야 합니다.');
  assert(result.routeGuidance.legs[1].line === '경의중앙선', '2구간은 경의중앙선이어야 합니다.');
  assert(result.routeGuidance.legs[2].line === '3호선', '3구간은 3호선이어야 합니다.');
  assert(result.routeGuidance.legs[0].toStation === '홍대입구역', '첫 환승 목표는 홍대입구역이어야 합니다.');
  assert(result.routeGuidance.legs[1].fromStation === '홍대입구역', '2구간 출발은 홍대입구역이어야 합니다.');
  assert(result.routeGuidance.legs[1].toStation === '대곡역', '두 번째 환승 목표는 대곡역이어야 합니다.');
  assert(result.routeGuidance.legs[1].goal === 'NEXT_TRANSFER', '2구간은 대곡역 다음 환승 안내여야 합니다.');
  assert(result.routeGuidance.legs[1].status === 'available', '2구간 대곡역 경의중앙선→3호선 환승 기준이 적용되어야 합니다.');
  assert(result.routeGuidance.legs[1].recommendedCarNo === 4, '2구간 환승 기준칸은 4번째 칸이어야 합니다.');
  assert(result.routeGuidance.legs[1].recommendedDoorNo === 2, '2구간 환승 기준 문은 2번 문이어야 합니다.');
  assert(result.routeGuidance.legs[1].anchorCarNo === 4, '2구간 anchorCarNo는 4번째 칸이어야 합니다.');
  assert(JSON.stringify(result.routeGuidance.legs[1].candidateCarNos) === JSON.stringify([3, 4, 5]), '2구간 anchor±1 후보는 3,4,5번째 칸이어야 합니다.');
  assert(result.routeGuidance.legs[2].fromStation === '대곡역', '3구간 출발은 대곡역이어야 합니다.');
  assert(result.routeGuidance.legs[2].toStation === '대화역', '3구간 도착은 대화역이어야 합니다.');
  const secondLeg = result.routeGuidance.legs[1];
  if (secondLeg.status !== 'available') {
    assert(!secondLeg.recommendedDoorNo, '검증되지 않은 2구간은 문 번호를 단정하면 안 됩니다.');
    assert(!secondLeg.anchorDoorNo, '검증되지 않은 2구간은 anchor door를 단정하면 안 됩니다.');
    const visibleCopy = `${secondLeg.positionLabel} ${secondLeg.message}`;
    for (const forbidden of ['정확', '공식', '확정', '무조건', '최적']) {
      assert(!visibleCopy.includes(forbidden), `2구간 fallback 문구에 과장 표현이 있으면 안 됩니다: ${forbidden}`);
    }
    assert(
      visibleCopy.includes('대곡역') && (visibleCopy.includes('쾌적') || visibleCopy.includes('승강장')),
      '2구간 fallback 문구는 다음 환승역과 쾌적/승강장 기준을 설명해야 합니다.',
    );
  }
  assert(result.routeChoice.mode === 'ANCHOR_WINDOW', '첫 환승 구간은 routeLines[1] 기준으로 환승 anchor를 적용해야 합니다.');
  assert(result.routeChoice.goal === 'NEXT_TRANSFER', '환승 위치가 검증된 경우 첫 탑승 추천은 첫 환승 기준이어야 합니다.');
  assert(result.routeChoice.station === '홍대입구역', '전체 routeChoice는 첫 환승역 홍대입구역 기준이어야 합니다.');
  assert(result.request.routeLines?.join('>') === '2호선>경의중앙선>3호선', '요청 routeLines가 응답에 보존되어야 합니다.');

  console.log(JSON.stringify({
    ok: true,
    legs: result.routeGuidance.legs.map((leg) => `${leg.legNo}:${leg.line}:${leg.fromStation}->${leg.toStation}:${leg.goal}:${leg.status}`),
    routeChoice: { goal: result.routeChoice.goal, station: result.routeChoice.station, mode: result.routeChoice.mode },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
