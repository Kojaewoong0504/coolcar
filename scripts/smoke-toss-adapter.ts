export {};

import { createTossAdapter, detectTossRuntime } from '../src/lib/toss';

async function main() {
  const ssr = createTossAdapter({ windowLike: undefined });
  if (ssr.runtime !== 'browser') throw new Error(`SSR fallback runtime mismatch: ${ssr.runtime}`);

  const browser = createTossAdapter({ windowLike: { navigator: { userAgent: 'Mozilla/5.0 Chrome' } } });
  if (browser.runtime !== 'browser') throw new Error(`browser runtime mismatch: ${browser.runtime}`);

  const toss = createTossAdapter({ windowLike: { navigator: { userAgent: 'Toss/1.0' }, TossAppsBridge: {} } });
  if (toss.runtime !== 'toss-apps') throw new Error(`toss runtime mismatch: ${toss.runtime}`);
  if (!toss.isAvailable()) throw new Error('toss adapter should be available');
  if (detectTossRuntime(undefined) !== 'unknown') throw new Error('undefined runtime should be unknown');

  await toss.share?.({ title: '시원칸 CoolCar', url: '/' });
  console.log(JSON.stringify({ ok: true, ssr: ssr.runtime, browser: browser.runtime, toss: toss.runtime }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
