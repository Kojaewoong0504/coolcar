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
  if (result.routeChoice?.mode === 'ANCHOR_WINDOW') {
    const station = result.routeChoice.station ?? (needsTransfer ? '환승역' : '도착역');
    return `${station}에서 가까운 칸 주변 후보를 먼저 보고, 그 안에서 덜 덥고 덜 붐비는 쪽을 골랐어요.`;
  }
  if (result.routeGuidance.status === 'needs_route') return '환승역이 아직 정해지지 않아 빠른 환승문은 반영하지 못했어요. 이번 추천은 출발 구간의 쾌적도 기준이에요.';
  if (needsTransfer) return '확인된 환승 위치가 없는 구간은 환승 가까운 칸이라고 확정하지 않고, 쾌적도 중심으로 추천해요.';
  if (result.request.comfortType === 'HOT_SENSITIVE') return '더운 날에 덜 답답하고 비교적 시원하게 탈 수 있는 위치예요.';
  if (result.request.comfortType === 'COLD_SENSITIVE') return '찬바람이 부담스러울 때 너무 춥지 않은 쪽을 우선했어요.';
  if (result.request.comfortType === 'CROWD_AVOIDER') return '사람이 몰리는 구간을 피하기 쉬운 쪽을 우선했어요.';
  return '시원함, 혼잡함, 내리는 동선을 함께 보고 무난한 위치를 골랐어요.';
}

function routeStatusLabel(result: RecommendationResponse, needsTransfer: boolean) {
  if (result.routeChoice?.mode === 'ANCHOR_WINDOW') return needsTransfer ? '환승 위치 반영' : '하차 위치 반영';
  if (result.routeGuidance.status === 'needs_route') return '쾌적도 중심 추천';
  if (needsTransfer) return '쾌적도 중심 추천';
  return '쾌적칸 추천';
}

function directionStatusLabel(result: RecommendationResponse) {
  return result.request.direction ? `${result.request.line} · 이동 방향 자동 계산` : `${result.request.line} · 방면 미입력`;
}

function routeBasisCopy(result: RecommendationResponse, needsTransfer: boolean) {
  if (result.routeChoice?.mode === 'ANCHOR_WINDOW') {
    const station = result.routeChoice.station ?? (needsTransfer ? '환승역' : '도착역');
    const anchorLabels = result.routeChoice.anchorDoorLabels?.length ? result.routeChoice.anchorDoorLabels.join(', ') : undefined;
    const anchor = anchorLabels ?? (result.routeChoice.anchorCarNo ? `${result.routeChoice.anchorCarNo}번째 칸` : '가까운 칸');
    const candidates = result.routeChoice.candidateCarNos.length ? `(${result.routeChoice.candidateCarNos.join(', ')}번째 칸)` : '';
    return `${station} ${anchor} 주변 ${candidates}을 먼저 비교한 뒤, 그중 쾌적도가 나은 ${result.recommendedCar.label}을 골랐어요.`;
  }
  if (result.routeGuidance.status === 'needs_route') {
    return `${result.request.destinationStation || '목적지'}까지는 환승이 필요할 수 있지만, 환승역이 아직 정해지지 않아 ${result.recommendedCar.label}이 빠른 환승에 가장 가깝다는 뜻은 아니에요.`;
  }
  if (needsTransfer) return '확인된 환승 위치가 없는 구간은 환승 거리보다 덜 덥고 덜 붐비는 위치를 우선했어요.';
  return '선택한 구간에서 덜 덥고 덜 붐빌 가능성이 높은 칸을 비교했어요.';
}

function routePathCopy(result: RecommendationResponse) {
  const transfers = result.request.transferStations?.filter(Boolean) ?? [];
  if (transfers.length > 0) return [result.request.originStation, ...transfers, result.request.destinationStation || '목적지'].join(' → ');
  return `${result.request.originStation} → ${result.request.destinationStation || '목적지'}`;
}

function legStatusCopy(status: RecommendationResponse['routeGuidance']['legs'][number]['status']) {
  if (status === 'available') return '위치 안내 가능';
  if (status === 'needs_direction') return '쾌적칸 중심';
  if (status === 'needs_route') return '쾌적칸 중심';
  return '승강장 참고';
}

function legActionCopy(status: RecommendationResponse['routeGuidance']['legs'][number]['status']) {
  if (status === 'available') return '타세요';
  if (status === 'needs_direction') return '위치를 참고해 주세요';
  if (status === 'needs_route') return '위치를 참고해 주세요';
  return '위치를 참고해 주세요';
}

export default function ResultPage() {
  const [stored, setStored] = useState<StoredResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'pending' | 'sent' | 'mock' | 'error'>('idle');
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saved' | 'mock' | 'error'>('idle');
  const [activeLegIndex, setActiveLegIndex] = useState(0);
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
            setActiveLegIndex(0);
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
      setActiveLegIndex(0);
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
      transferStations: request.transferStations?.join(', ') ?? '',
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
  const destinationLine = result.request.destinationLine ?? stored.context?.destinationLine;
  const hasExplicitTransfers = Boolean(result.request.transferStations?.filter(Boolean).length);
  const needsTransfer = result.routeGuidance.status === 'needs_route'
    || result.routeGuidance.status === 'limited'
    || hasExplicitTransfers
    || Boolean(destinationLine && destinationLine !== result.request.line);
  const anonymousId = getAnonymousId();
  const hasAnchorWindow = result.routeChoice?.mode === 'ANCHOR_WINDOW';
  const routePath = routePathCopy(result);
  const routeBasis = routeBasisCopy(result, needsTransfer);
  const activeLeg = result.routeGuidance.legs[Math.min(activeLegIndex, Math.max(result.routeGuidance.legs.length - 1, 0))];
  const nextLeg = result.routeGuidance.legs[Math.min(activeLegIndex, Math.max(result.routeGuidance.legs.length - 1, 0)) + 1];
  const hasMultipleLegs = result.routeGuidance.legs.length > 1;

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
        <div className="badges consumer-badges compact-result-badges">
          <span>{routeStatusLabel(result, needsTransfer)}</span>
          <span>{hasAnchorWindow ? '쾌적도 비교' : result.routeGuidance.status === 'needs_route' ? '쾌적도 중심' : comfortCopy(result)}</span>
        </div>
        <p className="eyebrow">{hasAnchorWindow ? '환승 가까운 쾌적칸' : '지금 타기 좋은 위치'}</p>
        <h1>{result.recommendedCar.carNo}번째 칸으로 가세요</h1>
        <div className="route-proof-card" aria-label="추천 기준과 경로 확인 상태">
          <div>
            <span>경로</span>
            <strong>{routePath}</strong>
          </div>
          <div>
            <span>방면</span>
            <strong>{directionStatusLabel(result)}</strong>
          </div>
          <div>
            <span>추천 기준</span>
            <strong>{hasAnchorWindow ? '환승·하차 위치 주변 + 쾌적도' : result.routeGuidance.status === 'needs_route' ? '쾌적도 중심' : comfortCopy(result)}</strong>
          </div>
        </div>
        <p className="score">{routePath} · {hasAnchorWindow ? '가까운 칸 주변에서 선택' : comfortCopy(result)}</p>
        <p className="source-message result-one-line-reason">{friendlyReason(result, needsTransfer)}</p>
        <p className="transfer-proof-copy">{routeBasis}</p>
        <p className="microcopy">실시간 온도 측정이 아니라 공공·정적 규칙, 시간대 패턴, 이용자 제보를 바탕으로 한 참고용 추천이에요.</p>
        <div className="train-map" aria-label="지하철 칸별 추천 위치">
          <div className="train-map-head">
            <span>칸 위치 보기</span>
            <small>{hasAnchorWindow ? '환승 가까운 범위 안에서 골랐어요' : '파란 칸으로 가면 돼요'}</small>
          </div>
          <div className="cars result-cars">
            {result.cars.map((car) => {
              const isBest = car.carNo === result.recommendedCar.carNo;
              const isAnchor = hasAnchorWindow && (result.routeChoice.anchorCarNos?.includes(car.carNo) ?? car.carNo === result.routeChoice.anchorCarNo);
              const isCandidate = hasAnchorWindow && result.routeChoice.candidateCarNos.includes(car.carNo);
              const isAvoid = !isCandidate && result.avoidCars.some((avoid) => avoid.carNo === car.carNo);
              const className = isBest ? 'car best' : isAnchor ? 'car anchor' : isCandidate ? 'car candidate' : isAvoid ? 'car avoid' : 'car';
              const label = isBest ? '추천' : isAnchor ? '환승' : isCandidate ? '가능' : isAvoid ? '피하기' : '';
              return (
                <div key={car.carNo} className={className} aria-label={`${car.carNo}번째 칸${isBest ? ' 추천' : isAnchor ? ' 환승 가까움' : isCandidate ? ' 허용 범위' : isAvoid ? ' 피하면 좋아요' : ''}`}>
                  {label && <span className="best-badge">{label}</span>}
                  <strong>{car.carNo}</strong>
                  <em>{isBest ? '여기' : isAnchor ? '가까움' : isCandidate ? '주변' : isAvoid ? '피하기' : car.position === 'front' ? '앞쪽' : car.position === 'back' ? '뒤쪽' : '중앙'}</em>
                </div>
              );
            })}
          </div>
        </div>
        {hasAnchorWindow && <p className="transfer-note">가장 가까운 칸만 고르지 않고, 그 양옆 칸까지 비교해서 덜 덥고 덜 붐비는 쪽을 추천했어요.</p>}
        {!hasAnchorWindow && needsTransfer && <p className="transfer-note">확인된 환승 위치가 없는 구간은 쾌적칸 중심으로 추천해요. 환승 가까운 칸 데이터는 지원 역부터 확대 중이에요.</p>}
        <div className="result-actions">
          <button type="button" onClick={() => void saveRoute()} disabled={saveState === 'pending' || saveState === 'saved'}>{saveState === 'pending' ? '저장 중…' : saveState === 'saved' ? '저장 완료' : '루틴 저장하기'}</button>
          <Link href={backHref}>다시 추천</Link>
        </div>
        {saveState === 'saved' && <p className="ok">퇴근 루틴에 저장했어요.</p>}
        {saveState === 'mock' && <p className="ok">저장했어요.</p>}
        {saveState === 'error' && <p className="error">잠시 후 다시 시도해 주세요.</p>}
      </section>

      {activeLeg && (
        <section className="card active-leg-card" aria-label="현재 탑승 구간 안내">
          <div className="active-leg-head">
            <span>{hasMultipleLegs ? `현재 구간 ${Math.min(activeLegIndex + 1, result.routeGuidance.legs.length)} / ${result.routeGuidance.legs.length}` : '현재 구간'}</span>
            <em>{legStatusCopy(activeLeg.status)}</em>
          </div>
          <h2>{activeLeg.fromStation} → {activeLeg.toStation}</h2>
          <p className="route-leg-meta">{activeLeg.line}{activeLeg.direction ? ' · 이동 방향 자동 계산' : ''}</p>
          <div className={activeLeg.status === 'available' ? 'door-tip available' : 'door-tip pending'}>
            <span>{activeLeg.goal === 'NEXT_TRANSFER' ? '다음 환승 기준' : '하차 기준'}</span>
            <strong>{activeLeg.positionLabel} {legActionCopy(activeLeg.status)}</strong>
            {activeLegIndex === 0 && result.routeChoice.mode === 'ANCHOR_WINDOW' && result.routeChoice.anchorDoorLabels?.length ? <small>{result.routeChoice.anchorDoorLabels.join(', ')} 근처가 편해요.</small> : activeLeg.anchorCarNo != null && activeLeg.anchorDoorNo != null && <small>{activeLeg.anchorCarNo}번째 칸 · {activeLeg.anchorDoorNo}번 문 근처가 편해요.</small>}
            {activeLeg.candidateCarNos?.length ? <small>{activeLeg.candidateCarNos.join(', ')}번째 칸도 비슷한 범위예요.</small> : null}
          </div>
          <p className="microcopy">{activeLeg.message}</p>
          {nextLeg ? (
            <div className="next-leg-preview">
              <span>다음 구간</span>
              <strong>{nextLeg.fromStation} → {nextLeg.toStation}</strong>
              <small>{nextLeg.line} · {legStatusCopy(nextLeg.status)}</small>
              <button type="button" onClick={() => setActiveLegIndex((index) => Math.min(index + 1, result.routeGuidance.legs.length - 1))}>환승했어요 · 다음 구간 보기</button>
            </div>
          ) : hasMultipleLegs ? (
            <p className="ok">마지막 구간이에요. 도착역 안내를 확인해 주세요.</p>
          ) : null}
          {activeLegIndex > 0 && <button className="ghost active-leg-back" type="button" onClick={() => setActiveLegIndex((index) => Math.max(index - 1, 0))}>← 이전 구간</button>}
        </section>
      )}

      <section className="card result-why-card result-info-card">
        <div className="section-row">
          <div>
            <div className="section-title">왜 이 칸인가요?</div>
            <p>핵심 이유만 짧게 정리했어요.</p>
          </div>
        </div>
        <ul className="reasons compact-reasons">
          {result.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}
          {result.avoidCars.length > 0 && <li>피하면 좋은 위치: {result.avoidCars.map((car) => `${car.carNo}번째 칸`).join(', ')}</li>}
        </ul>
      </section>

      <section className="card feedback result-info-card">
        <div className="section-row">
          <div>
            <div className="section-title">추천이 어땠나요?</div>
            <p>한 번만 눌러주면 다음 추천에 반영할게요.</p>
          </div>
        </div>
        <div className="feedback-buttons">
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('HOT')}>🥵 더웠어요</button>
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('COLD')}>🥶 추웠어요</button>
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('CROWDED')}>👥 붐볐어요</button>
          <button disabled={feedbackState === 'pending'} onClick={() => void sendFeedback('WRONG')}>🔁 환승이 멀었어요</button>
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
