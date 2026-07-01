'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TabBar } from '@/components/TabBar';
import { AuthMergeOnLoad } from '@/components/auth/AuthMergeOnLoad';
import { UserProfilePill } from '@/components/auth/UserProfilePill';
import { lineColorClass, lineShortLabel } from '@/lib/metro-lines';
import { STATIONS } from '@/lib/stations';
import type { NormalizedAuthProfile } from '@/lib/auth/profile';
import type { RecommendRequest } from '@/lib/types';

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
  recent_request?: RecommendRequest;
  recent_context?: { destinationLine?: string };
};

type AuthMe = { authenticated: boolean; profile: NormalizedAuthProfile | null };

type StoredRoutineRequest = {
  request: RecommendRequest;
  context?: { destinationLine?: string };
};

type StoredRoutineRequests = Record<string, StoredRoutineRequest>;


function readStoredRoutineRequests(): StoredRoutineRequests {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem('coolcar_saved_route_requests') ?? '{}') as StoredRoutineRequests;
  } catch {
    return {};
  }
}

function removeStoredRoutineRequest(routeId: string) {
  if (typeof window === 'undefined') return;
  const current = readStoredRoutineRequests();
  delete current[routeId];
  window.localStorage.setItem('coolcar_saved_route_requests', JSON.stringify(current));
}

function getAnonymousId() {
  if (typeof window === 'undefined') return undefined;
  const key = 'coolcar_anonymous_id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

function routeTitle(route: SavedRoute) {
  return `${route.origin_station} → ${route.destination_station ?? '목적지'}`;
}

function routeMeta(route: SavedRoute) {
  const request = route.recent_request;
  const destinationLine = inferDestinationLine(route);
  const transfers = request?.transferStations?.filter(Boolean) ?? [];
  const lineCopy = destinationLine && destinationLine !== route.line ? `${route.line} → ${destinationLine}` : route.line;
  const transferCopy = transfers.length > 0 ? ` · ${transfers.join(', ')} 환승` : '';
  return `${lineCopy}${transferCopy} · 시원한 칸 기준`;
}

function inferDestinationLine(route: SavedRoute) {
  const explicit = route.recent_request?.destinationLine ?? route.recent_context?.destinationLine;
  if (explicit) return explicit;
  const origin = route.origin_station ?? '';
  const destination = route.destination_station;
  if (route.line === '2호선' && origin.includes('구로디지털단지') && destination?.includes('올림픽공원')) return '9호선';
  if (!destination) return undefined;
  const stationLines = STATIONS
    .filter((station) => station.name === destination)
    .map((station) => station.line)
    .filter((line, index, lines) => lines.indexOf(line) === index);
  return stationLines.find((line) => line !== route.line) ?? stationLines[0];
}

function routeLines(route: SavedRoute) {
  const destinationLine = inferDestinationLine(route);
  return destinationLine && destinationLine !== route.line ? [route.line, destinationLine] : [route.line];
}

export default function SavedPage() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState('');
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

  function startRecommendation(route: SavedRoute) {
    const anonymousId = getAnonymousId();
    const localStored = readStoredRoutineRequests()[route.id];
    const serverStored = route.recent_request
      ? { request: route.recent_request, context: route.recent_context }
      : undefined;
    const baseRequest: RecommendRequest = {
      line: route.line,
      originStation: route.origin_station,
      destinationStation: route.destination_station ?? undefined,
      direction: route.direction ?? undefined,
      comfortType: 'HOT_SENSITIVE',
      avoidPrioritySeatArea: true,
      waitToleranceMin: 3,
      anonymousId,
    };
    const restored = localStored ?? serverStored;
    const pending = restored
      ? { request: { ...restored.request, comfortType: 'HOT_SENSITIVE' as const, anonymousId: restored.request.anonymousId ?? anonymousId }, context: restored.context }
      : { request: baseRequest, context: undefined };
    window.sessionStorage.setItem('coolcar_pending_recommendation', JSON.stringify(pending));
    window.location.href = '/result';
  }

  async function deleteRoute(route: SavedRoute) {
    if (deletingIds.includes(route.id)) return;
    setDeleteError('');
    setDeletingIds((ids) => [...ids, route.id]);
    const anonymousId = getAnonymousId();
    const response = await fetch('/api/routes/saved', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: route.id, anonymousId }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setDeleteError(json.error?.message ?? '루틴 삭제에 실패했어요.');
      setDeletingIds((ids) => ids.filter((id) => id !== route.id));
      return;
    }

    removeStoredRoutineRequest(route.id);
    setRoutes((current) => current.filter((item) => item.id !== route.id));
    setDeletingIds((ids) => ids.filter((id) => id !== route.id));
  }

  return (
    <main className="shell with-tabbar">
      <header className="topbar">
        <div className="logo"><img className="logo-mark logo-image" src="/icons/icon-192.png" alt="시원칸 앱 아이콘" />내 경로</div>
        <UserProfilePill profile={auth?.profile ?? null} loaded={!loading} />
      </header>

      <section className="hero-card compact saved-hero">
        <p className="eyebrow">내 경로</p>
        <h1>{isLoggedIn ? `${firstName}님의 경로` : '자주 타는 경로를'}<br />바로 불러와요.</h1>
        <p>{isLoggedIn ? '저장한 경로를 계정에서 이어보고, 출발 전 바로 시원한 칸을 확인해요.' : '추천은 로그인 없이도 쓸 수 있어요. 로그인하면 저장한 경로를 다른 기기에서도 이어볼 수 있습니다.'}</p>
      </section>

      {isLoggedIn && <AuthMergeOnLoad />}

      {!isLoggedIn && !loading && (
        <section className="card login-nudge saved-login-nudge">
          <span className="summary-kicker">선택 로그인</span>
          <h2>내 경로를 안전하게 이어볼까요?</h2>
          <p>{routes.length > 0 ? '이 기기에 저장한 경로를 계정에 이어두면, 다른 기기에서도 바로 추천받을 수 있어요.' : '자주 타는 경로를 저장해두고, 로그인하면 다른 기기에서도 같은 경로를 이어볼 수 있어요.'}</p>
          <div className="result-actions"><Link className="saved-login-primary" href="/login?next=/saved">로그인하고 경로 이어보기</Link><Link href="/privacy">개인정보 안내</Link></div>
        </section>
      )}

      {loading && <section className="card skeleton"><h2>내 경로를 불러오는 중이에요</h2><div /></section>}

      {!loading && routes.length === 0 && (
        <section className="card empty">
          <h2>아직 저장한 경로가 없어요</h2>
          <p>자주 타는 길을 저장하면 다음부터 한 번에 시원한 칸을 볼 수 있어요.</p>
          <Link className="primary link-button" href="/">첫 루틴 추천받기</Link>
        </section>
      )}

      {!loading && routes.length > 0 && (
        <section className="card summary-card">
          <span className="summary-kicker">저장 루틴 {routes.length}개</span>
          <h2>{defaultRoute ? `${defaultRoute.origin_station} 출발 루틴` : '자주 타는 경로'}</h2>
          <p>출발 전 한 번 눌러 오늘 탈 칸을 바로 봐요.</p>
        </section>
      )}

      <section className="route-list">
        {deleteError && <p className="error">{deleteError}</p>}
        {routes.map((route, index) => {
          const isDeleting = deletingIds.includes(route.id);
          return (
            <article className={`card saved-card-v2 ${route.is_default || index === 0 ? 'featured' : ''}`} key={route.id}>
              <div className="saved-card-top">
                <span className="route-chip">{route.is_default ? '기본 루틴' : index === 0 ? '최근 루틴' : '저장 루틴'}</span>
                <span>{route.commute_type === 'WORK' ? '출근' : route.commute_type === 'HOME' ? '퇴근' : '매일'}</span>
              </div>
              <h2>{route.label && route.label !== routeTitle(route) ? route.label : routeTitle(route)}</h2>
              <div className="saved-line-flow" aria-label="저장 루틴 노선">
                {routeLines(route).map((item, lineIndex) => (
                  <span className="saved-line-item" key={`${route.id}-${item}`}>
                    {lineIndex > 0 && <em>→</em>}
                    <span className={`line-badge ${lineColorClass(item)}`}>{lineShortLabel(item)}</span>
                  </span>
                ))}
              </div>
              <p className="saved-route-meta">{routeMeta(route)}</p>
              <div className="saved-card-actions">
                <button className="primary saved-recommend-button" disabled={isDeleting} type="button" onClick={() => startRecommendation(route)}>추천받기</button>
                <button className="ghost saved-delete-button" disabled={isDeleting} type="button" onClick={() => deleteRoute(route)}>{isDeleting ? '삭제 중' : '삭제'}</button>
              </div>
            </article>
          );
        })}
      </section>

      {showInstallNotice && (
        <section className="card pwa-nudge">
          <button aria-label="홈 화면 추가 안내 닫기" onClick={hidePwaNotice} type="button">×</button>
          <h2>매일 타는 경로라면</h2>
          <p>홈 화면에 시원칸을 추가해 보세요. 앱처럼 바로 열고 저장 루틴을 확인할 수 있어요.</p>
          <small>iPhone은 Safari 공유 버튼 → “홈 화면에 추가”, Android는 브라우저의 설치 버튼을 이용해 주세요.</small>
        </section>
      )}

      <TabBar active="saved" />
    </main>
  );
}
