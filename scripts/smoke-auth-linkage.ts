export {};

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const anonymousId = process.env.SMOKE_ANON_ID;
const cookie = process.env.SMOKE_COOKIE;

async function get(path: string) {
  const res = await fetch(`${base}${path}`, { headers: cookie ? { cookie } : undefined, cache: 'no-store' });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} failed ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  if (!anonymousId) throw new Error('SMOKE_ANON_ID is required. 실제 로그인 브라우저와 같은 anonymousId를 넣어주세요.');
  const me = await get('/api/auth/me');
  if (!me.authenticated || !me.profile?.provider) throw new Error('/api/auth/me did not return an authenticated social profile. SMOKE_COOKIE or browser session is missing.');
  const diagnostics = await get(`/api/auth/linkage-diagnostics?anonymousId=${encodeURIComponent(anonymousId)}`);
  const tables = diagnostics.tables;
  const failures: string[] = [];
  for (const name of ['saved_routes', 'recommendation_events', 'feedback_events'] as const) {
    if (Number(tables?.[name]?.byAnonymousUnclaimed ?? 0) > 0) failures.push(`${name} has unclaimed anonymous rows`);
    if (Number(tables?.[name]?.byUser ?? 0) < 1) failures.push(`${name} has no user-linked rows`);
  }
  if (diagnostics.mergeAssessment?.savedRouteDefaultConflict) failures.push('saved route default conflict');
  if (diagnostics.mergeAssessment?.feedbackRecommendationOwnerMismatch) failures.push('feedback/recommendation owner mismatch');
  if (failures.length) throw new Error(failures.join('; '));
  console.log(JSON.stringify({ ok: true, provider: me.profile.provider, diagnostics: diagnostics.mergeAssessment, counts: tables }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
