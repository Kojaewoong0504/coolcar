import { randomUUID } from 'crypto';
import { resolveProvider } from './providers';
import type { CarComfort, RecommendRequest, RecommendationResponse } from './types';

function scoreCar(car: CarComfort, request: RecommendRequest): CarComfort {
  const weights = request.comfortType === 'HOT_SENSITIVE'
    ? { cool: 0.48, crowd: 0.28, convenience: 0.24 }
    : request.comfortType === 'COLD_SENSITIVE'
      ? { cool: -0.28, crowd: 0.38, convenience: 0.34 }
      : request.comfortType === 'CROWD_AVOIDER'
        ? { cool: 0.22, crowd: 0.56, convenience: 0.22 }
        : { cool: 0.34, crowd: 0.34, convenience: 0.32 };
  const priorityPenalty = request.avoidPrioritySeatArea && car.isPrioritySeatArea ? 8 : 0;
  const weakAcBonus = request.comfortType === 'COLD_SENSITIVE' && car.isWeakAc ? 12 : 0;
  const total = (car.coolingScore * weights.cool) + (car.crowdScore * weights.crowd) + (car.convenienceScore * weights.convenience) + weakAcBonus - priorityPenalty;
  return { ...car, totalComfortScore: Math.round(Math.max(0, Math.min(100, total))) };
}

function reasons(car: CarComfort, request: RecommendRequest, fallbackUsed: boolean): string[] {
  const list: string[] = [];
  if (request.comfortType === 'HOT_SENSITIVE') list.push(`${car.label}은 냉방 체감 점수가 높아 더위형에게 유리해요.`);
  if (request.comfortType === 'COLD_SENSITIVE') list.push(car.isWeakAc ? '약냉방칸이라 추위를 많이 타는 사용자에게 맞을 가능성이 높아요.' : '과냉방 가능성이 낮은 칸을 우선했어요.');
  if (request.comfortType === 'CROWD_AVOIDER') list.push('중앙부보다 혼잡도가 낮을 가능성이 높은 칸을 우선했어요.');
  if (request.comfortType === 'BALANCED') list.push('냉방·혼잡·하차 동선을 균형 있게 반영했어요.');
  if (request.avoidPrioritySeatArea) list.push('객실 끝 쪽 냉방 장점은 보되, 교통약자석 이용 배려를 고려해 점수를 보정했어요.');
  list.push(fallbackUsed ? '실시간 확정값이 아니라 데이터 출처 신뢰도에 맞춰 보수적으로 안내해요.' : '칸별 데이터와 사용자 성향을 함께 반영했어요.');
  return list.slice(0, 3);
}

export async function recommend(request: RecommendRequest): Promise<RecommendationResponse> {
  const providerResult = await resolveProvider(request);
  const scored = providerResult.cars.map((c) => scoreCar(c, request)).sort((a, b) => b.totalComfortScore - a.totalComfortScore);
  const recommendedCar = scored[0];
  const avoidCars = [...scored].sort((a, b) => a.totalComfortScore - b.totalComfortScore).slice(0, 2);
  return {
    recommendationId: randomUUID(),
    request,
    recommendedCar,
    avoidCars,
    cars: scored.sort((a, b) => a.carNo - b.carNo),
    reasons: reasons(recommendedCar, request, providerResult.fallbackUsed),
    sourceMeta: providerResult.sourceMeta,
    fallbackUsed: providerResult.fallbackUsed,
    safetyNotice: '교통약자석은 필요한 승객을 위해 비워두고, 추천은 승차 위치 참고용으로만 사용해 주세요.',
  };
}
