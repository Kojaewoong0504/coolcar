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

function writeStoredRoutineRequest(routeId: string, payload: StoredRoutineRequest) {
  if (typeof window === 'undefined') return;
  const current = readStoredRoutineRequests();
  current[routeId] = payload;
  window.localStorage.setItem('coolcar_saved_route_requests', JSON.stringify(current));
}

function getAnonymousId() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem('coolcar_anonymous_id') ?? undefined;
}

function comfortCopy(result: RecommendationResponse) {
  return '시원한 칸 기준';
}

function comfortShortCopy(result: RecommendationResponse) {
  return '시원칸 기준';
}

function routeStatusLabel(result: RecommendationResponse, needsTransfer: boolean) {
  if (result.routeChoice?.mode === 'ANCHOR_WINDOW') return needsTransfer ? '환승 위치 반영' : '하차 위치 반영';
  if (result.routeGuidance.status === 'needs_route') return '쾌적도 중심 추천';
  if (needsTransfer) return '쾌적도 중심 추천';
  return '쾌적칸 추천';
}

function lineCarCount(line?: string) {
  return line === '9호선' || line === '신분당선' ? 6 : 10;
}

function carPositionLabel(carNo: number, count: number) {
  if (carNo <= 2) return '앞쪽';
  if (carNo >= count - 1) return '뒤쪽';
  return '중앙';
}

function mapCarsForLine(line: string) {
  const count = lineCarCount(line);
  return Array.from({ length: count }, (_, index) => ({
    carNo: index + 1,
    position: carPositionLabel(index + 1, count),
  }));
}

function routePathCopy(result: RecommendationResponse) {
  const transfers = result.request.transferStations?.filter(Boolean) ?? [];
  if (transfers.length > 0) return [result.request.originStation, ...transfers, result.request.destinationStation || '목적지'].join(' → ');
  return `${result.request.originStation} → ${result.request.destinationStation || '목적지'}`;
}

type RouteLeg = RecommendationResponse['routeGuidance']['legs'][number];

function legStatusCopy(status: RouteLeg['status'], leg?: RouteLeg) {
  if (status === 'available') return '위치 안내 가능';
  if (status === 'needs_direction') return '쾌적칸 중심';
  if (status === 'needs_route') return '쾌적칸 중심';
  if (leg?.goal === 'FINAL_EXIT') return '쾌적칸 중심';
  return '승강장 참고';
}

function facilityLabel(facilityType?: RecommendationResponse['routeGuidance']['legs'][number]['facilityType'], facility?: string) {
  if (facilityType === 'STAIRS') return '계단';
  if (facilityType === 'ESCALATOR') return '에스컬레이터';
  if (facilityType === 'ELEVATOR') return '엘리베이터';
  if (facilityType === 'TRANSFER_PASSAGE') return '환승통로';
  return facility;
}

function egressResultCopy(leg?: RecommendationResponse['routeGuidance']['legs'][number]) {
  if (!leg || leg.goal !== 'FINAL_EXIT') return undefined;
  const label = facilityLabel(leg.facilityType, leg.facility);
  if (leg.status === 'available' && label) return `${label} 가까운 쪽`;
  return '쾌적도 기준';
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
  const activeLeg = result.routeGuidance.legs[Math.min(activeLegIndex, Math.max(result.routeGuidance.legs.length - 1, 0))];
  const nextLeg = result.routeGuidance.legs[Math.min(activeLegIndex, Math.max(result.routeGuidance.legs.length - 1, 0)) + 1];
  const hasMultipleLegs = result.routeGuidance.legs.length > 1;
  const isPrimaryLeg = !activeLeg || activeLegIndex === 0;
  const activePath = activeLeg ? `${activeLeg.fromStation} → ${activeLeg.toStation}` : routePath;
  const activeRecommendedCarNo = isPrimaryLeg ? result.recommendedCar.carNo : activeLeg?.recommendedCarNo;
  const activeCandidateCarNos = isPrimaryLeg
    ? (hasAnchorWindow ? result.routeChoice.candidateCarNos : [])
    : (activeLeg?.candidateCarNos ?? []);
  const activeAnchorCarNos = isPrimaryLeg
    ? (hasAnchorWindow ? result.routeChoice.anchorCarNos ?? (result.routeChoice.anchorCarNo ? [result.routeChoice.anchorCarNo] : []) : [])
    : (activeLeg?.anchorCarNo ? [activeLeg.anchorCarNo] : []);
  const activeHasAnchor = isPrimaryLeg && hasAnchorWindow;
  const showTrainMap = Boolean(activeRecommendedCarNo || activeCandidateCarNos.length || activeAnchorCarNos.length);
  const activeMapCars = isPrimaryLeg
    ? result.cars.map((car) => ({ carNo: car.carNo, position: car.position === 'front' ? '앞쪽' : car.position === 'back' ? '뒤쪽' : '중앙' }))
    : mapCarsForLine(activeLeg?.line ?? result.request.line);
  const activeEgressLabel = activeLeg?.goal === 'FINAL_EXIT' && activeLeg.facilityType
    ? `${facilityLabel(activeLeg.facilityType, activeLeg.facility)} 가까운 위치`
    : undefined;
  const activeEgressBadge = activeLeg?.goal === 'FINAL_EXIT' && activeLeg.facilityType
    ? activeEgressLabel
    : activeLeg?.goal === 'FINAL_EXIT'
      ? '쾌적도 픽'
      : undefined;
  const isFinalExitComfortFallback = activeLeg?.goal === 'FINAL_EXIT' && activeLeg.status !== 'available';
  const activeHeading = activeRecommendedCarNo
    ? isFinalExitComfortFallback
      ? `쾌적도 기준 ${activeRecommendedCarNo}번째 칸으로 가세요`
      : `${activeRecommendedCarNo}번째 칸으로 가세요`
    : activeLeg
      ? `${activeLeg.line} 탑승 위치를 확인해 주세요`
      : `${result.recommendedCar.carNo}번째 칸으로 가세요`;
  const activeEyebrow = activeHasAnchor ? '추천 위치' : activeLeg && !isPrimaryLeg ? (activeLeg.goal === 'FINAL_EXIT' ? '마지막 구간 안내' : '다음 구간 안내') : '지금 타기 좋은 위치';
  const activeRouteNote = activeHasAnchor ? '가까운 칸 주변에서 선택' : activeLeg && !isPrimaryLeg ? legStatusCopy(activeLeg.status, activeLeg) : comfortCopy(result);
  const displayReasons = activeLeg && !isPrimaryLeg
    ? [
        activeLeg.status === 'available'
          ? `${activeLeg.positionLabel} 쪽이 동선이 짧아요.`
          : `${activeLeg.line}에서는 ${activeLeg.positionLabel}이 가장 무난해요.`,
        activeLeg.goal === 'FINAL_EXIT'
          ? '도착하면 출구 표지판 기준으로 이동하세요.'
          : '환승 동선과 쾌적도를 같이 봤어요.',
      ]
    : result.reasons.slice(0, 2);
  const personalizationCopy = '추천·피드백은 다음 시원칸 추천에 반영돼요.';

  async function sendFeedback(feedbackType: 'GOOD' | 'HOT' | 'CROWDED' | 'WRONG') {
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
        destinationLine: destinationLine ?? result.request.destinationLine,
        direction: result.request.direction,
        comfortType: 'HOT_SENSITIVE',
        egressPreference: result.request.egressPreference,
        waitToleranceMin: result.request.waitToleranceMin,
        avoidPrioritySeatArea: result.request.avoidPrioritySeatArea,
        transferStations: result.request.transferStations,
        label: `${result.request.originStation} → ${result.request.destinationStation || '목적지'}`,
        isDefault: false,
      }),
    });
    if (!response.ok) return setSaveState('error');
    const json = await response.json().catch(() => ({}));
    if (json.route?.id) {
      writeStoredRoutineRequest(json.route.id, {
        request: result.request,
        context: { destinationLine: destinationLine ?? result.request.destinationLine },
      });
    }
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
          <span>{isPrimaryLeg ? routeStatusLabel(result, needsTransfer) : legStatusCopy(activeLeg.status, activeLeg)}</span>
          <span>{activeEgressBadge ?? (activeHasAnchor ? comfortShortCopy(result) : isPrimaryLeg ? result.routeGuidance.status === 'needs_route' ? '쾌적도 중심' : comfortCopy(result) : activeLeg.line)}</span>
        </div>
        <p className="eyebrow">{activeEyebrow}</p>
        <h1>{activeHeading}</h1>
        <div className="route-proof-card route-proof-compact" aria-label="추천 경로">
          <div>
            <span>경로</span>
            <strong>{activePath}</strong>
          </div>
          <div>
            <span>기준</span>
            <strong>{activeHasAnchor ? `환승 + ${comfortShortCopy(result)}` : isFinalExitComfortFallback ? '쾌적도' : isPrimaryLeg ? comfortCopy(result) : activeRouteNote}</strong>
          </div>
        </div>
        {showTrainMap ? (
          <div className="train-map" aria-label="지하철 칸별 추천 위치">
            <div className="train-map-head">
              <span>칸 위치 보기</span>
              <small>추천 칸만 확인하세요</small>
            </div>
            <div className="cars result-cars">
              {activeMapCars.map((car) => {
                const isBest = activeRecommendedCarNo != null && car.carNo === activeRecommendedCarNo;
                const isAnchor = activeAnchorCarNos.includes(car.carNo);
                const isCandidate = activeCandidateCarNos.includes(car.carNo);
                const isAvoid = isPrimaryLeg && !isCandidate && result.avoidCars.some((avoid) => avoid.carNo === car.carNo);
                const className = isBest ? 'car best' : isAvoid ? 'car avoid' : isAnchor ? 'car anchor' : isCandidate ? 'car candidate' : 'car';
                const label = isBest ? '추천' : isAvoid ? '피하기' : '';
                return (
                  <div key={car.carNo} className={className} aria-label={`${car.carNo}번째 칸${isBest ? ' 추천' : isAvoid ? ' 피하면 좋아요' : ''}`}>
                    {label && <span className="best-badge">{label}</span>}
                    <strong>{car.carNo}</strong>
                    <em>{isBest ? '여기' : isAvoid ? '피하기' : car.position}</em>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="door-tip neutral result-leg-placeholder">
            <span>{activeLeg?.goal === 'FINAL_EXIT' ? '마지막 구간' : '다음 구간'}</span>
            <strong>{activeLeg?.positionLabel ?? '쾌적칸 중심'}</strong>
            <small>이전 구간 칸 정보를 그대로 쓰지 않아요.</small>
          </div>
        )}
        <div className="personalization-strip" aria-label="개인화 저장 상태">
          <span>✨ 개인화</span>
          <strong>{personalizationCopy}</strong>
        </div>
        {saveState === 'saved' && <p className="ok">루틴에 저장했어요.</p>}
        {saveState === 'mock' && <p className="ok">저장했어요.</p>}
        {saveState === 'error' && <p className="error">잠시 후 다시 시도해 주세요.</p>}
      </section>

      {activeLeg && (
        <section className="card active-leg-card" aria-label="현재 탑승 구간 안내">
          <div className="active-leg-head">
            <span>{hasMultipleLegs ? `현재 구간 ${Math.min(activeLegIndex + 1, result.routeGuidance.legs.length)} / ${result.routeGuidance.legs.length}` : '현재 구간'}</span>
            <em>{legStatusCopy(activeLeg.status, activeLeg)}</em>
          </div>
          <h2>{activeLeg.fromStation} → {activeLeg.toStation}</h2>
          <p className="route-leg-meta">{activeLeg.line}{activeLeg.direction ? ' · 이동 방향 자동 계산' : ''}</p>
          <div className={activeLeg.status === 'available' ? 'door-tip available' : activeLeg.goal === 'FINAL_EXIT' ? 'door-tip neutral' : 'door-tip pending'}>
            <span>{activeLeg.goal === 'NEXT_TRANSFER' ? '다음 구간' : activeLeg.status === 'available' ? '하차 위치' : '마지막 구간'}</span>
            <strong>{activeLeg.recommendedCarNo ? `${activeLeg.recommendedCarNo}번째 칸` : activeLeg.positionLabel}</strong>
            {!activeLeg.facilityType && activeLeg.goal === 'FINAL_EXIT' && <small>내리면 출구 표지판 따라 이동하면 돼요.</small>}
          </div>
          {nextLeg ? (
            <div className="next-leg-preview">
              <span>다음 구간</span>
              <strong>{nextLeg.fromStation} → {nextLeg.toStation}</strong>
              <small>{nextLeg.line} · {legStatusCopy(nextLeg.status, nextLeg)}</small>
              <button type="button" onClick={() => setActiveLegIndex((index) => Math.min(index + 1, result.routeGuidance.legs.length - 1))}>환승했어요 · 다음 구간 보기</button>
            </div>
          ) : hasMultipleLegs ? null : null}
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
          {displayReasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
          {isPrimaryLeg && result.avoidCars.length > 0 && <li>피하면 좋은 위치: {result.avoidCars.map((car) => `${car.carNo}번째 칸`).join(', ')}</li>}
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

      <div className="sticky-save-bar" aria-label="루틴 저장 고정 버튼">
        <button type="button" onClick={() => void saveRoute()} disabled={saveState === 'pending' || saveState === 'saved'}>
          {saveState === 'pending' ? '저장 중…' : saveState === 'saved' ? '저장 완료' : '루틴 저장하기'}
        </button>
      </div>

      <nav className="tabbar"><Link href="/">홈</Link><Link href="/saved">저장</Link><Link href="/data-source">데이터</Link><Link href="/settings">설정</Link></nav>
    </main>
  );
}
