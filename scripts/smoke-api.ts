const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const anonymousId = crypto.randomUUID();

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} failed ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const normal = await post('/api/recommend', { anonymousId, line: '2호선', originStation: '강남역', destinationStation: '홍대입구역', direction: '내선', comfortType: 'HOT_SENSITIVE', waitToleranceMin: 3, avoidPrioritySeatArea: true });
  if (!normal.recommendedCar?.carNo || !normal.sourceMeta?.sourceType) throw new Error('normal recommendation schema mismatch');
  if (!normal.persisted) throw new Error('recommendation event was not persisted');
  const estimated = await post('/api/recommend', { anonymousId, line: '수인분당선', originStation: '선릉역', destinationStation: '왕십리역', direction: '왕십리행', comfortType: 'CROWD_AVOIDER' });
  if (estimated.sourceMeta.sourceType !== 'ESTIMATED' || estimated.sourceMeta.confidence !== 'LOW') throw new Error('suinbundang fallback must be estimated/low confidence');
  const feedback = await post('/api/feedback', { anonymousId, recommendationId: normal.recommendationId, line: '2호선', station: '강남역', direction: '내선', carNo: normal.recommendedCar.carNo, feedbackType: 'GOOD', crowdingFeel: 'LOW' });
  if (!feedback.ok || !feedback.recommendationLinked) throw new Error('feedback did not link recommendation event');
  const saved = await post('/api/routes/saved', { anonymousId, line: '2호선', originStation: '강남역', destinationStation: '홍대입구역', direction: '내선', comfortType: 'HOT_SENSITIVE', label: '스모크 테스트 경로' });
  if (!saved.ok || !saved.route?.id) throw new Error('saved route did not persist');
  const routes = await fetch(`${base}/api/routes/saved?anonymousId=${anonymousId}`).then((r) => r.json());
  if (!routes.routes?.length) throw new Error('saved route list is empty');
  const stations = await fetch(`${base}/api/stations/search?q=${encodeURIComponent('강남')}`).then((r) => r.json());
  if (!stations.stations?.some((s: { line: string }) => s.line === '2호선')) throw new Error('station search missing 강남 2호선');
  console.log(JSON.stringify({ ok: true, normal: normal.recommendedCar.label, source: normal.sourceMeta.sourceType, fallbackUsed: normal.fallbackUsed, estimatedSource: estimated.sourceMeta.sourceType, feedbackPersisted: feedback.persisted, recommendationLinked: feedback.recommendationLinked, savedRoutes: routes.routes.length, stationCount: stations.stations.length }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
