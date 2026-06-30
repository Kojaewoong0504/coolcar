import { inferLineDirection } from '../src/lib/routeDirection';
import { buildRoutePlanCandidates } from '../src/lib/routePlans';
import { recommend } from '../src/lib/recommendation';
import { searchStations } from '../src/lib/stations';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const guroToHongdae = inferLineDirection({ line: '2호선', originStation: '구로디지털단지역', targetStation: '홍대입구역' });
  assert(guroToHongdae?.boardDirectionLabel.includes('대림'), '구로디지털→홍대입구는 대림/신도림 방면으로 보여야 합니다.');
  assert(guroToHongdae?.doorGuideDirection === '신촌', '홍대입구 도착 기준 문 위치 direction은 신촌이어야 합니다.');

  const guroToOlympic = await buildRoutePlanCandidates({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '올림픽공원역',
    destinationLine: '9호선',
    comfortType: 'HOT_SENSITIVE',
    maxCandidates: 4,
  });
  const dangsan = guroToOlympic.candidates.find((candidate) => candidate.transferStations[0] === '당산역');
  assert(dangsan?.recommendRequestPatch.direction === '합정', '당산 환승 direction은 합정으로 자동 추론되어야 합니다.');
  assert(dangsan.coverage.nextTransferDoorGuide === 'available', '당산 환승문은 자동 방면으로 available이어야 합니다.');

  const recommendation = await recommend({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '올림픽공원역',
    destinationLine: '9호선',
    transferStations: ['당산역'],
    comfortType: 'HOT_SENSITIVE',
    waitToleranceMin: 3,
    avoidPrioritySeatArea: true,
  });
  assert(recommendation.routeGuidance.legs[0].status === 'available', '추천 결과 첫 구간도 자동 방면으로 위치 안내 가능해야 합니다.');
  assert(recommendation.routeGuidance.legs[0].anchorCarNo === 8, '당산 9호선 환승은 8번째 칸 기준이어야 합니다.');

  const airport = searchStations('인천공항', { limit: 10 }).map((station) => station.name);
  assert(airport.includes('인천공항1터미널역'), '인천공항1터미널역 검색이 되어야 합니다.');
  assert(airport.includes('인천공항2터미널역'), '인천공항2터미널역 검색이 되어야 합니다.');

  console.log(JSON.stringify({ ok: true, guroToHongdae, dangsan: { direction: dangsan.recommendRequestPatch.direction, coverage: dangsan.coverage.nextTransferDoorGuide }, airport }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
