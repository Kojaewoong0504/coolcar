# Toss 인앱 Adapter 설계 초안

## 목표

시원칸은 Vercel 웹/PWA를 먼저 출시하고, Toss Apps in Toss에는 같은 제품 코드를 얹는다. 앱 컴포넌트가 Toss SDK를 직접 import하지 않도록 `TossInAppAdapter` 경계를 먼저 둔다.

## 원칙

1. 일반 브라우저와 Toss 인앱 모두 같은 UI/API를 사용한다.
2. Toss SDK 미설치 상태에서도 `typecheck`와 `build`가 통과해야 한다.
3. Toss 전용 기능은 optional capability로만 호출한다.
4. SSR 중 `window` 접근으로 크래시가 나면 안 된다.
5. 로그인/JWT/refresh token은 계속 Supabase Auth가 담당한다. Toss adapter는 런타임 기능만 담당한다.

## 파일 구조

```txt
src/lib/toss/types.ts             # 공통 타입/인터페이스
src/lib/toss/runtime.ts           # Toss/browser runtime 감지
src/lib/toss/noop-adapter.ts      # 일반 브라우저 fallback
src/lib/toss/toss-apps-adapter.ts # Toss Apps skeleton
src/lib/toss/adapter.ts           # factory
src/lib/toss/index.ts             # public export
scripts/smoke-toss-adapter.ts     # SSR/fallback smoke
```

## Adapter boundary

```ts
interface TossInAppAdapter {
  runtime: 'toss-apps' | 'browser' | 'unknown';
  isAvailable(): boolean;
  getSafeAreaInsets(): SafeAreaInsets;
  openExternalUrl(url: string): Promise<void>;
  share?(payload: SharePayload): Promise<void>;
  closeWebView?(): Promise<void>;
  haptic?(): Promise<void>;
}
```

## 다음 단계

1. Toss Apps SDK 공식 요구사항 확정
2. `TossAppsAdapter` 내부만 SDK 호출로 교체
3. safe-area 값을 CSS variable로 연결
4. Toss 인앱 OAuth redirect URL 추가 검토
5. 실제 Toss 심사 기준에 맞춰 개인정보/권한 문구 정리
