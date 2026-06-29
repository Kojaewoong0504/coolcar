'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ComfortType, RecommendationResponse } from '@/lib/types';

const comfortOptions: { label: string; value: ComfortType; desc: string; emoji: string }[] = [
  { label: '더위형', value: 'HOT_SENSITIVE', desc: '시원한 칸 우선', emoji: '🧊' },
  { label: '추위형', value: 'COLD_SENSITIVE', desc: '약냉방·중앙 선호', emoji: '🧣' },
  { label: '혼잡회피', value: 'CROWD_AVOIDER', desc: '덜 붐비는 칸', emoji: '🫧' },
  { label: '밸런스', value: 'BALANCED', desc: '냉방+동선 균형', emoji: '⚖️' },
];

const lines = ['2호선', '9호선', '신분당선', '수인분당선', '1호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선'];
type StationHit = { name: string; line: string; operator: string };

function sourceLabel(type: string) {
  return type === 'REALTIME_CAR' ? '실측' : type === 'STATISTICAL_CAR' ? '통계' : type === 'USER_FEEDBACK' ? '커뮤니티' : '추정';
}
function confidenceLabel(confidence: string) {
  return confidence === 'HIGH' ? '신뢰도 높음' : confidence === 'MEDIUM' ? '신뢰도 보통' : '신뢰도 낮음';
}
function sourceTone(result: RecommendationResponse) {
  if (result.sourceMeta.confidence === 'LOW') return '실시간 칸별 데이터가 없어 참고 추천으로 안내해요.';
  if (result.fallbackUsed) return '대체 계산을 사용했어요. 실제 열차 상황과 다를 수 있어요.';
  return '공식/통계 데이터와 냉방 규칙을 함께 반영했어요.';
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
  const [originHits, setOriginHits] = useState<StationHit[]>([]);

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
    const q = originStation.trim();
    if (q.length < 1) return setOriginHits([]);
    const controller = new AbortController();
    fetch(`/api/stations/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => setOriginHits((j.stations ?? []).slice(0, 4)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [originStation]);

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

  async function sendFeedback(feedbackType: 'GOOD' | 'HOT' | 'COLD' | 'CROWDED' | 'WRONG') {
    if (!result) return;
    setFeedbackState('idle');
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId: result.recommendationId, anonymousId, line, station: originStation, direction, carNo: result.recommendedCar.carNo, feedbackType }),
    });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeedbackState('error');
        return;
      }
      setFeedbackState(json.persisted === false ? 'mock' : 'sent');
  }

  async function saveRoute() {
    setSaveState('idle');
    const response = await fetch('/api/routes/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymousId, line, originStation, destinationStation, direction, comfortType, label: `${originStation} → ${destinationStation || '목적지'}`, isDefault: false }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveState('error');
      return;
    }
    setSaveState(json.persisted === false ? 'mock' : 'saved');
  }

  return (
    <main className="shell with-tabbar">
      <header className="topbar">
        <div className="logo"><span className="logo-mark">🧊</span>시원칸</div>
        <a className="ghost" href="/settings">설정</a>
      </header>

      <section className="hero-card">
        <p className="eyebrow">데이터 출처 표시 · 출퇴근 모드</p>
        <h1>노선도 말고,<br />어디 탈지만.</h1>
        <p>더위·추위·혼잡을 고려해 지금 타기 좋은 지하철 칸을 3초 안에 추천해요.</p>
        <div className="hero-stats"><span><b>무료</b>MVP 데이터</span><span><b>3초</b>결론 확인</span><span><b>익명</b>첫 추천 가능</span></div>
      </section>

      <form className="card form elevated" onSubmit={submit}>
        <div className="section-row"><div><div className="section-title">내 성향</div><p>오늘 지하철에서 제일 피하고 싶은 것을 골라요.</p></div></div>
        <div className="chips">
          {comfortOptions.map((option) => (
            <button key={option.value} type="button" className={option.value === comfortType ? 'chip active' : 'chip'} onClick={() => setComfortType(option.value)}>
              <span className="chip-emoji">{option.emoji}</span><strong>{option.label}</strong><small>{option.desc}</small>
            </button>
          ))}
        </div>

        <div className="route-card">
          <label>출발<input value={originStation} onChange={(e) => setOriginStation(e.target.value)} placeholder="강남역" /></label>
          {originHits.length > 0 && <div className="suggestions">{originHits.map((hit) => <button key={`${hit.name}-${hit.line}`} type="button" onClick={() => { setOriginStation(hit.name); setLine(hit.line); }}>{hit.name} · {hit.line}</button>)}</div>}
          <label>도착<input value={destinationStation} onChange={(e) => setDestinationStation(e.target.value)} placeholder="홍대입구역" /></label>
          <div className="grid-two"><label>노선<select value={line} onChange={(e) => setLine(e.target.value)}>{lines.map((l) => <option key={l}>{l}</option>)}</select></label><label>방향<input value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="내선, 광교행" /></label></div>
        </div>

        <label className="toggle"><input type="checkbox" checked={avoidPrioritySeatArea} onChange={(e) => setAvoidPrioritySeatArea(e.target.checked)} /> 교통약자석 주변은 배려 모드로 점수 보정</label>
        <p className="microcopy">교통약자석 착석을 유도하지 않고, 객실 위치별 냉방 체감만 참고해요.</p>
        {error && <p className="error">{error}</p>}
        <button className="primary sticky-cta" type="button" onClick={() => void runRecommendation()} disabled={loading}>{loading ? '계산 중이에요…' : `${selectedComfort?.label ?? '내 성향'} 기준 지금 추천받기`}</button>
      </form>

      {loading && <section className="card skeleton"><h2>칸별 혼잡도와 냉방 패턴을 계산 중이에요</h2><div /></section>}

      {result && (
        <section className="result-stack" id="result">
          <article className="card result-card">
            <div className="badges"><span>{sourceLabel(result.sourceMeta.sourceType)}</span><span>{confidenceLabel(result.sourceMeta.confidence)}</span>{result.fallbackUsed && <span>대체 계산</span>}</div>
            <p className="eyebrow">{result.sourceMeta.confidence === 'LOW' ? '참고 추천' : '오늘의 추천'}</p>
            <h2>{result.recommendedCar.label}</h2>
            <p className="score">쾌적 예상 점수 {result.recommendedCar.totalComfortScore}</p>
            <p className="source-message">{sourceTone(result)}</p>
            <div className="result-actions"><button type="button" onClick={() => void saveRoute()}>이 경로 저장</button><button type="button" onClick={() => void runRecommendation()}>다시 계산</button></div>
            {saveState === 'saved' && <p className="ok">저장 경로에 추가했어요.</p>}
            {saveState === 'mock' && <p className="ok">이 기기에서는 저장 요청을 받았지만, 서버 저장소 연결을 확인해야 해요.</p>}
            {saveState === 'error' && <p className="error">경로 저장에 실패했어요.</p>}
          </article>

          <article className="card metrics-card">
            <div><b>시원함</b><span>{result.recommendedCar.coolingScore}</span></div>
            <div><b>혼잡 여유</b><span>{result.recommendedCar.crowdScore}</span></div>
            <div><b>동선</b><span>{result.recommendedCar.convenienceScore}</span></div>
          </article>

          <article className="card">
            <div className="section-title">칸별 보기</div>
            <div className="cars" aria-label="칸별 쾌적도">
              {result.cars.map((car) => (
                <div key={car.carNo} className={car.carNo === result.recommendedCar.carNo ? 'car best' : result.avoidCars.some((a) => a.carNo === car.carNo) ? 'car avoid' : 'car'}>
                  <strong>{car.carNo}</strong><small>{car.tags.join(' · ')}</small><em>{car.totalComfortScore}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="section-title">왜 이 칸?</div>
            <ul className="reasons">{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            <p className="avoid">피하기: {result.avoidCars.map((c) => c.label).join(', ')}</p>
            <p className="notice">{result.safetyNotice}</p>
            <p className="source-detail">데이터 기준: {result.sourceMeta.provider} · {result.sourceMeta.message}</p>
          </article>

          <article className="card feedback">
            <div className="section-title">실제로 어땠나요?</div>
            <div className="feedback-buttons">
              <button onClick={() => void sendFeedback('GOOD')}>좋았어요</button>
              <button onClick={() => void sendFeedback('HOT')}>더웠어요</button>
              <button onClick={() => void sendFeedback('COLD')}>추웠어요</button>
              <button onClick={() => void sendFeedback('CROWDED')}>붐볐어요</button>
              <button onClick={() => void sendFeedback('WRONG')}>틀렸어요</button>
            </div>
            {feedbackState === 'sent' && <p className="ok">다음 추천 통계에 반영했어요.</p>}
            {feedbackState === 'mock' && <p className="ok">피드백 요청은 받았지만, 서버 저장소 연결을 확인해야 해요.</p>}
            {feedbackState === 'error' && <p className="error">피드백 저장에 실패했어요.</p>}
          </article>
        </section>
      )}

      <nav className="tabbar"><a className="active" href="/">홈</a><a href="/saved">저장</a><a href="/data-source">데이터</a><a href="/settings">설정</a></nav>
    </main>
  );
}
