import verifiedNextTransferGuides from '../../../data/door-guidance/verified-next-transfer-guides.json';
import { normalizeDirection, parseCarDoor } from './normalize';
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
    source: 'SEOUL_OPENAPI_SAMPLE' as const,
    confidence: 'LOW' as const,
    updatedAt: row.crtrYmd,
  }];
});

// Verified public transfer anchors generated from:
// - 서울교통공사_서울 도시철도 환승정보 (서울 열린데이터광장 OA-22521)
// - 국토교통부_철도역 빠른 환승 정보 (data.go.kr 15151816)
// Generation policy: only public/official records with valid 1~12 car and 1~4 door values;
// ambiguous same-key car/door conflicts are excluded from the generated JSON.
const VERIFIED_NEXT_TRANSFER_GUIDES = verifiedNextTransferGuides.records as DoorGuideRecord[];

export const STATIC_DOOR_GUIDES: DoorGuideRecord[] = [
  ...FINAL_EXIT_GUIDES,
  ...VERIFIED_NEXT_TRANSFER_GUIDES,
];
