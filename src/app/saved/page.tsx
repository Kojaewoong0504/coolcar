'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthMergeOnLoad } from '@/components/auth/AuthMergeOnLoad';
import { UserProfilePill } from '@/components/auth/UserProfilePill';
import type { NormalizedAuthProfile } from '@/lib/auth/profile';

type SavedRoute = {
  id: string;
  label: string | null;
  origin_station: string;
  destination_station: string | null;
  line: string;
  direction: string | null;
  comfort_type: string | null;
  commute_type: string | null;
  is_default: boolean;
};

type AuthMe = { authenticated: boolean; profile: NormalizedAuthProfile | null };

const comfortLabels: Record<string, string> = {
  HOT_SENSITIVE: '더위형',
  COLD_SENSITIVE: '추위형',
  CROWD_AVOIDER: '혼잡회피',
  BALANCED: '밸런스',
};

function getAnonymousId() {
  if (typeof window === 'undefined') return undefined;
  const key = 'coolcar_anonymous_id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

function comfortLabel(value?: string | null) {
  return comfortLabels[value ?? 'BALANCED'] ?? '밸런스';
}

function routeTitle(route: SavedRoute) {
  return `${route.origin_station} → ${route.destination_station ?? '목적지'}`;
}

export default function SavedPage() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwaNoticeHidden, setPwaNoticeHidden] = useState(false);
  const isLoggedIn = Boolean(auth?.authenticated && auth.profile);
  const firstName = auth?.profile?.displayName?.split(' ')[0] ?? '나';

  useEffect(() => {
    const anonymousId = getAnonymousId();
    Promise.all([
      fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ authenticated: false, profile: null })),
      fetch(`/api/routes/saved?anonymousId=${anonymousId}`).then((r) => r.json()),
    ])
      .then(([authPayload, routesPayload]) => {
        setAuth(authPayload as AuthMe);
        setRoutes(routesPayload.routes ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPwaNoticeHidden(window.localStorage.getItem('coolcar_pwa_notice_hidden') === '1');
  }, []);

  const defaultRoute = useMemo(() => routes.find((route) => route.is_default) ?? routes[0], [routes]);
  const showInstallNotice = routes.length > 0 && !pwaNoticeHidden;

  function hidePwaNotice() {
    setPwaNoticeHidden(true);
    window.localStorage.setItem('coolcar_pwa_notice_hidden', '1');
  }

  return (
    <main className="shell with-tabbar">
      <header className="topbar">
        <div className="logo"><span className="logo-mark">🧊</span>저장 루틴</div>
        <UserProfilePill />
      </header>

      <section className="hero-card compact saved-hero">
        <p className="eyebrow">MY ROUTINES</p>
        <h1>{isLoggedIn ? `${firstName}님의 루틴` : '이 기기의 루틴'}<br />바로 추천받아요.</h1>
        <p>{isLoggedIn ? '계정에 연결된 출퇴근 경로를 불러왔어요. 출발 전 한 번만 누르면 지금 타기 좋은 칸을 다시 계산해요.' : '로그인하지 않아도 이 기기에 루틴을 저장할 수 있어요. Google/Kakao로 연결하면 다른 기기에서도 이어서 볼 수 있어요.'}</p>
      </section>

      {isLoggedIn && <section className="card soft-notice"><AuthMergeOnLoad /></section>}

      {loading && <section className="card skeleton"><h2>저장 루틴을 불러오는 중이에요</h2><div /></section>}

      {!loading && routes.length === 0 && (
        <section className="card empty">
          <h2>아직 저장한 루틴이 없어요</h2>
          <p>홈에서 추천을 받은 뒤 “이 경로 저장”을 누르면 다음부터 여기서 바로 추천받을 수 있어요.</p>
          <a className="primary link-button" href="/">첫 루틴 추천받기</a>
        </section>
      )}

      {!loading && routes.length > 0 && (
        <section className="card summary-card">
          <span className="summary-kicker">저장 루틴 {routes.length}개</span>
          <h2>{defaultRoute ? `오늘도 ${defaultRoute.origin_station}에서 출발하나요?` : '오늘도 자주 타는 경로로 가나요?'}</h2>
          <p>{isLoggedIn ? '계정에 안전하게 연결된 루틴이에요.' : '다른 기기에서도 보려면 로그인으로 루틴을 연결하세요.'}</p>
        </section>
      )}

      <section className="route-list">
        {routes.map((route, index) => {
          const params = new URLSearchParams({
            line: route.line,
            originStation: route.origin_station,
          });
          if (route.destination_station) params.set('destinationStation', route.destination_station);
          if (route.direction) params.set('direction', route.direction);
          if (route.comfort_type) params.set('comfortType', route.comfort_type);
          return (
            <article className={`card saved-card-v2 ${route.is_default || index === 0 ? 'featured' : ''}`} key={route.id}>
              <div className="saved-card-top">
                <span className="route-chip">{route.is_default ? '기본 루틴' : index === 0 ? '최근 루틴' : '저장 루틴'}</span>
                <span>{route.commute_type === 'WORK' ? '출근' : route.commute_type === 'HOME' ? '퇴근' : '매일'}</span>
              </div>
              <h2>{route.label && route.label !== routeTitle(route) ? route.label : routeTitle(route)}</h2>
              <p className="saved-route-meta">{route.line} · {route.direction ?? '방향 선택 전'} · {comfortLabel(route.comfort_type)} 기준</p>
              <a className="primary" href={`/?${params.toString()}`}>지금 추천받기</a>
            </article>
          );
        })}
      </section>

      {!isLoggedIn && !loading && routes.length > 0 && (
        <section className="card login-nudge">
          <h2>다른 기기에서도 보려면</h2>
          <p>Google 또는 Kakao로 5초 만에 연결하고 저장 루틴을 이어서 볼 수 있어요.</p>
          <a className="ghost" href="/login?next=/saved">로그인하고 루틴 연결하기</a>
        </section>
      )}

      {showInstallNotice && (
        <section className="card pwa-nudge">
          <button aria-label="홈 화면 추가 안내 닫기" onClick={hidePwaNotice} type="button">×</button>
          <h2>매일 타는 경로라면</h2>
          <p>홈 화면에 시원칸을 추가해 보세요. 앱처럼 바로 열고 저장 루틴을 확인할 수 있어요.</p>
          <small>iPhone은 Safari 공유 버튼 → “홈 화면에 추가”, Android는 브라우저의 설치 버튼을 이용해 주세요.</small>
        </section>
      )}

      <nav className="tabbar"><a href="/">홈</a><a className="active" href="/saved">저장</a><a href="/data-source">데이터</a><a href="/settings">설정</a></nav>
    </main>
  );
}
