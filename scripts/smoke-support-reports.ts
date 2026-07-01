import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return readFileSync(path, 'utf8');
}

const settingsPage = read('src/app/settings/page.tsx');
const resultPage = read('src/app/result/page.tsx');
const supportPage = read('src/app/support/new/page.tsx');
const supportRoute = read('src/app/api/support/reports/route.ts');
const schema = read('supabase/schema.sql');
const envExample = read('.env.example');

assert(settingsPage.includes('/support/new?from=settings'), 'settings page must link to support form');
assert(settingsPage.includes('문의 및 문제 제보'), 'settings page must show support entry copy');
assert(resultPage.includes('/support/new?from=result'), 'result page must link to support form');
assert(resultPage.includes('추천이 기대와 달랐나요?'), 'result page must show contextual support nudge');
assert(supportPage.includes('로그인하지 않아도 보낼 수 있어요.'), 'support form must allow anonymous-first reporting');
assert(supportPage.includes('현재 추천 내용을 함께 보내기'), 'support form must include result context option');
assert(supportPage.includes('메일 주소 <em>선택</em>'), 'support email must be optional');
assert(supportPage.includes('button-spinner'), 'support form must show pending state');
assert(supportRoute.includes('supportReportSchema.safeParse'), 'support API must validate input');
assert(supportRoute.includes('support_reports'), 'support API must insert support_reports');
assert(supportRoute.includes('Cache-Control'), 'support API must use no-store response headers');
assert(supportRoute.includes('allowed_mentions'), 'Discord notification must prevent mention abuse');
assert(supportRoute.includes('hashSubmitter'), 'support API must hash submitter for rate limiting');
assert(!supportRoute.includes('request.headers.entries()'), 'support API must not dump request headers');
assert(schema.includes('create table if not exists public.support_reports'), 'schema must include support_reports table');
assert(schema.includes('alter table public.support_reports enable row level security'), 'support_reports must have RLS enabled');
assert(envExample.includes('SUPPORT_REPORTS_DISCORD_WEBHOOK_URL='), 'env example must include server-only webhook env');
assert(!envExample.includes('NEXT_PUBLIC_DISCORD_WEBHOOK_URL'), 'webhook env must not be public');

const visibleSources = [settingsPage, resultPage, supportPage].join('\n');
const forbiddenVisibleCopy = ['provider', 'cache', 'quota', 'fallback', 'localStorage', 'Supabase', 'TMAP'];
for (const word of forbiddenVisibleCopy) {
  assert(!visibleSources.includes(`>${word}<`) && !visibleSources.includes(` ${word} `), `visible copy must not expose ${word}`);
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    'settings support entry',
    'result contextual report entry',
    'anonymous support form',
    'optional email',
    'server validation',
    'support_reports schema',
    'no-store API headers',
    'Discord mention safety',
    'server-only env names',
  ],
}, null, 2));
