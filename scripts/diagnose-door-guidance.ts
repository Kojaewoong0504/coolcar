import { isPublicDoorGuideEnabled } from '../src/lib/doorGuidance/config';
import { lookupDoorGuide } from '../src/lib/doorGuidance/resolver';

async function main() {
  const enabled = isPublicDoorGuideEnabled();
  const result = await lookupDoorGuide({ line: '1호선', toStation: '서울역', direction: '시청', goal: 'FINAL_EXIT' });
  const safe = result.status === 'available'
    ? { status: result.status, carNo: result.record.carNo, doorNo: result.record.doorNo, source: result.record.source }
    : { status: result.status };
  console.log(JSON.stringify({
    ok: true,
    publicDoorGuideEnabled: enabled,
    keyPrinted: false,
    seoulStationProbe: safe,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
