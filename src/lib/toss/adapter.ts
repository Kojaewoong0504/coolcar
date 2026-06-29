import { BrowserFallbackAdapter } from './noop-adapter';
import { detectTossRuntime, getWindowLike } from './runtime';
import { TossAppsAdapter } from './toss-apps-adapter';
import type { TossInAppAdapter, WindowLike } from './types';

export function createTossAdapter(options: { windowLike?: WindowLike } = {}): TossInAppAdapter {
  const windowLike = options.windowLike ?? getWindowLike();
  const runtime = detectTossRuntime(windowLike);
  if (runtime === 'toss-apps') return new TossAppsAdapter(windowLike);
  return new BrowserFallbackAdapter(windowLike);
}
