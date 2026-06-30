import { readFileSync } from 'node:fs';
import { COOLCAR_TIPS } from '../src/lib/tips';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const appFiles = [
  'src/app/page.tsx',
  'src/app/saved/page.tsx',
  'src/app/result/page.tsx',
  'src/app/route-plans/page.tsx',
  'src/app/settings/page.tsx',
  'src/app/login/page.tsx',
  'src/app/data-source/page.tsx',
  'src/app/tips/page.tsx',
  'src/app/tips/[slug]/page.tsx',
];

for (const file of appFiles) {
  const text = readFileSync(file, 'utf8');
  assert(text.includes('href="/tips"'), `${file} should expose the tips tab or back link`);
}

const tipsPage = readFileSync('src/app/tips/page.tsx', 'utf8');
assert(tipsPage.includes('덜 덥게'), 'tips page should keep short hot-weather copy');
assert(!tipsPage.includes('API') && !tipsPage.includes('데이터 출처'), 'tips page must not become a data/source page');
assert(COOLCAR_TIPS.length === 4, 'tips main should have four compact topic cards');
assert(COOLCAR_TIPS.every((tip) => tip.steps.length === 3), 'each tip detail should stay concise with three steps');

console.log(JSON.stringify({
  ok: true,
  tab: '팁',
  topics: COOLCAR_TIPS.map((tip) => `${tip.slug}:${tip.title}`),
}, null, 2));
