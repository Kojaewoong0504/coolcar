import type { CarComfort, RecommendRequest, SourceMeta } from './types';
import { getKoreaTimeParts } from './tmap/config';
import { runTmapDiagnosticProbe } from './tmap/diagnostics';
import { logProviderDiagnosticEvent } from './providerDiagnosticsLog';

export type ProviderResult = { cars: CarComfort[]; sourceMeta: SourceMeta; fallbackUsed: boolean };
export interface CongestionProvider { name: string; supports(request: RecommendRequest): boolean; getCars(request: RecommendRequest): Promise<ProviderResult>; }

const weakAcCars: Record<string, number[]> = {
  '1호선': [4, 7], '2호선': [4, 7], '3호선': [4, 7], '4호선': [4, 7], '5호선': [4, 7],
  '6호선': [4, 7], '7호선': [4, 7], '8호선': [3, 4], '9호선': [4, 5], '신분당선': [3, 4],
};

function lineCarCount(line: string) { return line === '9호선' || line === '신분당선' ? 6 : 10; }
function stableHash(s: string) { return [...s].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 997, 7); }

function congestionToTag(congestion: number) {
  if (congestion >= 85) return '혼잡';
  if (congestion <= 45) return '여유';
  return '보통';
}

function applyTmapCrowding(baseCars: CarComfort[], congestionCars: number[]): CarComfort[] {
  return baseCars.slice(0, congestionCars.length).map((car, index) => {
    const congestion = Math.max(0, Math.min(150, Math.round(congestionCars[index] ?? 70)));
    const crowdScore = Math.max(0, Math.min(100, Math.round(100 - Math.min(100, congestion))));
    return {
      ...car,
      crowdScore,
      tags: [car.tags[0] ?? '보통', congestionToTag(congestion)],
    };
  });
}

function statisticalFallback(request: RecommendRequest, message = 'TMAP 칸별 데이터를 가져오지 못해 통계형 목업 데이터로 계산했어요.'): ProviderResult {
  return {
    cars: generateCars(request, 'statistical'),
    fallbackUsed: true,
    sourceMeta: {
      provider: 'MockTmapStatisticalProvider',
      sourceType: 'STATISTICAL_CAR',
      confidence: 'MEDIUM',
      observedAt: new Date().toISOString(),
      message,
    },
  };
}

export function generateCars(request: RecommendRequest, mode: 'statistical' | 'estimated'): CarComfort[] {
  const count = lineCarCount(request.line);
  const target = request.targetTime ? new Date(request.targetTime) : new Date();
  const rushBias = target.getHours() >= 17 || target.getHours() <= 9 ? 10 : 0;
  const hash = stableHash(`${request.line}:${request.originStation}:${request.direction ?? ''}`);
  const weak = new Set(weakAcCars[request.line] ?? []);
  return Array.from({ length: count }, (_, i) => {
    const carNo = i + 1;
    const edgeBonus = carNo === 1 || carNo === count ? 24 : carNo === 2 || carNo === count - 1 ? 14 : 0;
    const centerPenalty = Math.max(0, 18 - Math.abs(carNo - (count + 1) / 2) * 6);
    const syntheticCrowd = Math.min(96, Math.max(12, 42 + centerPenalty + rushBias + ((hash + carNo * 13) % 22) - edgeBonus / 2));
    const coolingScore = Math.min(100, Math.max(20, 58 + edgeBonus - (weak.has(carNo) ? 26 : 0) - (mode === 'estimated' ? 6 : 0)));
    const convenienceScore = Math.min(100, Math.max(20, 62 + ((hash + carNo * 5) % 18) - (carNo === 1 || carNo === count ? 4 : 0)));
    return {
      carNo,
      label: `${carNo}번째 칸 ${carNo <= 2 ? '앞쪽' : carNo >= count - 1 ? '뒤쪽' : '중앙'}`,
      position: carNo <= 2 ? 'front' : carNo >= count - 1 ? 'back' : 'middle',
      crowdScore: Math.round(100 - syntheticCrowd),
      coolingScore: Math.round(coolingScore),
      convenienceScore: Math.round(convenienceScore),
      totalComfortScore: 0,
      isWeakAc: weak.has(carNo),
      isPrioritySeatArea: carNo === 1 || carNo === count,
      tags: [weak.has(carNo) ? '약냉방' : coolingScore > 75 ? '시원함' : '보통', syntheticCrowd > 70 ? '혼잡' : syntheticCrowd < 45 ? '여유' : '보통'],
    };
  });
}

export class TmapCongestionProvider implements CongestionProvider {
  name = 'TmapCongestionProvider';
  supports(request: RecommendRequest) { return /^(1|2|3|4|5|6|7|8|9)호선$/.test(request.line) || request.line === '신분당선'; }

  async getCars(request: RecommendRequest): Promise<ProviderResult> {
    const { dow, hh } = getKoreaTimeParts(request.targetTime);
    const diagnostic = await runTmapDiagnosticProbe({
      line: request.line,
      station: request.originStation,
      dow,
      hh,
    });

    if (!diagnostic.ok || !diagnostic.congestionCars) {
      await logProviderDiagnosticEvent(diagnostic);
      if (diagnostic.code === 'LIVE_DISABLED') {
        return {
          cars: generateCars(request, 'estimated'),
          fallbackUsed: true,
          sourceMeta: {
            provider: 'EstimatedCongestionProvider',
            sourceType: 'ESTIMATED',
            confidence: 'LOW',
            observedAt: new Date().toISOString(),
            fallbackReason: diagnostic.code,
            message: 'TMAP 무료 quota 보호를 위해 실시간 호출은 잠시 멈추고, 시간대 패턴 기반 추정으로 안내해요.',
          },
        };
      }
      const safeReason = diagnostic.code === 'PRODUCT_NOT_AUTHORIZED'
        ? 'TMAP 상품/API 권한 또는 IP 허용 상태가 확인되지 않아 통계형 대체 계산으로 안내해요.'
        : diagnostic.code === 'ACCESS_DENIED'
          ? 'TMAP 접근 허용 정책을 확인해야 해 통계형 대체 계산으로 안내해요.'
          : diagnostic.code === 'MALFORMED_PARAMS'
            ? 'TMAP 요청 파라미터를 확인해야 해 통계형 대체 계산으로 안내해요.'
            : `TMAP 진단(${diagnostic.code})으로 실데이터를 확정하지 못해 통계형 대체 계산으로 안내해요.`;
      return statisticalFallback(request, safeReason);
    }

    await logProviderDiagnosticEvent(diagnostic);
    return {
      cars: applyTmapCrowding(generateCars(request, 'statistical'), diagnostic.congestionCars),
      fallbackUsed: false,
      sourceMeta: {
        provider: 'TMAP_SK_OPEN_API',
        sourceType: 'STATISTICAL_CAR',
        confidence: 'HIGH',
        observedAt: new Date().toISOString(),
        retrievedAt: diagnostic.createdAt,
        cacheHit: diagnostic.cacheHit ?? false,
        cacheTtlSeconds: diagnostic.cacheTtlSeconds,
        message: diagnostic.cacheHit ? 'TMAP/SK 공식 통계형 칸별 혼잡도 캐시와 시원칸 냉방 규칙을 함께 반영했어요.' : 'TMAP/SK 공식 통계형 칸별 혼잡도와 시원칸 냉방 규칙을 함께 반영했어요.',
      },
    };
  }
}

export class EstimatedCongestionProvider implements CongestionProvider {
  name = 'EstimatedCongestionProvider';
  supports() { return true; }
  async getCars(request: RecommendRequest): Promise<ProviderResult> {
    return { cars: generateCars(request, 'estimated'), fallbackUsed: true, sourceMeta: { provider: this.name, sourceType: 'ESTIMATED', confidence: 'LOW', observedAt: new Date().toISOString(), message: '실시간 칸별 데이터가 없어 시간대 패턴 기반 추정으로 안내해요.' } };
  }
}

export async function resolveProvider(request: RecommendRequest): Promise<ProviderResult> {
  const providers: CongestionProvider[] = [new TmapCongestionProvider(), new EstimatedCongestionProvider()];
  const provider = providers.find((p) => p.supports(request)) ?? new EstimatedCongestionProvider();
  try { return await provider.getCars(request); } catch { return provider instanceof TmapCongestionProvider ? statisticalFallback(request) : new EstimatedCongestionProvider().getCars(request); }
}
