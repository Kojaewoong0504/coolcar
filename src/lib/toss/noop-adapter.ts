import type { SafeAreaInsets, SharePayload, TossInAppAdapter, WindowLike } from './types';

const zeroInsets: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export class BrowserFallbackAdapter implements TossInAppAdapter {
  runtime = 'browser' as const;
  constructor(private readonly windowLike?: WindowLike) {}

  isAvailable() {
    return false;
  }

  getSafeAreaInsets() {
    return zeroInsets;
  }

  async openExternalUrl(url: string) {
    if (!this.windowLike) return;
    if (this.windowLike.open) {
      this.windowLike.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (this.windowLike.location?.assign) this.windowLike.location.assign(url);
    else if (this.windowLike.location) this.windowLike.location.href = url;
  }

  async share(payload: SharePayload) {
    if (this.windowLike?.navigator?.share) return this.windowLike.navigator.share(payload);
    if (payload.url) return this.openExternalUrl(payload.url);
  }
}
