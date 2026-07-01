import { fetchSeoulRealtimeArrivals } from '../src/lib/seoulRealtimeSubway';

async function main() {
  const stationName = process.argv[2] ?? '서울역';
  const result = await fetchSeoulRealtimeArrivals({
    stationName,
    startIndex: 0,
    endIndex: 5,
    enabledOverride: true,
  });

  if (result.status !== 'available') {
    console.log(JSON.stringify({ ok: false, stationName, status: result.status, reason: result.reason }, null, 2));
    process.exit(result.status === 'needs_key' ? 2 : 1);
  }

  console.log(JSON.stringify({
    ok: true,
    stationName,
    totalCount: result.totalCount,
    arrivals: result.arrivals.slice(0, 5).map((arrival) => ({
      lineName: arrival.lineName,
      subwayId: arrival.subwayId,
      updnLine: arrival.updnLine,
      trainLineNm: arrival.trainLineNm,
      statnNm: arrival.statnNm,
      barvlDt: arrival.barvlDt,
      btrainNo: arrival.btrainNo,
      bstatnNm: arrival.bstatnNm,
      recptnDt: arrival.recptnDt,
      arvlMsg2: arrival.arvlMsg2,
      arvlStatusLabel: arrival.arvlStatusLabel,
      lstcarAt: arrival.lstcarAt,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
