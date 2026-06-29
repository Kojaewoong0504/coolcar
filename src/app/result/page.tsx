'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { RecommendRequest, RecommendationResponse } from '@/lib/types';

type StoredResult = {
  result: RecommendationResponse;
  context?: { destinationLine?: string };
};

type PendingRecommendation = {
  request: RecommendRequest;
  context?: { destinationLine?: string };
};

function getAnonymousId() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem('coolcar_anonymous_id') ?? undefined;
}

function comfortCopy(result: RecommendationResponse) {
  const type = result.request.comfortType;
  if (type === 'HOT_SENSITIVE') return '시원하게 가고 싶은 기준';
  if (type === 'COLD_SENSITIVE') return '너무 춥지 않게 가는 기준';
  if (type === 'CROWD_AVOIDER') return '붐비는 곳을 피하는 기준';
  return '전체적으로 무난한 기준';
}

function friendlyReason(result: RecommendationResponse, needsTransfer: boolean) {
  if (needsTransfer) return '환승할 가능성이 있어 내릴 때 움직임이 적은 위치를 우선했어요.';
  if (result.request.comfortType === 'HOT_SENSITIVE') return '더운 날에 덜 답답하고 비교적 시원하게 탈 수 있는 위치예요.';
  if (result.request.comfortType === 'COLD_SENSITIVE') return '찬바람이 부담스러울 때 너무 춥지 않은 쪽을 우선했어요.';
  if (result.request.comfortType === 'CROWD_AVOIDER') return '사람이 몰리는 구간을 피하기 쉬운 쪽을 우선했어요.';
  return '시원함, 혼잡함, 내리는 동선을 함께 보고 무난한 위치를 골랐어요.';
}

export default function ResultPage() {
  const [stored, setStored] = useState<StoredResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'pending' | 'sent' | 'mock' | 'error'>('idle');
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saved' | 'mock' | 'error'>('idle');
  const recommendationStarted = useRef(false);

  useEffect(() => {
    const pendingRaw = window.sessionStorage.getItem('coolcar_pending_recommendation');
    if (pendingRaw) {
      if (recommendationStarted.current) return;
      recommendationStarted.current = true;
      try {
        const pending = JSON.parse(pendingRaw) as PendingRecommendation;
        fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pending.request),
        })
          .then(async (response) => {
            const json = await response.json();
            if (!response.ok) throw new Error(json.error?.message ?? '추천을 계산하지 못했어요.');
            const nextStored = { result: json as RecommendationResponse, context: pending.context };
            window.sessionStorage.setItem('coolcar_last_result', JSON.stringify(nextStored));
            window.sessionStorage.removeItem('coolcar_pending_recommendation');
            window.history.replaceState(null, '', '/result');
            setStored(nextStored);
          })
          .catch((caught) => setError(caught instanceof Error ? caught.message : '추천 중 문제가 생겼어요.'))
          .finally(() => setLoading(false));
      } catch {
        window.sessionStorage.removeItem('coolcar_pending_recommendation');
        setError('추천 정보를 다시 선택해 주세요.');
        setLoading(false);
      }
      return;
    }

    const raw = window.sessionStorage.getItem('coolcar_last_result');
    if (!raw) {
      setLoading(false);
      return;
    }
    try {
      setStored(JSON.parse(raw) as StoredResult);
    } catch {
      setStored(null);
    }
    setLoading(false);
  }, []);

  const backHref = useMemo(() => {
    if (!stored) return '/';
    const request = stored.result.request;
    const params = new URLSearchParams({
      line: request.line,
      originStation: request.originStation,
      destinationStation: request.destinationStation ?? '',
      destinationLine: stored.context?.destinationLine ?? '',
      comfortType: request.comfortType,
      direction: request.direction ?? '',
    });
    return `/?${params.toString()}`;
  }, [stored]);

  if (loading) {
    return (
      <main className="shell with-tabbar result-loading-page">
        <section className="card result-loading-card">
          <div className="cool-spinner" aria-hidden="true">🧊</div>
          <p className="eyebrow">추천 계산 중</p>
          <h1>지금 타기 좋은 칸을 고르고 있어요</h1>
          <p>덜 덥고, 덜 붐비고, 내릴 때 덜 걷는 위치를 찾는 중이에요.</p>
          <div className="loading-steps" aria-label="추천 진행 단계">
            <span>출발·도착 확인</span>
            <span>칸별 쾌적도 비교</span>
            <span>동선까지 확인</span>
          </div>
        </section>
      </main>
    );
  }

  if (!stored) {
    return (
      <main className="shell with-tabbar">
        <section className="card empty result-empty">
          <h1>{error ? '추천을 다시 시도해 주세요' : '아직 추천 결과가 없어요'}</h1>
          <p>{error || '출발역과 도착역을 고르면 바로 탈 위치를 알려드릴게요.'}</p>
          <Link className="primary" href="/">추천받으러 가기</Link>
        </section>
      </main>
    );
  }

  const { result } = stored;
  const destinationLine = stored.context?.destinationLine;
  const needsTransfer = Boolean(destinationLine && destinationLine !== result.request.line);
  const anonymousId = getAnonymousId();

  async function sendFeedback(feedbackType: 'GOOD' | 'HOT' | 'COLD' | 'CROWDED' | 'WRONG') {
    if (feedbackState === 'pending') return;
    setFeedbackState('pending');
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recommendationId: result.recommendationId,
        anonymousId,
        line: result.request.line,
        station: result.request.originStation,
        direction: result.request.direction,
        carNo: result.recommendedCar.carNo,
        feedbackType,
      }),
    });
    if (!response.ok) return setFeedbackState('error');
    const json = await response.json().catch(() => ({}));
    setFeedbackState(json.persisted === false ? 'mock' : 'sent');
  }

  async function saveRoute() {
    if (saveState === 'pending' || saveState === 'saved') return;
    setSaveState('pending');
    const response = await fetch('/api/routes/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId,
        line: result.request.line,
        originStation: result.request.originStation,
        destinationStation: result.request.destinationStation,
        direction: result.request.direction,
        comfortType: result.request.comfortType,
        label: `${result.request.originStation} → ${result.request.destinationStation || '목적지'}`,
        isDefault: false,
      }),
    });
    if (!response.ok) return setSaveState('error');
    const json = await response.json().catch(() => ({}));
    setSaveState(json.persisted === false ? 'mock' : 'saved');
  }

  return (
    <main className="shell with-tabbar result-page">
      <header className="topbar app-topbar">
        <Link className="ghost" href={backHref}>← 다시 고르기</Link>
        <span className="result-kicker">추천 결과</span>
      </header>

      <section className="card result-card hero-result result-page-card">
        <div className="badges consumer-badges">
          <span>추천 완료</span>
          <span>{needsTransfer ? '환승 동선 고려' : '내리는 동선 고려'}</span>
        </div>
        <p className="eyebrow">지금 타기 좋은 위치</p>
        <h1>{result.recommendedCar.label}</h1>
        <p className="score">{result.request.originStation} → {result.request.destinationStation || '목적지'} · {comfortCopy(result)}</p>
        <p className="source-message">{friendlyReason(result, needsTransfer)}</p>
        {needsTransfer && <p className="transfer-note">환승역 구조를 더 정확히 붙이면, 다음 버전에서는 환승 게이트와 가까운 칸을 우선 추천할 수 있어요.</p>}
        <div className="result-actions">
          <button type="button" onClick={() => void saveRoute()} disabled={saveState === 'pending' || saveState === 'saved'}>{saveState === 'pending' ? '저장 중…' : saveState === 'saved' ? '저장 완료' : '루틴 저장하기'}</button>
          <Link href={backHref}>다시 추천</Link>
        </div>
        {saveState === 'saved' && <p className="ok">퇴근 루틴에 저장했어요.</p>}
        {saveState === 'mock' && <p className="ok">저장했어요.</p>}
        {saveState === 'error' && <p className="error">잠시 후 다시 시도해 주세요.</p>}
      </section>

      <section className="card result-why-card">
        <div className="section-title">왜 여기인가요?</div>
        <ul className="reasons">
          <li>{friendlyReason(result, needsTransfer)}</li>
          {result.recommendedCar.isWeakAc && <li>약냉방칸이라 추위를 많이 타는 사람에게 더 편할 수 있어요.</li>}
          {result.avoidCars.length > 0 && <li>피하면 좋은 위치: {result.avoidCars.map((car) => car.label).join(', ')}</li>}
        </ul>
      </section>

      <section className="card feedback">
        <div className="section-title">방금 추천 어땠어요?</div>
        <p className="microcopy">한 번만 눌러주면 다음 추천이 더 좋아져요.</p>
        <div className="feedback-buttons">
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('HOT')}>🥵 더웠어요</button>
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('COLD')}>🥶 추웠어요</button>
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('CROWDED')}>👥 붐볐어요</button>
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('GOOD')}>👍 좋았어요</button>
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('WRONG')}>위치가 달랐어요</button>
        </div>
        {feedbackState === 'pending' && <p className="microcopy">반영 중이에요…</p>}
        {feedbackState === 'sent' && <p className="ok">다음 추천에 반영했어요.</p>}
        {feedbackState === 'mock' && <p className="ok">피드백을 받았어요.</p>}
        {feedbackState === 'error' && <p className="error">잠시 후 다시 시도해 주세요.</p>}
      </section>

      <nav className="tabbar"><Link href="/">홈</Link><Link href="/saved">저장</Link><Link href="/data-source">데이터</Link><Link href="/settings">설정</Link></nav>
    </main>
  );
}
