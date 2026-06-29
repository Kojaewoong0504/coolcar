import type { TossRuntimeKind, WindowLike } from './types';

export function getWindowLike(): WindowLike | undefined {
  if (typeof window === 'undefined') return undefined;
  return window as unknown as WindowLike;
}

export function detectTossRuntime(windowLike: WindowLike | undefined = getWindowLike()): TossRuntimeKind {
  if (!windowLike) return 'unknown';
  const ua = windowLike.navigator?.userAgent?.toLowerCase() ?? '';
  const hasBridge = Boolean(windowLike.TossAppsBridge || windowLike.toss);
  if (hasBridge || ua.includes('toss')) return 'toss-apps';
  return 'browser';
}
