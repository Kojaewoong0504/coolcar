'use client';

import { useEffect, useState } from 'react';

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

function getAnonymousId() {
  if (typeof window === 'undefined') return undefined;
  const key = 'coolcar_anonymous_id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

export default function SavedPage() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const anonymousId = getAnonymousId();
    fetch(`/api/routes/saved?anonymousId=${anonymousId}`)
      .then((r) => r.json())
      .then((j) => setRoutes(j.routes ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>저장 경로</div><a className="ghost" href="/">홈</a></header>
      <section className="hero-card compact"><p className="eyebrow">Saved routes</p><h1>자주 타는 경로를<br />한 번에.</h1><p>로그인 전에도 이 기기 기준 익명 ID로 경로를 저장해요. 나중에 소셜 로그인 시 병합할 수 있게 설계했어요.</p></section>
      {loading && <section className="card skeleton"><h2>저장 경로를 불러오는 중이에요</h2><div /></section>}
      {!loading && routes.length === 0 && <section className="card empty"><h2>아직 저장한 경로가 없어요</h2><p>홈에서 추천 결과를 받은 뒤 “이 경로 저장”을 눌러보세요.</p><a className="primary link-button" href="/">첫 경로 추천받기</a></section>}
      <section className="route-list">
        {routes.map((route) => {
          const params = new URLSearchParams({
            line: route.line,
            originStation: route.origin_station,
          });
          if (route.destination_station) params.set('destinationStation', route.destination_station);
          if (route.direction) params.set('direction', route.direction);
          if (route.comfort_type) params.set('comfortType', route.comfort_type);
          return <article className="card saved-card" key={route.id}><div><b>{route.label ?? `${route.origin_station} → ${route.destination_station ?? ''}`}</b><p>{route.line} · {route.direction ?? '방향 미정'} · {route.comfort_type ?? 'BALANCED'}</p></div><a href={`/?${params.toString()}`}>추천</a></article>;
        })}
      </section>
      <nav className="tabbar"><a href="/">홈</a><a className="active" href="/saved">저장</a><a href="/data-source">데이터</a><a href="/settings">설정</a></nav>
    </main>
  );
}
