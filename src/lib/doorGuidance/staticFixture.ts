import verifiedFinalExitGuides from '../../../data/door-guidance/verified-final-exit-guides.json';
import verifiedNextTransferGuides from '../../../data/door-guidance/verified-next-transfer-guides.json';
import { normalizeDirection, normalizeFacilityType, parseCarDoor } from './normalize';
import type { DoorGuideRecord } from './types';

type SeoulOpenApiSampleRow = {
  lineNm: string;
  stnCd: string;
  stnNm: string;
  crtrYmd: string;
  drtnInfo: string;
  qckgffVhclDoorNo: string;
  plfmCmgFac?: string;
  facPstnNm?: string;
};

// Verified via Seoul Open Data Plaza sample endpoint:
// http://openapi.seoul.go.kr:8088/sample/json/getFstExit/1/5/
// Dataset: 서울시 교통공사 지하철역 빠른하차정보 현황, service getFstExit.
// Keep this list deliberately small. Do not add guessed records.
const SEOUL_OPENAPI_SAMPLE_ROWS: SeoulOpenApiSampleRow[] = [
  {
    lineNm: '1호선',
    stnCd: '0150',
    stnNm: '서울역',
    crtrYmd: '20241231',
    drtnInfo: '남영',
    qckgffVhclDoorNo: '2-3',
    plfmCmgFac: '에스컬레이터',
    facPstnNm: '남영 방면2-3, 시청 방면9-2',
  },
  {
    lineNm: '1호선',
    stnCd: '0150',
    stnNm: '서울역',
    crtrYmd: '20241231',
    drtnInfo: '시청',
    qckgffVhclDoorNo: '9-3',
    plfmCmgFac: '에스컬레이터',
    facPstnNm: '시청 방면9-3, 남영 방면2-2',
  },
  {
    lineNm: '1호선',
    stnCd: '0150',
    stnNm: '서울역',
    crtrYmd: '20241231',
    drtnInfo: '남영',
    qckgffVhclDoorNo: '4-4',
    plfmCmgFac: '엘리베이터',
    facPstnNm: '시청 방면5-1, 남영 방면4-4',
  },
  {
    lineNm: '1호선',
    stnCd: '0150',
    stnNm: '서울역',
    crtrYmd: '20241231',
    drtnInfo: '남영',
    qckgffVhclDoorNo: '10-4',
    plfmCmgFac: '계단',
  },
];

const FINAL_EXIT_GUIDES: DoorGuideRecord[] = SEOUL_OPENAPI_SAMPLE_ROWS.flatMap((row) => {
  const parsed = parseCarDoor(row.qckgffVhclDoorNo);
  if (!parsed) return [];
  return [{
    line: row.lineNm,
    stationName: row.stnNm,
    stationCode: row.stnCd,
    directionKey: normalizeDirection(row.drtnInfo),
    goal: 'FINAL_EXIT' as const,
    carNo: parsed.carNo,
    doorNo: parsed.doorNo,
    facility: row.plfmCmgFac || undefined,
    facilityType: normalizeFacilityType(row.plfmCmgFac),
    source: 'SEOUL_OPENAPI_SAMPLE' as const,
    confidence: 'LOW' as const,
    updatedAt: row.crtrYmd,
  }];
});

// Verified public final-exit records generated from Seoul OpenAPI getFstExit.
// Generation policy: only public rows with valid car-door values; direction-specific data still requires
// a matching/inferred direction before precise door guidance is exposed.
const GENERATED_FINAL_EXIT_GUIDES = verifiedFinalExitGuides.records as DoorGuideRecord[];

// Verified public transfer anchors generated from:
// - 서울교통공사_서울 도시철도 환승정보 (서울 열린데이터광장 OA-22521)
// - 국토교통부_철도역 빠른 환승 정보 (data.go.kr 15151816)
// Generation policy: only public/official records with valid 1~12 car and 1~4 door values;
// ambiguous same-key car/door conflicts are excluded from the generated JSON.
const GENERATED_NEXT_TRANSFER_GUIDES = verifiedNextTransferGuides.records as DoorGuideRecord[];

const SUPPRESSED_CONFLICTING_RECORD_IDS = new Set([
  'SEOUL_METRO_TRANSFER_CSV:124',
  'SEOUL_METRO_TRANSFER_CSV:126',
  'SEOUL_METRO_TRANSFER_CSV:129',
  'SEOUL_METRO_TRANSFER_CSV:130',
  'MOLIT_QUICK_TRANSFER_CSV:654',
  'MOLIT_QUICK_TRANSFER_CSV:657',
  'MOLIT_QUICK_TRANSFER_CSV:659',
]);

const VERIFIED_NEXT_TRANSFER_GUIDES = GENERATED_NEXT_TRANSFER_GUIDES.filter((record) => {
  const sourceId = 'sourceId' in record ? String((record as DoorGuideRecord & { sourceId?: string }).sourceId ?? '') : '';
  return !SUPPRESSED_CONFLICTING_RECORD_IDS.has(`${record.source}:${sourceId}`);
});

// Official quick-transfer records from 국토교통부_철도역 빠른 환승 정보_20250923
// (data.go.kr 15151816). The generated JSON predates/omits 대곡역 경의중앙선→3호선,
// so keep these auditable static records instead of falling back to comfort-only.
const MOLIT_DAEGOK_NEXT_TRANSFER_GUIDES: DoorGuideRecord[] = [
  {
    line: '경의중앙선',
    stationName: '대곡역',
    directionKey: normalizeDirection('문산'),
    goal: 'NEXT_TRANSFER',
    targetLine: '3호선',
    carNo: 4,
    doorNo: 2,
    facility: '환승통로',
    source: 'MOLIT_QUICK_TRANSFER_CSV',
    confidence: 'MEDIUM',
    updatedAt: '2025-09-23',
  },
  {
    line: '경의중앙선',
    stationName: '대곡역',
    directionKey: normalizeDirection('용산'),
    goal: 'NEXT_TRANSFER',
    targetLine: '3호선',
    carNo: 5,
    doorNo: 3,
    facility: '환승통로',
    source: 'MOLIT_QUICK_TRANSFER_CSV',
    confidence: 'MEDIUM',
    updatedAt: '2025-09-23',
  },
];

// Field-verified override after user report: official/public Hongdae 2호선→공항철도 rows are
// directionally inconsistent with observed platform stairs. Keep them suppressed above and expose
// these separately so the conflict is auditable instead of silently pretending the generated source is correct.
const FIELD_VERIFIED_NEXT_TRANSFER_GUIDES: DoorGuideRecord[] = [
  {
    line: '2호선',
    stationName: '홍대입구역',
    stationCode: '0239',
    directionKey: normalizeDirection('신촌'),
    goal: 'NEXT_TRANSFER',
    targetLine: '공항철도',
    carNo: 7,
    doorNo: 2,
    facility: '환승통로',
    source: 'STATIC_CURATED',
    confidence: 'MEDIUM',
    updatedAt: '2026-06-30',
  },
  {
    line: '2호선',
    stationName: '홍대입구역',
    stationCode: '0239',
    directionKey: normalizeDirection('신촌'),
    goal: 'NEXT_TRANSFER',
    targetLine: '공항철도',
    carNo: 9,
    doorNo: 2,
    facility: '환승통로',
    source: 'STATIC_CURATED',
    confidence: 'MEDIUM',
    updatedAt: '2026-06-30',
  },
  {
    line: '2호선',
    stationName: '홍대입구역',
    stationCode: '0239',
    directionKey: normalizeDirection('합정'),
    goal: 'NEXT_TRANSFER',
    targetLine: '공항철도',
    carNo: 2,
    doorNo: 2,
    facility: '환승통로',
    source: 'STATIC_CURATED',
    confidence: 'MEDIUM',
    updatedAt: '2026-06-30',
  },
  {
    line: '2호선',
    stationName: '홍대입구역',
    stationCode: '0239',
    directionKey: normalizeDirection('합정'),
    goal: 'NEXT_TRANSFER',
    targetLine: '공항철도',
    carNo: 4,
    doorNo: 2,
    facility: '환승통로',
    source: 'STATIC_CURATED',
    confidence: 'MEDIUM',
    updatedAt: '2026-06-30',
  },
  // Field-verified override after user report: public Hongdae 2호선→경의중앙선 rows pointed
  // Shinchon-side trains to 3-3, which led the app to recommend the 2~4 car window. The
  // field/user-verified Shinchon-side transfer doors are 7-2 and 9-2, so keep the stale public
  // rows suppressed and expose these auditable replacements instead.
  {
    line: '2호선',
    stationName: '홍대입구역',
    stationCode: '0239',
    directionKey: normalizeDirection('신촌'),
    goal: 'NEXT_TRANSFER',
    targetLine: '경의중앙선',
    carNo: 7,
    doorNo: 2,
    facility: '환승통로',
    source: 'STATIC_CURATED',
    confidence: 'MEDIUM',
    updatedAt: '2026-07-01',
  },
  {
    line: '2호선',
    stationName: '홍대입구역',
    stationCode: '0239',
    directionKey: normalizeDirection('신촌'),
    goal: 'NEXT_TRANSFER',
    targetLine: '경의중앙선',
    carNo: 9,
    doorNo: 2,
    facility: '환승통로',
    source: 'STATIC_CURATED',
    confidence: 'MEDIUM',
    updatedAt: '2026-07-01',
  },
];

function withFacilityType(record: DoorGuideRecord): DoorGuideRecord {
  return { ...record, facilityType: record.facilityType ?? normalizeFacilityType(record.facility) };
}

export const STATIC_DOOR_GUIDES: DoorGuideRecord[] = [
  ...GENERATED_FINAL_EXIT_GUIDES,
  ...FINAL_EXIT_GUIDES,
  ...VERIFIED_NEXT_TRANSFER_GUIDES,
  ...MOLIT_DAEGOK_NEXT_TRANSFER_GUIDES,
  ...FIELD_VERIFIED_NEXT_TRANSFER_GUIDES,
].map(withFacilityType);
