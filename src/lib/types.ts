import type { DoorGuideFacilityType, EgressPreference } from './doorGuidance/types';
export type { DoorGuideFacilityType, EgressPreference } from './doorGuidance/types';

export type ComfortType = 'HOT_SENSITIVE' | 'COLD_SENSITIVE' | 'CROWD_AVOIDER' | 'BALANCED';
export type SourceType = 'REALTIME_CAR' | 'STATISTICAL_CAR' | 'AVERAGE_STATION' | 'ESTIMATED' | 'USER_FEEDBACK';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type RecommendRequest = {
  line: string;
  originStation: string;
  destinationStation?: string;
  destinationLine?: string;
  direction?: string;
  comfortType: ComfortType;
  egressPreference?: EgressPreference;
  targetTime?: string;
  waitToleranceMin?: 0 | 3 | 5 | 10;
  avoidPrioritySeatArea?: boolean;
  anonymousId?: string;
  transferStations?: string[];
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

export type RouteChoice = {
  mode: 'ANCHOR_WINDOW' | 'COMFORT_ONLY';
  goal?: 'FINAL_EXIT' | 'NEXT_TRANSFER';
  anchorCarNo?: number;
  anchorDoorNo?: number;
  anchorCarNos?: number[];
  anchorDoorLabels?: string[];
  candidateCarNos: number[];
  selectedCarNo: number;
  station?: string;
  facility?: string;
  facilityType?: DoorGuideFacilityType;
  egressPreference?: EgressPreference;
  message: string;
};

export type RecommendationResponse = {
  recommendationId: string;
  request: RecommendRequest;
  recommendedCar: CarComfort;
  avoidCars: CarComfort[];
  cars: CarComfort[];
  reasons: string[];
  routeChoice: RouteChoice;
  routeGuidance: RouteGuidance;
  sourceMeta: SourceMeta;
  fallbackUsed: boolean;
  safetyNotice: string;
};

export type RouteGuidanceStatus = 'direct' | 'transfer_ready' | 'needs_route' | 'limited';

export type RouteLegGuidance = {
  legNo: number;
  fromStation: string;
  toStation: string;
  line: string;
  direction?: string;
  goal: 'FINAL_EXIT' | 'NEXT_TRANSFER' | 'BOARD_AFTER_TRANSFER';
  status: 'available' | 'needs_data' | 'needs_direction' | 'needs_route';
  recommendedCarNo?: number;
  recommendedDoorNo?: number;
  anchorCarNo?: number;
  anchorDoorNo?: number;
  candidateCarNos?: number[];
  positionLabel: string;
  facility?: string;
  facilityType?: DoorGuideFacilityType;
  egressPreference?: EgressPreference;
  message: string;
};

export type RouteGuidance = {
  status: RouteGuidanceStatus;
  summary: string;
  disclaimer: string;
  legs: RouteLegGuidance[];
};

export type RoutePlanCandidateType = 'DIRECT' | 'ONE_TRANSFER' | 'USER_SPECIFIED' | 'UNRESOLVED';
export type RoutePlanCoverageStatus = 'available' | 'needs_direction' | 'needs_data' | 'not_applicable' | 'not_checked';

export type RoutePlanLeg = {
  legNo: number;
  fromStation: string;
  toStation: string;
  line: string;
  goal: 'FINAL_EXIT' | 'NEXT_TRANSFER';
  transferToLine?: string;
};

export type RoutePlanCandidate = {
  id: string;
  type: RoutePlanCandidateType;
  title: string;
  badge: string;
  summary: string;
  originStation: string;
  destinationStation: string;
  transferStations: string[];
  lines: string[];
  estimatedStationCount?: number;
  legs: RoutePlanLeg[];
  coverage: {
    nextTransferDoorGuide: RoutePlanCoverageStatus;
    finalExitDoorGuide: RoutePlanCoverageStatus;
  };
  recommendRequestPatch: {
    line: string;
    destinationLine?: string;
    transferStations?: string[];
    direction?: string;
    egressPreference?: EgressPreference;
  };
  reasonCodes: string[];
  safetyNote: string;
};

export type RoutePlanWarning = {
  code: 'UNKNOWN_ORIGIN_STATION' | 'UNKNOWN_DESTINATION_STATION' | 'UNKNOWN_TRANSFER_STATION' | 'NO_CANDIDATES' | 'STATION_ORDER_UNAVAILABLE' | 'DOOR_GUIDE_LIMITED' | 'MULTI_TRANSFER_LIMITED';
  message: string;
};

export type RoutePlansResponse = {
  candidates: RoutePlanCandidate[];
  warnings: RoutePlanWarning[];
  disclaimer: string;
};
