'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TabBar } from '@/components/TabBar';
import { UserProfilePill } from '@/components/auth/UserProfilePill';
import { lineColorClass, lineColorValue, lineShortLabel } from '@/lib/metro-lines';
import { MAJOR_STATIONS_BY_LINE, SUPPORTED_LINES } from '@/lib/stations';
import type { Station } from '@/lib/stations';
import type { ComfortType } from '@/lib/types';

const fixedComfortType: ComfortType = 'HOT_SENSITIVE';

const preferenceStorageKey = 'coolcar_preferences';

type SavedPreferences = {
  comfortType: ComfortType;
  waitToleranceMin: 0 | 3 | 5 | 10;
  avoidPrioritySeatArea: boolean;
};

function readLocalPreferences(): Partial<SavedPreferences> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(preferenceStorageKey) ?? '{}') as Partial<SavedPreferences>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const lines = [...SUPPORTED_LINES];
type StationHit = Pick<Station, 'name' | 'line' | 'operator'>;
type PickerTarget = 'origin' | 'destination' | null;
type RecentRoute = {
  label: string;
  line: string;
  originStation: string;
  destinationStation: string;
  destinationLine?: string;
  comfortType: ComfortType;
  transferStations?: string[];
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

export default function HomePage() {
  const router = useRouter();
  const [anonymousId, setAnonymousId] = useState<string>();
  const [comfortType] = useState<ComfortType>(fixedComfortType);
  const [line, setLine] = useState('2호선');
  const [originStation, setOriginStation] = useState('');
  const [destinationStation, setDestinationStation] = useState('');
  const [destinationLine, setDestinationLine] = useState('');
  const [direction, setDirection] = useState('');
  const [transferStationsInput, setTransferStationsInput] = useState('');
  const [avoidPrioritySeatArea, setAvoidPrioritySeatArea] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState('시원한 칸 기준으로 추천할게요.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerLine, setPickerLine] = useState(line);
  const [pickerStations, setPickerStations] = useState<StationHit[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);

  useEffect(() => {
    (window as Window & { coolcarHydrated?: boolean }).coolcarHydrated = true;
    const id = getAnonymousId() ?? crypto.randomUUID();
    setAnonymousId(id);

    const localPreferences = readLocalPreferences();
    if (typeof localPreferences.avoidPrioritySeatArea === 'boolean') setAvoidPrioritySeatArea(localPreferences.avoidPrioritySeatArea);

    void fetch(`/api/preferences?anonymousId=${encodeURIComponent(id)}`)
      .then((response) => response.json())
      .then((json: { preferences?: Partial<SavedPreferences>; persisted?: boolean; owner?: string }) => {
        if (typeof json.preferences?.avoidPrioritySeatArea === 'boolean') setAvoidPrioritySeatArea(json.preferences.avoidPrioritySeatArea);
        setPreferenceMessage(json.persisted ? '시원한 칸 기준으로 준비됐어요.' : '시원한 칸 기준으로 추천할게요.');
      })
      .catch(() => undefined)
      .finally(() => setPreferencesLoaded(true));

    const params = new URLSearchParams(window.location.search);
    const nextLine = params.get('line');
    const nextOrigin = params.get('originStation');
    const nextDestination = params.get('destinationStation');
    const nextDestinationLine = params.get('destinationLine');
    const nextDirection = params.get('direction');

    if (nextLine) setLine(nextLine);
    if (nextOrigin) setOriginStation(nextOrigin);
    if (nextDestination) setDestinationStation(nextDestination);
    if (nextDestinationLine) setDestinationLine(nextDestinationLine);
    if (nextDirection) setDirection(nextDirection);
    const nextTransfers = params.get('transferStations');
    if (nextTransfers) setTransferStationsInput(nextTransfers);


    const routes: RecentRoute[] = [];
    const lastRaw = window.sessionStorage.getItem('coolcar_last_result');
    if (lastRaw) {
      try {
        const last = JSON.parse(lastRaw) as { result?: { request?: RecentRoute } };
        const request = last.result?.request;
        if (request?.originStation && request.destinationStation) {
          routes.push({
            label: `${request.originStation} → ${request.destinationStation}`,
            line: request.line,
            originStation: request.originStation,
            destinationStation: request.destinationStation,
            destinationLine: request.destinationLine,
            comfortType: request.comfortType,
            transferStations: request.transferStations,
          });
        }
      } catch {
        // Ignore stale local session data.
      }
    }
    const deduped = routes.filter((route, index, arr) => arr.findIndex((item) => item.label === route.label) === index).slice(0, 3);
    setRecentRoutes(deduped);
    router.prefetch('/result?loading=1');
  }, [router]);

  useEffect(() => {
    if (!preferencesLoaded || !anonymousId) return;
    const preferences: SavedPreferences = { comfortType: fixedComfortType, waitToleranceMin: 3, avoidPrioritySeatArea };
    window.localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
    setPreferenceMessage('기준이 저장됐어요. 언제 접속해도 시원한 칸 기준으로 시작할게요.');
    const controller = new AbortController();
    void fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...preferences, anonymousId }),
      signal: controller.signal,
    }).catch(() => setPreferenceMessage('이 기기에는 저장됐어요. 로그인하면 계정에도 맞춰둘 수 있어요.'));
    return () => controller.abort();
  }, [anonymousId, avoidPrioritySeatArea, preferencesLoaded]);

  useEffect(() => {
    if (!pickerTarget) {
      setPickerStations([]);
      return;
    }

    const controller = new AbortController();
    const query = pickerQuery.trim();
    const params = new URLSearchParams({ limit: '24' });
    if (query) {
      params.set('q', query);
      // 역 이름을 치는 순간은 노선과 무관하게 전체 역에서 먼저 찾는다.
      // 노선 chip은 검색어가 비어 있을 때 "해당 노선 둘러보기" 용도로 쓴다.
    } else if (pickerLine) {
      params.set('line', pickerLine);
    }

    setPickerLoading(true);
    fetch(`/api/stations/search?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => setPickerStations((j.stations ?? []).slice(0, 24)))
      .catch(() => undefined)
      .finally(() => setPickerLoading(false));

    return () => controller.abort();
  }, [pickerTarget, pickerLine, pickerQuery]);


  const majorStationHits = useMemo<StationHit[]>(() => {
    const names = MAJOR_STATIONS_BY_LINE[pickerLine] ?? [];
    return names.map((name) => ({ name, line: pickerLine, operator: pickerLine === '공항철도' ? '공항철도' : '수도권 전철' }));
  }, [pickerLine]);
  const transferStations = useMemo(
    () => transferStationsInput.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 5),
    [transferStationsInput],
  );
  const appliedConditionCount = [
    transferStations.length > 0,
    Boolean(direction.trim()),
    !avoidPrioritySeatArea,
  ].filter(Boolean).length;
  const originLineClass = originStation ? lineColorClass(line) : 'line-neutral';
  const destinationLineClass = destinationStation ? lineColorClass(destinationLine || line) : 'line-neutral';
  const originRailColor = originStation ? lineColorValue(line) : '#cbd5e1';
  const destinationRailColor = destinationStation ? lineColorValue(destinationLine || line) : '#cbd5e1';

  async function runRecommendation() {
    setError('');

    if (!originStation || !destinationStation) {
      setError('출발역과 도착역을 선택해 주세요.');
      return;
    }

    if (!line) {
      setError('출발 노선을 선택해 주세요.');
      return;
    }

    const request = {
      line,
      originStation,
      destinationStation,
      destinationLine,
      direction: direction.trim() || undefined,
      comfortType,
      waitToleranceMin: 3,
      avoidPrioritySeatArea,
      anonymousId,
      transferStations,
    };
    window.sessionStorage.setItem('coolcar_pending_route_plan', JSON.stringify({ request, context: { destinationLine } }));
    window.sessionStorage.removeItem('coolcar_pending_recommendation');
    setLoading(true);
    router.push('/route-plans');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runRecommendation();
  }

  function openStationPicker(target: Exclude<PickerTarget, null>) {
    setPickerTarget(target);
    setPickerQuery('');
    setPickerLine(line);
  }

  function chooseStation(station: StationHit) {
    if (pickerTarget === 'origin') {
      setOriginStation(station.name);
      setLine(station.line);
      setPickerLine(station.line);
    }
    if (pickerTarget === 'destination') {
      setDestinationStation(station.name);
      setDestinationLine(station.line);
    }
    setPickerTarget(null);
  }

  function applyRecentRoute(route: RecentRoute) {
    setLine(route.line);
    setOriginStation(route.originStation);
    setDestinationStation(route.destinationStation);
    setDestinationLine(route.destinationLine ?? route.line);
    setTransferStationsInput(route.transferStations?.join(', ') ?? '');
    setDirection('');
  }


  return (
    <main className="shell with-tabbar">
      <header className="topbar app-topbar">
        <div className="logo"><img className="logo-mark logo-image" src="/icons/icon-192.png" alt="시원칸 앱 아이콘" /><span>시원칸</span></div>
        <UserProfilePill />
      </header>

      <section className="hero-card home-hero simple-home-hero">
        <div className="hero-orb" aria-hidden="true" />
        <div className="brand-hero compact-brand">
          <img className="brand-app-icon" src="/icons/icon-192.png" alt="시원칸 앱 아이콘" />
          <div>
            <p className="brand-name">시원칸</p>
            <p className="brand-subtitle">지하철 칸 내비게이션</p>
          </div>
        </div>
        <div className="hero-pill-row" aria-label="시원칸 핵심 기능">
          <span>노선색 경로</span>
          <span>시원칸 추천</span>
        </div>
        <h1>오늘도 덜 더운<br />칸으로 갈까요?</h1>
        <p>경로를 고르면 이동 중 보기 쉽게 탈 칸을 알려드려요.</p>
      </section>

      <form className="card form trip-card simple-trip-card" onSubmit={submit}>
        <div className="section-row trip-title-row">
          <div>
            <div className="section-title">출발·도착 선택</div>
            <p>경로와 추천 칸을 한 번에 볼게요.</p>
          </div>
        </div>

        <div className="route-summary-card primary-route-card">
          <div className="metro-mini-map" aria-label="선택한 지하철 경로">
            <div className="metro-rail" aria-hidden="true">
              <span className={`metro-rail-dot ${originLineClass}`} />
              <span className="metro-rail-line" style={{ background: `linear-gradient(180deg, ${originRailColor}, ${destinationRailColor})` }} />
              <span className={`metro-rail-dot ${destinationLineClass}`} />
            </div>
            <div className="metro-mini-copy">
              <div className="metro-mini-row">
                <span className={`line-badge ${originLineClass}`}>{originStation ? lineShortLabel(line) : '출발'}</span>
                <strong>{originStation || '출발역 선택'}</strong>
              </div>
              <div className="metro-mini-row">
                <span className={`line-badge ${destinationLineClass}`}>{destinationStation ? lineShortLabel(destinationLine || line) : '도착'}</span>
                <strong>{destinationStation || '목적지 선택'}</strong>
              </div>
            </div>
          </div>
          <button className="route-row route-select-row" type="button" onClick={() => openStationPicker('origin')} aria-label="출발역 선택">
            <span className={`route-dot origin-dot ${originLineClass}`} aria-hidden="true" />
            <span className="route-label">출발</span>
            <span className="route-value">{originStation || '출발역 선택'}</span>
            <span className={`route-badge ${originLineClass}`}>{originStation ? line : '노선 선택'}</span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <button className="route-row route-select-row" type="button" onClick={() => openStationPicker('destination')} aria-label="도착역 선택">
            <span className={`route-dot destination-dot ${destinationLineClass}`} aria-hidden="true" />
            <span className="route-label">도착</span>
            <span className="route-value">{destinationStation || '목적지 선택'}</span>
            <span className={`route-badge subtle ${destinationLineClass}`}>{destinationStation ? lineShortLabel(destinationLine || line) : '선택'}</span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <p className="route-helper">노선색과 환승 흐름을 함께 보여드려요.</p>
        </div>

        <section className="cool-mode-strip fixed-cool-card" aria-label="추천 기준">
          <span aria-hidden="true">🧊</span>
          <div>
            <b>덜 더운 선택 우선</b>
            <p>{preferenceMessage}</p>
          </div>
        </section>

        {error && <p className="error">{error}</p>}
        <button className="primary sticky-cta" type="submit" disabled={loading}>{loading ? <><span className="button-spinner" aria-hidden="true" />타기 좋은 칸을 찾고 있어요…</> : <>내 칸 추천받기 <span aria-hidden="true">→</span></>}</button>
      </form>

      {recentRoutes.length > 0 && (
        <section className="card recent-route-card">
          <div className="section-row"><div><div className="section-title">최근 경로</div><p>이 기기에서 방금 본 경로만 다시 볼 수 있어요.</p></div></div>
          <div className="recent-route-list">
            {recentRoutes.map((route) => (
              <button key={route.label} type="button" onClick={() => applyRecentRoute(route)}>
                <span>
                  <b>{route.label}</b>
                  <small className="saved-line-flow">
                    <span className={`line-badge ${lineColorClass(route.line)}`}>{lineShortLabel(route.line)}</span>
                    {route.destinationLine && route.destinationLine !== route.line ? <><em>→</em><span className={`line-badge ${lineColorClass(route.destinationLine)}`}>{lineShortLabel(route.destinationLine)}</span></> : null}
                    <em>시원칸</em>
                  </small>
                </span>
                <em>바로 선택</em>
              </button>
            ))}
          </div>
        </section>
      )}
      {pickerTarget && (
        <div className="station-picker-backdrop" role="presentation" onClick={() => setPickerTarget(null)}>
          <section className="station-picker-sheet" role="dialog" aria-modal="true" aria-label={pickerTarget === 'origin' ? '출발역 선택' : '도착역 선택'} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="station-picker-head">
              <div>
                <p className="eyebrow">{pickerTarget === 'origin' ? '출발역 선택' : '도착역 선택'}</p>
                <h2>{pickerTarget === 'origin' ? '어디서 타나요?' : '어디까지 가나요?'}</h2>
              </div>
              <button type="button" onClick={() => setPickerTarget(null)} aria-label="역 선택 닫기">×</button>
            </div>
            <div className="line-chip-grid" aria-label="노선 선택">
              {lines.map((item) => <button key={item} type="button" className={item === pickerLine ? 'active' : ''} onClick={() => setPickerLine(item)}>{item}</button>)}
            </div>
            {majorStationHits.length > 0 && (
              <div className="major-station-strip" aria-label={`${pickerLine} 주요역`}>
                {majorStationHits.map((station) => (
                  <button key={`${station.line}-${station.name}`} type="button" onClick={() => chooseStation(station)}>{station.name.replace(/역$/, '')}</button>
                ))}
              </div>
            )}
            <p className="station-picker-hint">호선을 고르면 주요역을 바로 누를 수 있어요. 역 이름을 입력하면 전체 지원 노선에서 찾아요.</p>
            <label className="station-search-label">
              <span>역 이름 검색</span>
              <input autoFocus value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="역삼, 삼성, 시청, 여의도" />
            </label>
            <div className="station-result-list">
              {pickerLoading && <p className="microcopy">역을 찾고 있어요…</p>}
              {!pickerLoading && pickerStations.map((station) => (
                <button key={`${station.name}-${station.line}-${pickerTarget}`} type="button" onClick={() => chooseStation(station)}>
                  <span><b>{station.name}</b><small>{station.operator}</small></span>
                  <em>{station.line}</em>
                </button>
              ))}
              {!pickerLoading && pickerStations.length === 0 && <p className="microcopy">검색 결과가 없어요. 다른 역 이름으로 검색해 주세요.</p>}
            </div>
          </section>
        </div>
      )}

      <TabBar active="home" />
    </main>
  );
}
