export type ComfortType = 'HOT_SENSITIVE' | 'COLD_SENSITIVE' | 'CROWD_AVOIDER' | 'BALANCED';
export type SourceType = 'REALTIME_CAR' | 'STATISTICAL_CAR' | 'AVERAGE_STATION' | 'ESTIMATED' | 'USER_FEEDBACK';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type RecommendRequest = {
  line: string;
  originStation: string;
  destinationStation?: string;
  direction?: string;
  comfortType: ComfortType;
  targetTime?: string;
  waitToleranceMin?: 0 | 3 | 5 | 10;
  avoidPrioritySeatArea?: boolean;
  anonymousId?: string;
};

export type CarComfort = {
  carNo: number;
  label: string;
  position: 'front' | 'middle' | 'back';
  crowdScore: number;
  coolingScore: number;
  convenienceScore: number;
  totalComfortScore: number;
  isWeakAc: boolean;
  isPrioritySeatArea: boolean;
  tags: string[];
};

export type SourceMeta = {
  provider: string;
  sourceType: SourceType;
  confidence: Confidence;
  observedAt: string;
  retrievedAt?: string;
  cacheHit?: boolean;
  cacheTtlSeconds?: number;
  fallbackReason?: string;
  message: string;
};

export type RecommendationResponse = {
  recommendationId: string;
  request: RecommendRequest;
  recommendedCar: CarComfort;
  avoidCars: CarComfort[];
  cars: CarComfort[];
  reasons: string[];
  sourceMeta: SourceMeta;
  fallbackUsed: boolean;
  safetyNotice: string;
};
