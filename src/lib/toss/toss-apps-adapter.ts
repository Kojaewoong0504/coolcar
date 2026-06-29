import type { SafeAreaInsets, SharePayload, TossInAppAdapter, WindowLike } from './types';

const zeroInsets: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export class TossAppsAdapter implements TossInAppAdapter {
  runtime = 'toss-apps' as const;
  constructor(private readonly windowLike?: WindowLike) {}

  isAvailable() {
    return true;
  }

  getSafeAreaInsets() {
    // Toss SDK 도입 전 skeleton: 실제 safe-area bridge가 연결되면 여기만 교체한다.
    return zeroInsets;
  }

  async openExternalUrl(url: string) {
    // TODO: Toss Apps SDK 외부 브라우저 열기 API로 교체.
    if (this.windowLike?.open) {
      this.windowLike.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (this.windowLike?.location?.assign) this.windowLike.location.assign(url);
  }

  async share(payload: SharePayload) {
    // TODO: Toss share capability가 확정되면 bridge 호출로 교체.
    if (this.windowLike?.navigator?.share) return this.windowLike.navigator.share(payload);
    if (payload.url) return this.openExternalUrl(payload.url);
  }

  async closeWebView() {
    // SDK 미연결 상태에서는 조용히 no-op. 앱 호출부는 optional capability로 다룬다.
  }

  async haptic() {
    // SDK 미연결 상태에서는 조용히 no-op.
  }
}
