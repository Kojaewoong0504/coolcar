import { randomUUID } from 'crypto';
import { resolveProvider } from './providers';
import { buildRouteGuidance, resolveRouteAnchor } from './routeGuidance';
import { getSupabaseAdmin } from './supabase';
import type { CarComfort, RecommendRequest, RecommendationResponse, RouteChoice } from './types';

type FeedbackSignal = {
  car_no: number | null;
  feedback_type: 'GOOD' | 'HOT' | 'COLD' | 'CROWDED' | 'WRONG';
  temperature_feel: 'COOL' | 'OK' | 'HOT' | 'COLD' | null;
  crowding_feel: 'LOW' | 'MID' | 'HIGH' | null;
  created_at: string;
};

type FeedbackAdjustment = {
  byCar: Record<number, { cooling: number; crowd: number; convenience: number; total: number }>;
  count: number;
  positiveCount: number;
  negativeCount: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function minutesSince(iso: string) {
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return 120;
  return Math.max(0, (Date.now() - created) / 60000);
}

function feedbackWeight(createdAt: string) {
  const minutes = minutesSince(createdAt);
  if (minutes <= 10) return 1;
  if (minutes <= 30) return 0.65;
  if (minutes <= 60) return 0.35;
  return 0;
}

function emptyFeedbackAdjustment(): FeedbackAdjustment {
  return { byCar: {}, count: 0, positiveCount: 0, negativeCount: 0 };
}

function accumulateFeedback(feedback: FeedbackSignal[]): FeedbackAdjustment {
  const byCar: FeedbackAdjustment['byCar'] = {};
  let positiveCount = 0;
  let negativeCount = 0;

  for (const row of feedback) {
    if (!row.car_no) continue;
    const weight = feedbackWeight(row.created_at);
    if (weight <= 0) continue;
    const current = byCar[row.car_no] ?? { cooling: 0, crowd: 0, convenience: 0, total: 0 };

    if (row.feedback_type === 'GOOD') {
      current.total += 5 * weight;
      current.convenience += 3 * weight;
      positiveCount += 1;
    }
    if (row.feedback_type === 'WRONG') {
      current.total -= 8 * weight;
      negativeCount += 1;
    }
    if (row.feedback_type === 'CROWDED' || row.crowding_feel === 'HIGH') {
      current.crowd -= 10 * weight;
      current.total -= 4 * weight;
      negativeCount += 1;
    }
    if (row.crowding_feel === 'LOW') {
      current.crowd += 8 * weight;
      current.total += 3 * weight;
      positiveCount += 1;
    }
    if (row.feedback_type === 'HOT' || row.temperature_feel === 'HOT') {
      current.cooling -= 9 * weight;
      current.total -= 3 * weight;
      negativeCount += 1;
    }
    if (row.feedback_type === 'COLD' || row.temperature_feel === 'COLD') {
      current.cooling -= 4 * weight;
      current.total -= 2 * weight;
      negativeCount += 1;
    }
    if (row.temperature_feel === 'COOL') {
      current.cooling += 7 * weight;
      current.total += 3 * weight;
      positiveCount += 1;
    }

    byCar[row.car_no] = current;
  }

  return { byCar, count: Object.keys(byCar).length, positiveCount, negativeCount };
}

async function loadRecentFeedback(request: RecommendRequest): Promise<FeedbackAdjustment> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return emptyFeedbackAdjustment();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('feedback_events')
    .select('car_no,feedback_type,temperature_feel,crowding_feel,created_at')
    .eq('line', request.line)
    .eq('station', request.originStation)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(80);

  if (request.direction) query = query.eq('direction', request.direction);

  const { data, error } = await query;
  if (error || !data) return emptyFeedbackAdjustment();
  return accumulateFeedback(data as FeedbackSignal[]);
}

function applyFeedback(car: CarComfort, adjustment: FeedbackAdjustment): CarComfort {
  const adj = adjustment.byCar[car.carNo];
  if (!adj) return car;
  return {
    ...car,
    coolingScore: clampScore(car.coolingScore + adj.cooling),
    crowdScore: clampScore(car.crowdScore + adj.crowd),
    convenienceScore: clampScore(car.convenienceScore + adj.convenience),
    tags: [...new Set([...car.tags, adj.total >= 0 ? '최근제보' : '제보주의'])],
  };
}

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
  const feedbackBonus = car.tags.includes('최근제보') ? 4 : car.tags.includes('제보주의') ? -6 : 0;
  const total = (car.coolingScore * weights.cool) + (car.crowdScore * weights.crowd) + (car.convenienceScore * weights.convenience) + weakAcBonus + feedbackBonus - priorityPenalty;
  return { ...car, totalComfortScore: clampScore(total) };
}

function sortByRecommendationScore(cars: CarComfort[]) {
  return [...cars].sort((a, b) => {
    if (b.totalComfortScore !== a.totalComfortScore) return b.totalComfortScore - a.totalComfortScore;
    return a.carNo - b.carNo;
  });
}

function candidateCarsAroundAnchor(cars: CarComfort[], anchorCarNo: number) {
  const allowed = new Set([anchorCarNo - 1, anchorCarNo, anchorCarNo + 1]);
  return cars.filter((car) => allowed.has(car.carNo));
}

function buildRouteChoice(params: {
  cars: CarComfort[];
  recommendedCar: CarComfort;
  anchor?: Awaited<ReturnType<typeof resolveRouteAnchor>>;
}): RouteChoice {
  if (!params.anchor) {
    return {
      mode: 'COMFORT_ONLY',
      candidateCarNos: params.cars.map((car) => car.carNo),
      selectedCarNo: params.recommendedCar.carNo,
      message: '환승·하차 위치가 확정되지 않아 전체 칸에서 쾌적도가 좋은 칸을 골랐어요.',
    };
  }

  const candidateCarNos = candidateCarsAroundAnchor(params.cars, params.anchor.carNo).map((car) => car.carNo);
  return {
    mode: 'ANCHOR_WINDOW',
    goal: params.anchor.goal,
    anchorCarNo: params.anchor.carNo,
    anchorDoorNo: params.anchor.doorNo,
    candidateCarNos,
    selectedCarNo: params.recommendedCar.carNo,
    station: params.anchor.station,
    facility: params.anchor.facility,
    message: `${params.anchor.station} ${params.anchor.carNo}번째 칸${params.anchor.doorNo ? ` · ${params.anchor.doorNo}번 문` : ''} 주변 ${candidateCarNos.join(', ')}번째 칸 중에서 쾌적한 칸을 골랐어요.`,
  };
}

function reasons(car: CarComfort, request: RecommendRequest, fallbackUsed: boolean, feedback: FeedbackAdjustment, routeChoice: RouteChoice): string[] {
  const list: string[] = [];
  if (routeChoice.mode === 'ANCHOR_WINDOW') {
    list.push(`환승·하차에 가까운 ${routeChoice.anchorCarNo}번째 칸 주변 ${routeChoice.candidateCarNos.join(', ')}번째 칸을 먼저 비교했어요.`);
  }
  if (request.comfortType === 'HOT_SENSITIVE') list.push(`${car.label}은 더위 피하기에 유리한 쪽으로 추정돼요.`);
  if (request.comfortType === 'COLD_SENSITIVE') list.push(car.isWeakAc ? '약냉방칸이라 추위를 많이 타는 사용자에게 맞을 가능성이 높아요.' : '과냉방 가능성이 낮은 칸을 우선했어요.');
  if (request.comfortType === 'CROWD_AVOIDER') list.push('중앙부보다 혼잡도가 낮을 가능성이 높은 칸을 우선했어요.');
  if (request.comfortType === 'BALANCED') list.push('냉방·혼잡·하차 동선을 균형 있게 반영했어요.');
  if (feedback.count > 0) list.push('최근 이용자 제보를 함께 반영했어요.');
  if (request.avoidPrioritySeatArea) list.push('객실 끝 쪽 냉방 장점은 보되, 교통약자석 이용 배려를 고려해 점수를 보정했어요.');
  list.push(fallbackUsed ? '실시간 확정값이 아니라 공공·정적 규칙과 시간대 패턴 기반 추정이에요.' : '칸별 데이터와 사용자 성향을 함께 반영했어요.');
  return list.slice(0, 3);
}

export async function recommend(request: RecommendRequest): Promise<RecommendationResponse> {
  const providerResult = await resolveProvider(request);
  const feedback = await loadRecentFeedback(request);
  const scored = providerResult.cars
    .map((c) => applyFeedback(c, feedback))
    .map((c) => scoreCar(c, request));
  const sorted = sortByRecommendationScore(scored);
  const routeAnchor = await resolveRouteAnchor(request);
  const anchorCandidates = routeAnchor ? candidateCarsAroundAnchor(scored, routeAnchor.carNo) : [];
  const recommendationPool = anchorCandidates.length > 0 ? anchorCandidates : scored;
  const recommendedCar = sortByRecommendationScore(recommendationPool)[0] ?? sorted[0];
  const routeChoice = buildRouteChoice({ cars: scored, recommendedCar, anchor: anchorCandidates.length > 0 ? routeAnchor : undefined });
  const avoidCars = [...sorted].filter((car) => car.carNo !== recommendedCar.carNo).slice(-2).reverse();
  return {
    recommendationId: randomUUID(),
    request,
    recommendedCar,
    avoidCars,
    cars: scored.sort((a, b) => a.carNo - b.carNo),
    reasons: reasons(recommendedCar, request, providerResult.fallbackUsed, feedback, routeChoice),
    routeChoice,
    routeGuidance: await buildRouteGuidance(request, recommendedCar, routeChoice),
    sourceMeta: {
      ...providerResult.sourceMeta,
      confidence: feedback.count >= 3 ? 'MEDIUM' : providerResult.sourceMeta.confidence,
      message: feedback.count > 0
        ? '공공·정적 규칙, 시간대 패턴, 최근 이용자 제보를 함께 반영한 추정 추천이에요.'
        : providerResult.sourceMeta.message,
    },
    fallbackUsed: providerResult.fallbackUsed,
    safetyNotice: '교통약자석은 필요한 승객을 위해 비워두고, 추천은 승차 위치 참고용으로만 사용해 주세요.',
  };
}
