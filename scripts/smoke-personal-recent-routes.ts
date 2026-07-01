import { readFileSync } from 'node:fs';

const home = readFileSync('src/app/page.tsx', 'utf8');
const forbiddenPublicRoutes = ['구로디지털단지', '올림픽공원', '홍대입구', '인천공항'];

for (const routeName of forbiddenPublicRoutes) {
  if (home.includes(routeName)) {
    throw new Error(`Home page must not ship public/demo recent route: ${routeName}`);
  }
}

if (!home.includes("window.sessionStorage.getItem('coolcar_last_result')")) {
  throw new Error('Recent routes should come from per-browser sessionStorage last result.');
}

if (!home.includes('recentRoutes.length > 0 &&')) {
  throw new Error('Recent routes card should be hidden when there is no personal recent route.');
}

if (!home.includes('이 기기에서 방금 본 경로만')) {
  throw new Error('Recent routes copy should clarify device/session-local scope.');
}

console.log('personal recent routes smoke: ok');
