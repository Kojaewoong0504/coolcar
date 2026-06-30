import { recommend } from '../src/lib/recommendation';
import type { ComfortType } from '../src/lib/types';

const comfortTypes: ComfortType[] = ['HOT_SENSITIVE', 'COLD_SENSITIVE', 'CROWD_AVOIDER', 'BALANCED'];
const expectedReasonSnippets: Record<ComfortType, string> = {
  HOT_SENSITIVE: '더위',
  COLD_SENSITIVE: '과냉방',
  CROWD_AVOIDER: '혼잡',
  BALANCED: '균형',
};

async function main() {
  const results = [];

  for (const comfortType of comfortTypes) {
    const result = await recommend({
      line: '2호선',
      originStation: '구로디지털단지역',
      destinationStation: '올림픽공원역',
      destinationLine: '9호선',
      transferStations: ['당산역'],
      comfortType,
      egressPreference: 'ANY',
      waitToleranceMin: 3,
      avoidPrioritySeatArea: true,
    });

    const reasonText = result.reasons.join(' ');
    const expected = expectedReasonSnippets[comfortType];
    if (!reasonText.includes(expected)) {
      throw new Error(`${comfortType} reason did not include expected snippet: ${expected}\n${reasonText}`);
    }

    if (result.request.comfortType !== comfortType) {
      throw new Error(`${comfortType} was not preserved in recommendation request.`);
    }

    if (result.routeGuidance.legs.length !== 2) {
      throw new Error(`${comfortType} should preserve the 2-leg transfer route.`);
    }

    results.push({
      comfortType,
      carNo: result.recommendedCar.carNo,
      totalComfortScore: result.recommendedCar.totalComfortScore,
      secondReason: result.reasons[1],
      legs: result.routeGuidance.legs.map((leg) => `${leg.line}:${leg.fromStation}->${leg.toStation}:${leg.goal}`),
    });
  }

  const uniqueReasons = new Set(results.map((item) => item.secondReason));
  if (uniqueReasons.size !== comfortTypes.length) {
    throw new Error(`Comfort reasons should differ by persona: ${JSON.stringify(results, null, 2)}`);
  }

  console.log(JSON.stringify({ ok: true, scenario: '구로디지털단지역→올림픽공원역, 당산역 환승', results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
