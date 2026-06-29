import { fetchPublicDoorGuideRecords, rowToDoorGuideRecord } from '../src/lib/doorGuidance/publicAdapter';
import { resolveDoorGuideRecords } from '../src/lib/doorGuidance/resolver';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function mockFetch(payload: unknown, ok = true) {
  return (async () => ({ ok, json: async () => payload })) as unknown as typeof fetch;
}

async function main() {
  const originalKey = process.env.SEOUL_OPENAPI_KEY;
  try {
    delete process.env.SEOUL_OPENAPI_KEY;
    const disabled = await fetchPublicDoorGuideRecords({ line: '1호선', toStation: '서울역', direction: '시청', goal: 'FINAL_EXIT' }, mockFetch({ getFstExit: { row: [] } }));
    assert(disabled.length === 0, 'env key missing should disable public fetch records');

    process.env.SEOUL_OPENAPI_KEY = 'sample';
    const payload = {
      getFstExit: {
        row: [
          { lineNm: '1호선', stnCd: '0150', stnNm: '서울역', crtrYmd: '20241231', drtnInfo: '시청', qckgffVhclDoorNo: '9-3', plfmCmgFac: '에스컬레이터' },
          { lineNm: '1호선', stnCd: '0150', stnNm: '서울역', crtrYmd: '20241231', drtnInfo: '시청', qckgffVhclDoorNo: '13-1', plfmCmgFac: '계단' },
          { lineNm: '2호선', stnCd: '0222', stnNm: '강남역', crtrYmd: '20241231', drtnInfo: '내선', qckgffVhclDoorNo: '2-2', plfmCmgFac: '계단' },
        ],
      },
    };
    const records = await fetchPublicDoorGuideRecords({ line: '1호선', toStation: '서울역', direction: '시청', goal: 'FINAL_EXIT' }, mockFetch(payload));
    assert(records.length === 1, 'only valid matching API row should be accepted');
    assert(records[0].carNo === 9 && records[0].doorNo === 3, 'API row should parse 9-3');
    assert(records[0].source === 'SEOUL_OPENAPI_GET_FST_EXIT', 'API source should be preserved');

    const resolved = resolveDoorGuideRecords({ line: '1호선', toStation: '서울역', direction: '시청', goal: 'FINAL_EXIT' }, records);
    assert(resolved.status === 'available', 'valid API records should resolve available');
    assert(resolved.record.carNo === 9 && resolved.record.doorNo === 3, 'resolved record should keep API door');

    const noDirection = resolveDoorGuideRecords({ line: '1호선', toStation: '서울역', goal: 'FINAL_EXIT' }, records);
    assert(noDirection.status === 'needs_direction', 'directional API rows without direction should need direction');

    const malformed = await fetchPublicDoorGuideRecords({ line: '1호선', toStation: '서울역', direction: '시청', goal: 'FINAL_EXIT' }, mockFetch({ foo: 'bar' }));
    assert(malformed.length === 0, 'malformed response should return no records');

    const nonFinal = rowToDoorGuideRecord({ lineNm: '1호선', stnNm: '서울역', qckgffVhclDoorNo: '9-3' }, { line: '1호선', toStation: '서울역', goal: 'NEXT_TRANSFER' });
    assert(nonFinal === undefined, 'public getFstExit should not be used for NEXT_TRANSFER');

    console.log(JSON.stringify({ ok: true, publicAdapter: { accepted: records.length, carNo: records[0].carNo, doorNo: records[0].doorNo } }, null, 2));
  } finally {
    if (originalKey === undefined) delete process.env.SEOUL_OPENAPI_KEY;
    else process.env.SEOUL_OPENAPI_KEY = originalKey;
  }

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
