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

export const STATIC_DOOR_GUIDES: DoorGuideRecord[] = SEOUL_OPENAPI_SAMPLE_ROWS.flatMap((row) => {
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
