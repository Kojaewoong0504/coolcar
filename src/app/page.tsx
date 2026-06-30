'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserProfilePill } from '@/components/auth/UserProfilePill';
import { SUPPORTED_LINES } from '@/lib/stations';
import type { Station } from '@/lib/stations';
import type { ComfortType } from '@/lib/types';

const comfortOptions: { label: string; value: ComfortType; desc: string; emoji: string }[] = [
  { label: '더위형', value: 'HOT_SENSITIVE', desc: '시원한 칸 우선', emoji: '🧊' },
  { label: '추위형', value: 'COLD_SENSITIVE', desc: '약냉방·중앙', emoji: '🧣' },
  { label: '혼잡회피', value: 'CROWD_AVOIDER', desc: '덜 붐비는 칸', emoji: '🫧' },
  { label: '밸런스', value: 'BALANCED', desc: '균형 추천', emoji: '⚖️' },
];

const preferenceStorageKey = 'coolcar_preferences';

type SavedPreferences = {
  comfortType: ComfortType;
  waitToleranceMin: 0 | 3 | 5 | 10;
  avoidPrioritySeatArea: boolean;
};

function isComfortType(value: unknown): value is ComfortType {
  return comfortOptions.some((option) => option.value === value);
}

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
  const preferenceTouchedRef = useRef(false);
  const [anonymousId, setAnonymousId] = useState<string>();
  const [comfortType, setComfortType] = useState<ComfortType>('HOT_SENSITIVE');
  const [line, setLine] = useState('2호선');
  const [originStation, setOriginStation] = useState('강남역');
  const [destinationStation, setDestinationStation] = useState('홍대입구역');
  const [destinationLine, setDestinationLine] = useState('2호선');
  const [direction, setDirection] = useState('');
  const [transferStationsInput, setTransferStationsInput] = useState('');
  const [avoidPrioritySeatArea, setAvoidPrioritySeatArea] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState('이 취향을 다음 추천에도 기억할게요.');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
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
    if (isComfortType(localPreferences.comfortType)) setComfortType(localPreferences.comfortType);
    if (typeof localPreferences.avoidPrioritySeatArea === 'boolean') setAvoidPrioritySeatArea(localPreferences.avoidPrioritySeatArea);

    void fetch(`/api/preferences?anonymousId=${encodeURIComponent(id)}`)
      .then((response) => response.json())
      .then((json: { preferences?: Partial<SavedPreferences>; persisted?: boolean; owner?: string }) => {
        if (!preferenceTouchedRef.current) {
          if (isComfortType(json.preferences?.comfortType)) setComfortType(json.preferences.comfortType);
          if (typeof json.preferences?.avoidPrioritySeatArea === 'boolean') setAvoidPrioritySeatArea(json.preferences.avoidPrioritySeatArea);
        }
        setPreferenceMessage(json.persisted ? '저장된 취향을 불러왔어요.' : '이 취향을 다음 추천에도 기억할게요.');
      })
      .catch(() => undefined)
      .finally(() => setPreferencesLoaded(true));

    const params = new URLSearchParams(window.location.search);
    const nextLine = params.get('line');
    const nextOrigin = params.get('originStation');
    const nextDestination = params.get('destinationStation');
    const nextDestinationLine = params.get('destinationLine');
    const nextDirection = params.get('direction');
    const nextComfortType = params.get('comfortType') as ComfortType | null;
    if (nextLine) setLine(nextLine);
    if (nextOrigin) setOriginStation(nextOrigin);
    if (nextDestination) setDestinationStation(nextDestination);
    if (nextDestinationLine) setDestinationLine(nextDestinationLine);
    if (nextDirection) setDirection(nextDirection);
    const nextTransfers = params.get('transferStations');
    if (nextTransfers) setTransferStationsInput(nextTransfers);
    if (nextComfortType && comfortOptions.some((option) => option.value === nextComfortType)) setComfortType(nextComfortType);

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
      { label: '강남 → 판교', line: '2호선', originStation: '역삼역', destinationStation: '판교역', destinationLine: '신분당선', comfortType: 'BALANCED', transferStations: ['강남역'] },
      { label: '양재 → 여의도', line: '3호선', originStation: '양재역', destinationStation: '여의도역', destinationLine: '9호선', comfortType: 'BALANCED', transferStations: ['고속터미널역'] },
    );
    const deduped = routes.filter((route, index, arr) => arr.findIndex((item) => item.label === route.label) === index).slice(0, 3);
    setRecentRoutes(deduped);
    router.prefetch('/result?loading=1');
  }, [router]);

  useEffect(() => {
    if (!preferencesLoaded || !anonymousId) return;
    const preferences: SavedPreferences = { comfortType, waitToleranceMin: 3, avoidPrioritySeatArea };
    window.localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
    setPreferenceMessage('취향이 저장됐어요. 언제 접속해도 같은 값으로 시작할게요.');
    const controller = new AbortController();
    void fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...preferences, anonymousId }),
      signal: controller.signal,
    }).catch(() => setPreferenceMessage('이 기기에는 저장됐어요. 로그인하면 계정에도 맞춰둘 수 있어요.'));
    return () => controller.abort();
  }, [anonymousId, avoidPrioritySeatArea, comfortType, preferencesLoaded]);

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

  const selectedComfort = comfortOptions.find((option) => option.value === comfortType) ?? comfortOptions[0];
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

    if (!line || !originStation) {
      setError('노선과 출발역은 꼭 필요해요.');
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
    setPickerQuery(target === 'origin' ? originStation.replace(/역$/, '') : destinationStation.replace(/역$/, ''));
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
    setComfortType(route.comfortType);
    setTransferStationsInput(route.transferStations?.join(', ') ?? '');
    setDirection('');
    setShowAdvancedOptions(Boolean(route.transferStations?.length));
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
            <span className="route-value">{originStation}</span>
            <span className="route-badge">{line}</span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <button className="route-row route-select-row" type="button" onClick={() => openStationPicker('destination')} aria-label="도착역 선택">
            <span className="route-label">도착</span>
            <span className="route-value">{destinationStation || '목적지 선택'}</span>
            <span className="route-badge subtle">변경</span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
          <p className="route-helper">노선은 역 선택으로 자동 맞춰져요. 환승역·방면은 알고 있을 때만 추가하세요.</p>
        </div>

        <section className="preference-card" aria-label="내 취향">
          <div className="section-row preference-head">
            <div>
              <div className="section-title">내 취향</div>
              <p>어떤 칸이 편하세요? 선택한 값은 다음에도 유지돼요.</p>
            </div>
            <span>{selectedComfort.emoji}</span>
          </div>
          <div className="segmented-pills preference-segments" role="group" aria-label="추천 성향">
            {comfortOptions.map((option) => (
              <button key={option.value} type="button" className={option.value === comfortType ? 'segment active' : 'segment'} aria-pressed={option.value === comfortType} onClick={() => { preferenceTouchedRef.current = true; setComfortType(option.value); }}>
                <span>{option.emoji}</span><b>{option.label}{option.value === comfortType && <em aria-hidden="true">✓</em>}</b><small>{option.desc}</small>
              </button>
            ))}
          </div>
          <p className="preference-save-copy">{preferenceMessage}</p>
        </section>

        <details className="advanced-options-shell" open={showAdvancedOptions} onToggle={(event) => setShowAdvancedOptions((event.currentTarget as HTMLDetailsElement).open)}>
          <summary>{appliedConditionCount > 0 ? `추가 조건 ${appliedConditionCount}개 적용됨` : '필요할 때만 추가 설정'}</summary>
          <section className="advanced-options" aria-label="추가 추천 조건">
            <p className="microcopy">환승역이나 방면을 정확히 알고 있을 때만 넣어주세요. 모르면 비워도 추천은 받을 수 있어요.</p>
            <label className="field optional-transfer-field">
              <span>환승역을 아는 경우만 추가</span>
              <input value={transferStationsInput} onChange={(event) => setTransferStationsInput(event.target.value)} placeholder="예: 강남역, 고속터미널역" />
              <small>비워도 추천받을 수 있어요. 입력하면 확인된 구간에서 환승 가까운 칸을 함께 봅니다.</small>
            </label>

            <label className="field optional-transfer-field">
              <span>방면을 알고 있다면 입력</span>
              <input value={direction} onChange={(event) => setDirection(event.target.value)} placeholder="예: 교대, 선릉, 잠원 방면" />
              <small>잘 모르겠으면 비워두세요. 문 위치는 방향까지 확인되는 경우에만 안내해요.</small>
            </label>

            <label className="toggle"><input type="checkbox" checked={avoidPrioritySeatArea} onChange={(e) => { preferenceTouchedRef.current = true; setAvoidPrioritySeatArea(e.target.checked); }} /> 교통약자석 주변은 배려해서 추천</label>
          </section>
        </details>

        {error && <p className="error">{error}</p>}
        <button className="primary sticky-cta" type="submit" disabled={loading}>{loading ? <><span className="button-spinner" aria-hidden="true" />타기 좋은 칸을 찾고 있어요…</> : <>내 칸 추천받기 <span aria-hidden="true">→</span></>}</button>
      </form>

      <section className="card recent-route-card">
        <div className="section-row"><div><div className="section-title">최근·추천 경로</div><p>자주 쓰는 길은 한 번에 불러올 수 있어요.</p></div></div>
        <div className="recent-route-list">
          {recentRoutes.map((route) => (
            <button key={route.label} type="button" onClick={() => applyRecentRoute(route)}>
              <span><b>{route.label}</b><small>{route.line} · {comfortOptions.find((option) => option.value === route.comfortType)?.desc ?? '균형 추천'}</small></span>
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
            <p className="station-picker-hint">역 이름을 입력하면 전체 지원 노선에서 먼저 찾아요. 검색어를 지우면 선택한 노선의 역을 둘러볼 수 있어요.</p>
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
