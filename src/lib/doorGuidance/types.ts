export type DoorGuideGoal = 'FINAL_EXIT' | 'NEXT_TRANSFER';
export type DoorGuideSource =
  | 'SEOUL_OPENAPI_SAMPLE'
  | 'STATIC_CURATED'
  | 'SEOUL_OPENAPI_GET_FST_EXIT'
  | 'SEOUL_METRO_TRANSFER_CSV'
  | 'MOLIT_QUICK_TRANSFER_CSV';

export type DoorGuideRecord = {
  line: string;
  stationName: string;
  stationCode?: string;
  directionKey?: string;
  goal: DoorGuideGoal;
  targetLine?: string;
  carNo: number;
  doorNo: number;
  facility?: string;
  source: DoorGuideSource;
  confidence: 'MEDIUM' | 'LOW';
  updatedAt: string;
};

export type DoorGuideLookupInput = {
  line: string;
  toStation: string;
  direction?: string;
  goal: DoorGuideGoal;
  targetLine?: string;
};

export type DoorGuideLookupResult =
  | { status: 'available'; record: DoorGuideRecord; records?: DoorGuideRecord[] }
  | { status: 'needs_direction'; reason: string }
  | { status: 'needs_data'; reason: string }
  | { status: 'ambiguous'; reason: string };
