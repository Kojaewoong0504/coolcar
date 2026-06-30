import { readFileSync } from 'fs';
import { join } from 'path';

const REPORT_PATH = join(process.cwd(), 'data/door-guidance/transfer-coverage-report.json');

type CoverageReport = {
  schemaVersion: number;
  summary: {
    totalStations: number;
    totalDirectedTransferPairs: number;
    verifiedNextTransferPairs: number;
    missingNextTransferPairs: number;
    coverageRatio: number;
    needsMasterData: number;
    finalExitStaticRecords: number;
    nextTransferStaticRecords: number;
  };
  blockers: Array<{ code: string; message: string }>;
  stations: Array<{
    stationName: string;
    priority: 'P0' | 'P1' | 'P2';
    totalPairs: number;
    verifiedNextTransferPairs: number;
    missingNextTransferPairs: number;
    coverageRatio: number;
  }>;
};

const requiredP0 = ['서울역', '강남역', '고속터미널역', '교대역', '사당역', '신도림역', '잠실역', '홍대입구역'];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main() {
  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as CoverageReport;
  assert(report.schemaVersion === 1, 'coverage report schemaVersion must be 1');
  assert(report.summary.totalStations === report.stations.length, 'station count mismatch');
  assert(report.summary.totalDirectedTransferPairs >= report.summary.verifiedNextTransferPairs, 'verified pairs exceed total pairs');
  assert(report.summary.missingNextTransferPairs === report.summary.totalDirectedTransferPairs - report.summary.verifiedNextTransferPairs, 'missing pair count mismatch');
  assert(report.summary.coverageRatio >= 0 && report.summary.coverageRatio <= 1, 'coverageRatio out of range');
  assert(report.summary.needsMasterData === 0, 'station master supplemental should resolve current major transfer gaps');
  assert(report.summary.finalExitStaticRecords >= 1, 'existing FINAL_EXIT records should remain available');

  const byStation = new Map(report.stations.map((station) => [station.stationName, station]));
  for (const stationName of requiredP0) {
    assert(byStation.has(stationName), `required P0 station missing from coverage report: ${stationName}`);
  }

  for (const station of report.stations) {
    assert(station.totalPairs === station.verifiedNextTransferPairs + station.missingNextTransferPairs, `${station.stationName}: pair count mismatch`);
    assert(station.coverageRatio >= 0 && station.coverageRatio <= 1, `${station.stationName}: coverageRatio out of range`);
  }

  if (report.summary.nextTransferStaticRecords === 0) {
    assert(report.blockers.some((blocker) => blocker.code === 'NO_VERIFIED_NEXT_TRANSFER_ANCHORS'), 'missing expected no-verified-next-transfer blocker');
  }

  console.log(JSON.stringify({
    ok: true,
    summary: report.summary,
    blockerCodes: report.blockers.map((blocker) => blocker.code),
  }, null, 2));
}

main();
