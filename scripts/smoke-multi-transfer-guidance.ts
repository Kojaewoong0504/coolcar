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
  assert(result.routeGuidance.legs[1].toStation === '대곡역', '두 번째 환승 목표는 대곡역이어야 합니다.');
  assert(result.routeChoice.mode === 'ANCHOR_WINDOW' || result.routeChoice.mode === 'COMFORT_ONLY', '추천은 검증된 환승 위치 또는 쾌적칸 기준 중 하나여야 합니다.');
  if (result.routeChoice.mode === 'ANCHOR_WINDOW') {
    assert(result.routeChoice.goal === 'NEXT_TRANSFER', '환승 위치가 검증된 경우 첫 탑승 추천은 첫 환승 기준이어야 합니다.');
  }
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
