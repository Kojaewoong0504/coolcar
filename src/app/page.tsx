'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserProfilePill } from '@/components/auth/UserProfilePill';
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
    routes.push(
      { label: '구로디지털단지 → 올림픽공원', line: '2호선', originStation: '구로디지털단지역', destinationStation: '올림픽공원역', destinationLine: '9호선', comfortType: fixedComfortType },
      { label: '홍대입구 → 인천공항', line: '공항철도', originStation: '홍대입구역', destinationStation: '인천공항1터미널역', destinationLine: '공항철도', comfortType: fixedComfortType },
    );
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
            <p className="brand-subtitle">지하철 쾌적칸 추천 앱</p>
          </div>
        </div>
        <p className="eyebrow">10초 추천</p>
        <h1>어디서 타고,<br />어디서 내리나요?</h1>
        <p>출발역과 도착역만 고르면 가능한 환승 경로를 먼저 보여드릴게요.</p>
      </section>

      <form className="card form trip-card simple-trip-card" onSubmit={submit}>
        <div className="section-row trip-title-row">
          <div>
            <div className="section-title">어디 탈지 추천받기</div>
            <p>환승역이나 방면을 몰라도 괜찮아요. 필요한 경우만 짧게 확인할게요.</p>
          </div>
        </div>

        <div className="route-summary-card primary-route-card">
          <button className="route-row route-select-row" type="button" onClick={() => openStationPicker('origin')} aria-label="출발역 선택">
            <span className="route-label">출발</span>
            <span className="route-value">{originStation || '출발역 선택'}</span>
            <span className="route-badge">{originStation ? line : '노선 선택'}</span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <button className="route-row route-select-row" type="button" onClick={() => openStationPicker('destination')} aria-label="도착역 선택">
            <span className="route-label">도착</span>
            <span className="route-value">{destinationStation || '목적지 선택'}</span>
            <span className="route-badge subtle">변경</span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <p className="route-helper">환승역이나 방면을 몰라도 괜찮아요.</p>
        </div>

        <section className="preference-card fixed-cool-card" aria-label="추천 기준">
          <div className="section-row preference-head">
            <div>
              <div className="section-title">추천 기준</div>
              <p>더위 많이 타는 사람 기준으로, 덜 덥고 덜 답답한 칸을 먼저 볼게요.</p>
            </div>
            <span>🧊</span>
          </div>
          <p className="preference-save-copy">{preferenceMessage}</p>
        </section>

        {error && <p className="error">{error}</p>}
        <button className="primary sticky-cta" type="submit" disabled={loading}>{loading ? <><span className="button-spinner" aria-hidden="true" />타기 좋은 칸을 찾고 있어요…</> : <>내 칸 추천받기 <span aria-hidden="true">→</span></>}</button>
      </form>

      <section className="card recent-route-card">
        <div className="section-row"><div><div className="section-title">최근·추천 경로</div><p>자주 쓰는 길은 한 번에 불러올 수 있어요.</p></div></div>
        <div className="recent-route-list">
          {recentRoutes.map((route) => (
            <button key={route.label} type="button" onClick={() => applyRecentRoute(route)}>
              <span><b>{route.label}</b><small>{route.line} · 시원한 칸 기준</small></span>
              <em>불러오기</em>
            </button>
          ))}
        </div>
      </section>
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

      <nav className="tabbar"><Link className="active" href="/">홈</Link><Link href="/saved">저장</Link><Link href="/data-source">데이터</Link><Link href="/settings">설정</Link></nav>
    </main>
  );
}
