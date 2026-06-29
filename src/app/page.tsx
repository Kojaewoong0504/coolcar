'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { UserProfilePill } from '@/components/auth/UserProfilePill';
import { SUPPORTED_LINES } from '@/lib/stations';
import type { Station } from '@/lib/stations';
import type { ComfortType, RecommendationResponse } from '@/lib/types';

const comfortOptions: { label: string; value: ComfortType; desc: string; emoji: string }[] = [
  { label: '더위형', value: 'HOT_SENSITIVE', desc: '시원한 칸 우선', emoji: '🧊' },
  { label: '추위형', value: 'COLD_SENSITIVE', desc: '약냉방·중앙', emoji: '🧣' },
  { label: '혼잡회피', value: 'CROWD_AVOIDER', desc: '덜 붐비는 칸', emoji: '🫧' },
  { label: '밸런스', value: 'BALANCED', desc: '균형 추천', emoji: '⚖️' },
];

const lines = [...SUPPORTED_LINES];
type StationHit = Pick<Station, 'name' | 'line' | 'operator'>;
type PickerTarget = 'origin' | 'destination' | null;

function sourceLabel(type: string) {
  return type === 'REALTIME_CAR' ? '실측' : type === 'STATISTICAL_CAR' ? '통계' : type === 'USER_FEEDBACK' ? '커뮤니티' : '추정';
}
function confidenceLabel(confidence: string) {
  return confidence === 'HIGH' ? '신뢰도 높음' : confidence === 'MEDIUM' ? '신뢰도 보통' : '신뢰도 낮음';
}
function sourceTone(result: RecommendationResponse) {
  if (result.sourceMeta.confidence === 'LOW') return '실시간 칸별 데이터가 부족해 시간대 패턴으로 참고 추천했어요.';
  if (result.fallbackUsed) return '캐시·통계 기반으로 계산했어요. 실제 열차 상황과 다를 수 있어요.';
  return '공식 통계와 냉방 규칙을 함께 반영했어요.';
}
function comfortLabel(value: ComfortType) {
  return comfortOptions.find((option) => option.value === value)?.label ?? '내 기준';
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

export default function HomePage() {
  const [anonymousId, setAnonymousId] = useState<string>();
  const [comfortType, setComfortType] = useState<ComfortType>('HOT_SENSITIVE');
  const [line, setLine] = useState('2호선');
  const [originStation, setOriginStation] = useState('강남역');
  const [destinationStation, setDestinationStation] = useState('홍대입구역');
  const [direction, setDirection] = useState('내선');
  const [avoidPrioritySeatArea, setAvoidPrioritySeatArea] = useState(true);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackState, setFeedbackState] = useState<'idle' | 'sent' | 'mock' | 'error'>('idle');
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'mock' | 'error'>('idle');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerLine, setPickerLine] = useState(line);
  const [pickerStations, setPickerStations] = useState<StationHit[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const selectedComfort = useMemo(() => comfortOptions.find((o) => o.value === comfortType), [comfortType]);

  useEffect(() => {
    (window as Window & { coolcarHydrated?: boolean }).coolcarHydrated = true;
    setAnonymousId(getAnonymousId());
    const params = new URLSearchParams(window.location.search);
    const nextLine = params.get('line');
    const nextOrigin = params.get('originStation');
    const nextDestination = params.get('destinationStation');
    const nextDirection = params.get('direction');
    const nextComfortType = params.get('comfortType') as ComfortType | null;
    if (nextLine) setLine(nextLine);
    if (nextOrigin) setOriginStation(nextOrigin);
    if (nextDestination) setDestinationStation(nextDestination);
    if (nextDirection) setDirection(nextDirection);
    if (nextComfortType && comfortOptions.some((option) => option.value === nextComfortType)) setComfortType(nextComfortType);
  }, []);

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
    setFeedbackState('idle');
    setSaveState('idle');
    if (!line || !originStation) {
      setError('노선과 출발역은 꼭 필요해요.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line, originStation, destinationStation, direction, comfortType, waitToleranceMin: 3, avoidPrioritySeatArea, anonymousId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? '추천을 계산하지 못했어요.');
      setResult(json);
      setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : '추천 중 문제가 생겼어요.');
    } finally {
      setLoading(false);
    }
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
    if (pickerTarget === 'destination') setDestinationStation(station.name);
    setPickerTarget(null);
  }

  async function sendFeedback(feedbackType: 'GOOD' | 'HOT' | 'COLD' | 'CROWDED' | 'WRONG') {
    if (!result) return;
    setFeedbackState('idle');
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId: result.recommendationId, anonymousId, line, station: originStation, direction, carNo: result.recommendedCar.carNo, feedbackType }),
    });
    if (!response.ok) {
      setFeedbackState('error');
      return;
    }
    const json = await response.json().catch(() => ({}));
    setFeedbackState(json.persisted === false ? 'mock' : 'sent');
  }

  async function saveRoute() {
    setSaveState('idle');
    const response = await fetch('/api/routes/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId, line, originStation, destinationStation, direction, comfortType, label: `${originStation} → ${destinationStation || '목적지'}`, isDefault: false }),
    });
    if (!response.ok) {
      setSaveState('error');
      return;
    }
    const json = await response.json().catch(() => ({}));
    setSaveState(json.persisted === false ? 'mock' : 'saved');
  }

  return (
    <main className="shell with-tabbar">
      <header className="topbar app-topbar">
        <div className="logo"><span className="logo-mark">🧊</span><span>시원칸</span></div>
        <UserProfilePill />
      </header>

      <section className="hero-card home-hero">
        <div className="hero-orb" aria-hidden="true" />
        <p className="eyebrow">퇴근길 쾌적칸 추천</p>
        <h1>노선도 말고,<br />어디 탈지만.</h1>
        <p>더위, 추위, 혼잡도를 합쳐 지금 가장 쾌적한 칸을 골라드려요.</p>
        <div className="hero-stats"><span><b>30초</b>입력 완료</span><span><b>무료</b>추천 가능</span><span><b>3초</b>결론 확인</span></div>
      </section>

      <form className="card form trip-card" onSubmit={submit}>
        <div className="section-row"><div><div className="section-title">오늘의 기준</div><p>내가 피하고 싶은 불편함을 먼저 골라요.</p></div></div>
        <div className="segmented-pills" role="group" aria-label="추천 성향">
          {comfortOptions.map((option) => (
            <button key={option.value} type="button" className={option.value === comfortType ? 'segment active' : 'segment'} onClick={() => setComfortType(option.value)}>
              <span>{option.emoji}</span><b>{option.label}</b><small>{option.desc}</small>
            </button>
          ))}
        </div>

        <div className="route-summary-card">
          <button className="route-row route-select-row" type="button" onClick={() => openStationPicker('origin')} aria-label="출발역 선택">
            <span className="route-label">출발</span>
            <span className="route-value">{originStation}</span>
            <span className="route-badge">{line}</span>
          </button>
          <button className="route-row route-select-row" type="button" onClick={() => openStationPicker('destination')} aria-label="도착역 선택">
            <span className="route-label">도착</span>
            <span className="route-value">{destinationStation || '목적지 선택'}</span>
            <span className="route-badge subtle">변경</span>
          </button>
          <p className="route-helper">노선은 출발역 선택 시 자동으로 맞춰져요. 방향은 다음 단계에서 경로 기반 자동 계산으로 바꿀 예정이에요.</p>
        </div>

        <label className="toggle"><input type="checkbox" checked={avoidPrioritySeatArea} onChange={(e) => setAvoidPrioritySeatArea(e.target.checked)} /> 교통약자석 주변은 배려해서 추천</label>
        {error && <p className="error">{error}</p>}
        <button className="primary sticky-cta" type="button" onClick={() => void runRecommendation()} disabled={loading}>{loading ? '지금 탈 칸을 고르고 있어요…' : '지금 추천받기'}</button>
      </form>

      {loading && <section className="card skeleton"><h2>칸별 쾌적도를 계산 중이에요</h2><div /></section>}

      {result && (
        <section className="result-stack" id="result">
          <article className="card result-card hero-result">
            <div className="badges"><span>{sourceLabel(result.sourceMeta.sourceType)}</span><span>{confidenceLabel(result.sourceMeta.confidence)}</span>{result.fallbackUsed && <span>대체 계산</span>}</div>
            <p className="eyebrow">지금은 여기</p>
            <h2>{result.recommendedCar.label}</h2>
            <p className="score">{originStation} → {destinationStation || '목적지'} · {comfortLabel(comfortType)} 기준</p>
            <p className="source-message">{sourceTone(result)}</p>
            <div className="result-actions"><button type="button" onClick={() => void saveRoute()}>루틴 저장하기</button><button type="button" onClick={() => void runRecommendation()}>다시 계산</button></div>
            {saveState === 'saved' && <p className="ok">퇴근 루틴에 저장했어요.</p>}
            {saveState === 'mock' && <p className="ok">저장했어요.</p>}
            {saveState === 'error' && <p className="error">잠시 후 다시 시도해 주세요.</p>}
          </article>

          <article className="card metrics-card">
            <div><span>{result.recommendedCar.coolingScore}</span><b>시원함</b></div>
            <div><span>{result.recommendedCar.crowdScore}</span><b>혼잡 여유</b></div>
            <div><span>{result.recommendedCar.convenienceScore}</span><b>동선</b></div>
          </article>

          <article className="card">
            <div className="section-title">칸별 쾌적도</div>
            <div className="cars" aria-label="칸별 쾌적도">
              {result.cars.map((car) => (
                <div key={car.carNo} className={car.carNo === result.recommendedCar.carNo ? 'car best' : result.avoidCars.some((a) => a.carNo === car.carNo) ? 'car avoid' : 'car'}>
                  {car.carNo === result.recommendedCar.carNo && <small className="best-badge">BEST</small>}
                  <strong>{car.carNo}</strong><em>{car.totalComfortScore}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="section-title">왜 이 칸을 추천했나요?</div>
            <ul className="reasons">{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            <p className="avoid">피하면 좋은 칸: {result.avoidCars.map((c) => c.label).join(', ')}</p>
            <p className="notice">{result.safetyNotice}</p>
            <p className="source-detail"><Link href="/data-source">데이터 기준 보기</Link></p>
          </article>

          <article className="card feedback">
            <div className="section-title">방금 추천 어땠어요?</div>
            <p className="microcopy">피드백은 다음 추천에 반영돼요.</p>
            <div className="feedback-buttons">
              <button onClick={() => void sendFeedback('HOT')}>🥵 더웠어요</button>
              <button onClick={() => void sendFeedback('COLD')}>🥶 추웠어요</button>
              <button onClick={() => void sendFeedback('CROWDED')}>👥 붐볐어요</button>
              <button onClick={() => void sendFeedback('GOOD')}>👍 좋았어요</button>
              <button onClick={() => void sendFeedback('WRONG')}>위치가 달랐어요</button>
            </div>
            {feedbackState === 'sent' && <p className="ok">다음 추천에 반영했어요.</p>}
            {feedbackState === 'mock' && <p className="ok">피드백을 받았어요.</p>}
            {feedbackState === 'error' && <p className="error">잠시 후 다시 시도해 주세요.</p>}
          </article>
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
