import { recommend } from '../src/lib/recommendation';
import type { ComfortType, RecommendRequest } from '../src/lib/types';

async function main() {
  const comfortTypes: ComfortType[] = ['HOT_SENSITIVE', 'COLD_SENSITIVE', 'CROWD_AVOIDER', 'BALANCED'];
  const requests: RecommendRequest[] = comfortTypes.flatMap((comfortType) => [
    { line: '2호선', originStation: '구로디지털단지역', destinationStation: '올림픽공원역', destinationLine: '9호선', comfortType, waitToleranceMin: 3, avoidPrioritySeatArea: true },
    { line: '2호선', originStation: '강남역', destinationStation: '홍대입구역', destinationLine: '2호선', comfortType, waitToleranceMin: 3, avoidPrioritySeatArea: true },
    { line: '3호선', originStation: '양재역', destinationStation: '여의도역', destinationLine: '9호선', comfortType, waitToleranceMin: 3, avoidPrioritySeatArea: true },
  ]);

  const results = [];
  for (const request of requests) {
    const result = await recommend(request);
    results.push({ line: request.line, origin: request.originStation, comfortType: request.comfortType, carNo: result.recommendedCar.carNo, mode: result.routeChoice.mode, message: result.routeChoice.message });
  }

  const edgeFallbacks = results.filter((item) => item.mode === 'COMFORT_ONLY' && (item.carNo === 1 || item.carNo === 10));
  if (edgeFallbacks.length > 2) {
    throw new Error(`COMFORT_ONLY edge-car bias is still too high: ${JSON.stringify(edgeFallbacks, null, 2)}`);
  }

  const unexplainedFallback = results.find((item) => item.mode === 'COMFORT_ONLY' && !/쾌적도/.test(item.message));
  if (unexplainedFallback) {
    throw new Error(`COMFORT_ONLY fallback lacks user-safe explanation: ${JSON.stringify(unexplainedFallback)}`);
  }

  console.log(JSON.stringify({ ok: true, total: results.length, edgeFallbacks: edgeFallbacks.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
