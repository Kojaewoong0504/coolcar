import { buildRoutePlanCandidates } from '../src/lib/routePlans';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNoForbiddenText(value: unknown) {
  const text = JSON.stringify(value);
  const forbidden = ['최적 환승', '가장 빠른 환승', '공식 환승', '무조건 여기', 'fallback', 'provider', 'adapter', 'confidence'];
  for (const word of forbidden) {
    assert(!text.includes(word), `consumer-facing route plan text must not include forbidden word: ${word}`);
  }
}

async function main() {
  const guroToOlympic = await buildRoutePlanCandidates({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '올림픽공원역',
    destinationLine: '9호선',
    comfortType: 'HOT_SENSITIVE',
    maxCandidates: 4,
  });

  assert(guroToOlympic.candidates.length >= 2, '구로디지털단지역→올림픽공원역은 실제 환승 후보를 보여줘야 합니다.');
  assert(guroToOlympic.candidates.some((candidate) => candidate.type === 'ONE_TRANSFER'), '1회 환승 후보가 있어야 합니다.');
  const dangsanCandidate = guroToOlympic.candidates.find((candidate) => candidate.transferStations[0] === '당산역');
  assert(dangsanCandidate, '당산역 환승 후보가 있어야 합니다.');
  assert(dangsanCandidate.coverage.nextTransferDoorGuide === 'available', '당산 환승은 자동 방면 추론으로 환승 위치 반영이 가능해야 합니다.');
  assert(dangsanCandidate.recommendRequestPatch.direction === '합정', '구로디지털단지→당산 진행 방향은 합정 기준으로 자동 추론되어야 합니다.');
  const sportsCandidate = guroToOlympic.candidates.find((candidate) => candidate.transferStations[0] === '종합운동장역');
  assert(sportsCandidate, '종합운동장역 환승 후보가 있어야 합니다.');
  assert(sportsCandidate.coverage.nextTransferDoorGuide === 'available', '종합운동장 2호선→9호선 환승은 자동 방면 추론으로 환승 위치 반영이 가능해야 합니다.');
  assert(sportsCandidate.recommendRequestPatch.direction === '잠실새내', '구로디지털단지→종합운동장 진행 방향은 잠실새내 기준으로 자동 추론되어야 합니다.');
  assert(!guroToOlympic.candidates.some((candidate) => candidate.type === 'UNRESOLVED'), '실제 환승 후보가 있으면 경로 미확정 후보를 노출하지 않습니다.');
  assert(guroToOlympic.candidates.every((candidate) => candidate.originStation === '구로디지털단지역'), '출발역이 보존되어야 합니다.');
  assert(guroToOlympic.candidates.every((candidate) => candidate.destinationStation === '올림픽공원역'), '도착역이 보존되어야 합니다.');
  assert(guroToOlympic.candidates.every((candidate) => candidate.type === 'UNRESOLVED' || candidate.transferStations.length > 0), '환승 후보는 환승역을 포함해야 합니다.');
  assertNoForbiddenText(guroToOlympic);

  const manual = await buildRoutePlanCandidates({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '올림픽공원역',
    destinationLine: '9호선',
    transferStations: ['당산역'],
    maxCandidates: 3,
  });
  const manualCandidate = manual.candidates.find((candidate) => candidate.type === 'USER_SPECIFIED');
  assert(manualCandidate, '직접 입력한 환승역 후보가 생성되어야 합니다.');
  assert(manualCandidate.transferStations[0] === '당산역', '직접 입력 환승역이 보존되어야 합니다.');
  assert(manualCandidate.recommendRequestPatch.transferStations?.[0] === '당산역', '추천 요청 패치에 직접 환승역이 들어가야 합니다.');
  assert(manualCandidate.legs.length === 2, '직접 1회 환승은 2개 구간이어야 합니다.');
  assertNoForbiddenText(manual);

  const baebangToGuroDigital = await buildRoutePlanCandidates({
    line: '1호선',
    originStation: '배방역',
    destinationStation: '구로디지털단지역',
    destinationLine: '2호선',
    comfortType: 'HOT_SENSITIVE',
    maxCandidates: 4,
  });
  assert(baebangToGuroDigital.candidates[0]?.transferStations[0] === '신도림역', `배방역→구로디지털단지역의 1호선→2호선 대표 경로는 신도림 환승이어야 합니다. got=${baebangToGuroDigital.candidates[0]?.transferStations[0]}`);
  const cityHallDetour = baebangToGuroDigital.candidates.find((candidate) => candidate.transferStations[0] === '시청역');
  assert(cityHallDetour, '시청 환승 후보는 다른 경로로만 내려가야 합니다.');
  assert((baebangToGuroDigital.candidates[0]?.estimatedStationCount ?? 999) < (cityHallDetour.estimatedStationCount ?? 0), '대표 경로는 역 수 기준으로 더 짧은 후보여야 합니다.');
  assertNoForbiddenText(baebangToGuroDigital);

  const guroToDaehwa = await buildRoutePlanCandidates({
    line: '2호선',
    originStation: '구로디지털단지역',
    destinationStation: '대화역',
    destinationLine: '3호선',
    comfortType: 'HOT_SENSITIVE',
    maxCandidates: 6,
  });
  const gyeonguiCandidate = guroToDaehwa.candidates.find((candidate) =>
    candidate.type === 'TWO_TRANSFER'
    && candidate.lines.join('>') === '2호선>경의중앙선>3호선'
    && candidate.transferStations.join('>') === '홍대입구역>대곡역',
  );
  assert(gyeonguiCandidate, '구로디지털단지역→대화역은 홍대입구역→대곡역 2회 환승 후보를 포함해야 합니다.');
  const sixLineCandidate = guroToDaehwa.candidates.find((candidate) =>
    candidate.type === 'TWO_TRANSFER'
    && candidate.lines.join('>') === '2호선>6호선>3호선'
    && candidate.transferStations[0] === '합정역'
    && ['연신내역', '불광역', '약수역'].includes(candidate.transferStations[1]),
  );
  assert(sixLineCandidate, '구로디지털단지역→대화역은 합정역→6호선→3호선 2회 환승 후보를 포함해야 합니다.');
  assert(guroToDaehwa.candidates.some((candidate) => candidate.type === 'TWO_TRANSFER'), '대화역 경로에는 2회 환승 후보가 있어야 합니다.');
  assert(guroToDaehwa.candidates[0]?.type === 'TWO_TRANSFER', `긴 1회 환승보다 역 수가 짧은 2회 환승 후보를 먼저 보여줘야 합니다. got=${guroToDaehwa.candidates[0]?.title}`);
  assert(gyeonguiCandidate.recommendRequestPatch.routeLines?.join('>') === '2호선>경의중앙선>3호선', '2회 환승 후보는 추천 요청에 routeLines를 보존해야 합니다.');
  assertNoForbiddenText(guroToDaehwa);

  const direct = await buildRoutePlanCandidates({
    line: '2호선',
    originStation: '역삼역',
    destinationStation: '강남역',
    destinationLine: '2호선',
    maxCandidates: 3,
  });
  assert(direct.candidates.some((candidate) => candidate.type === 'DIRECT'), '같은 노선은 direct 후보가 있어야 합니다.');
  const directCandidate = direct.candidates.find((candidate) => candidate.type === 'DIRECT');
  assert(directCandidate?.transferStations.length === 0, 'direct 후보는 환승역이 없어야 합니다.');
  assertNoForbiddenText(direct);

  const directionAware = await buildRoutePlanCandidates({
    line: '2호선',
    originStation: '역삼역',
    destinationStation: '판교역',
    destinationLine: '신분당선',
    transferStations: ['강남역'],
    direction: '교대',
    maxCandidates: 3,
  });
  const directionCandidate = directionAware.candidates.find((candidate) => candidate.type === 'USER_SPECIFIED');
  assert(directionCandidate, '방면을 넣은 직접 환승 후보가 생성되어야 합니다.');
  assert(directionCandidate.recommendRequestPatch.direction === '교대', '방면 입력은 추천 요청 패치에 보존되어야 합니다.');
  assert(directionCandidate.coverage.nextTransferDoorGuide === 'available', '검증된 강남역 교대 방면 환승은 위치 안내 가능해야 합니다.');
  assertNoForbiddenText(directionAware);

  console.log(JSON.stringify({
    ok: true,
    guroToOlympic: guroToOlympic.candidates.map((candidate) => ({ type: candidate.type, title: candidate.title, transfers: candidate.transferStations, lines: candidate.lines })),
    baebangToGuroDigital: baebangToGuroDigital.candidates.map((candidate) => ({ title: candidate.title, transfers: candidate.transferStations, distance: candidate.estimatedStationCount })),
    guroToDaehwa: guroToDaehwa.candidates.map((candidate) => ({ type: candidate.type, title: candidate.title, transfers: candidate.transferStations, lines: candidate.lines, distance: candidate.estimatedStationCount })),
    manual: { type: manualCandidate.type, transfers: manualCandidate.transferStations, lines: manualCandidate.lines },
    direct: { type: directCandidate?.type, lines: directCandidate?.lines },
    directionAware: { type: directionCandidate.type, direction: directionCandidate.recommendRequestPatch.direction, coverage: directionCandidate.coverage.nextTransferDoorGuide },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
