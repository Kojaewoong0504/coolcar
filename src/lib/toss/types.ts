export type TossRuntimeKind = 'toss-apps' | 'browser' | 'unknown';

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type SharePayload = {
  title: string;
  text?: string;
  url?: string;
};

export type WindowLike = {
  navigator?: { userAgent?: string; share?: (payload: SharePayload) => Promise<void> };
  location?: { href: string; assign?: (url: string) => void };
  open?: (url: string, target?: string, features?: string) => unknown;
  TossAppsBridge?: unknown;
  toss?: unknown;
};

export interface TossInAppAdapter {
  runtime: TossRuntimeKind;
  isAvailable(): boolean;
  getSafeAreaInsets(): SafeAreaInsets;
  openExternalUrl(url: string): Promise<void>;
  share?(payload: SharePayload): Promise<void>;
  closeWebView?(): Promise<void>;
  haptic?(): Promise<void>;
}
