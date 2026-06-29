'use client';

import { FormEvent, useEffect, useState } from 'react';
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

const lines = [...SUPPORTED_LINES];
type StationHit = Pick<Station, 'name' | 'line' | 'operator'>;
type PickerTarget = 'origin' | 'destination' | null;


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
  const [comfortType, setComfortType] = useState<ComfortType>('HOT_SENSITIVE');
  const [line, setLine] = useState('2호선');
  const [originStation, setOriginStation] = useState('강남역');
  const [destinationStation, setDestinationStation] = useState('홍대입구역');
  const [destinationLine, setDestinationLine] = useState('2호선');
  const [direction, setDirection] = useState('내선');
  const [transferStationsInput, setTransferStationsInput] = useState('');
  const [avoidPrioritySeatArea, setAvoidPrioritySeatArea] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerLine, setPickerLine] = useState(line);
  const [pickerStations, setPickerStations] = useState<StationHit[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    (window as Window & { coolcarHydrated?: boolean }).coolcarHydrated = true;
    setAnonymousId(getAnonymousId());
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
    router.prefetch('/result?loading=1');
  }, [router]);

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

  async function runRecommendation() {
    setError('');

    if (!line || !originStation) {
      setError('노선과 출발역은 꼭 필요해요.');
      return;
    }

    const transferStations = transferStationsInput.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 5);
    const request = { line, originStation, destinationStation, destinationLine, direction, comfortType, waitToleranceMin: 3, avoidPrioritySeatArea, anonymousId, transferStations };
    window.sessionStorage.setItem('coolcar_pending_recommendation', JSON.stringify({ request, context: { destinationLine } }));
    setLoading(true);
    router.push('/result?loading=1');
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


  return (
    <main className="shell with-tabbar">
      <header className="topbar app-topbar">
        <div className="logo"><img className="logo-mark logo-image" src="/icons/icon-192.png" alt="시원칸 앱 아이콘" /><span>시원칸</span></div>
        <UserProfilePill />
      </header>

      <section className="hero-card home-hero">
        <div className="hero-orb" aria-hidden="true" />
        <div className="brand-hero">
          <img className="brand-app-icon" src="/icons/icon-192.png" alt="시원칸 앱 아이콘" />
          <div>
            <p className="brand-name">시원칸</p>
            <p className="brand-subtitle">지하철 쾌적칸 추천 앱</p>
          </div>
        </div>
        <p className="eyebrow">퇴근길 쾌적칸 추천</p>
        <h1>노선도 말고,<br />어디 탈지만.</h1>
        <p>더위, 추위, 혼잡도를 합쳐 쾌적할 가능성이 높은 칸을 골라드려요.</p>
        <div className="hero-stats"><span><b>30초</b>입력 완료</span><span><b>무료</b>추천 가능</span><span><b>3초</b>결론 확인</span></div>
      </section>

      <form className="card form trip-card" onSubmit={submit}>
        <div className="section-row"><div><div className="section-title">오늘의 기준</div><p>내가 피하고 싶은 불편함을 먼저 골라요.</p></div></div>
        <div className="segmented-pills" role="group" aria-label="추천 성향">
          {comfortOptions.map((option) => (
            <button key={option.value} type="button" className={option.value === comfortType ? 'segment active' : 'segment'} onClick={() => setComfortType(option.value)}>
              <span>{option.emoji}</span><b>{option.label}{option.value === comfortType && <em aria-hidden="true">✓</em>}</b><small>{option.desc}</small>
            </button>
          ))}
        </div>

        <div className="route-summary-card">
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
          <p className="route-helper">노선은 출발역 선택 시 자동으로 맞춰져요. 방향은 다음 단계에서 경로 기반 자동 계산으로 바꿀 예정이에요.</p>
        </div>

        <label className="field optional-transfer-field">
          <span>환승역이 있다면 입력</span>
          <input value={transferStationsInput} onChange={(event) => setTransferStationsInput(event.target.value)} placeholder="예: 교대역, 고속터미널역" />
          <small>지도앱에서 확인한 환승역을 쉼표로 입력하면 구간별 위치 안내로 나눠 보여드려요.</small>
        </label>

        <label className="toggle"><input type="checkbox" checked={avoidPrioritySeatArea} onChange={(e) => setAvoidPrioritySeatArea(e.target.checked)} /> 교통약자석 주변은 배려해서 추천</label>
        {error && <p className="error">{error}</p>}
        <button className="primary sticky-cta" type="button" onClick={() => void runRecommendation()} disabled={loading}>{loading ? <><span className="button-spinner" aria-hidden="true" />지금 탈 칸을 고르고 있어요…</> : <>지금 추천받기 <span aria-hidden="true">→</span></>}</button>
      </form>


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
