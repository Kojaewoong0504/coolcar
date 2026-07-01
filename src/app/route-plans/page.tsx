'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TabBar } from '@/components/TabBar';
import { lineColorClass } from '@/lib/metro-lines';
import type { EgressPreference, RecommendRequest, RoutePlanCandidate, RoutePlansResponse } from '@/lib/types';

const fixedComfortType = 'HOT_SENSITIVE' as const;

type PendingRoutePlan = {
  request: RecommendRequest;
  context?: { destinationLine?: string };
};

function routeStops(candidate: RoutePlanCandidate) {
  return [candidate.originStation, ...candidate.transferStations, candidate.destinationStation];
}


function coverageCopy(candidate: RoutePlanCandidate) {
  if (candidate.coverage.nextTransferDoorGuide === 'available') return '환승 위치 반영';
  if (candidate.coverage.nextTransferDoorGuide === 'needs_direction') return '쾌적칸 중심';
  if (candidate.type === 'DIRECT') return candidate.coverage.finalExitDoorGuide === 'available' ? '하차 위치 반영' : '쾌적칸 중심';
  if (candidate.type === 'UNRESOLVED') return '쾌적칸 중심';
  return '쾌적칸 중심';
}

const EGRESS_OPTIONS: Array<{ value: EgressPreference; label: string; description: string }> = [
  { value: 'ANY', label: '상관없어요', description: '쾌적도와 내리는 동선을 함께 볼게요.' },
  { value: 'STAIRS', label: '계단 가까이', description: '도착역 계단 위치를 확인할 수 있으면 반영해요.' },
  { value: 'ESCALATOR', label: '에스컬레이터 가까이', description: '에스컬레이터 쪽으로 가기 쉬운 위치를 우선 볼게요.' },
  { value: 'ELEVATOR', label: '엘리베이터 가까이', description: '엘리베이터 가까운 위치를 확인할 수 있으면 반영해요.' },
];

function egressDescription(value: EgressPreference) {
  return EGRESS_OPTIONS.find((option) => option.value === value)?.description ?? EGRESS_OPTIONS[0].description;
}

function buildRecommendRequest(base: RecommendRequest, candidate: RoutePlanCandidate): RecommendRequest {
  return {
    ...base,
    comfortType: fixedComfortType,
    line: candidate.recommendRequestPatch.line,
    destinationLine: candidate.recommendRequestPatch.destinationLine ?? base.destinationLine,
    direction: candidate.recommendRequestPatch.direction ?? base.direction,
    egressPreference: candidate.recommendRequestPatch.egressPreference ?? base.egressPreference ?? 'ANY',
    transferStations: candidate.recommendRequestPatch.transferStations ?? [],
  };
}

export default function RoutePlansPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingRoutePlan | null>(null);
  const [plans, setPlans] = useState<RoutePlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [manualTransferInput, setManualTransferInput] = useState('');
  const [manualTransfers, setManualTransfers] = useState<string[]>([]);
  const [egressPreference, setEgressPreference] = useState<EgressPreference>('ANY');
  const [manualLoading, setManualLoading] = useState(false);

  useEffect(() => {
    const raw = window.sessionStorage.getItem('coolcar_pending_route_plan');
    if (!raw) {
      setLoading(false);
      setError('출발역과 도착역을 다시 선택해 주세요.');
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PendingRoutePlan;
      const initialEgress = parsed.request.egressPreference ?? 'ANY';
      setPending(parsed);
      setEgressPreference(initialEgress);
      fetch('/api/route-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.request, comfortType: fixedComfortType, egressPreference: initialEgress, maxCandidates: 4 }),
      })
        .then(async (response) => {
          const json = await response.json();
          if (!response.ok) throw new Error(json.error?.message ?? '경로 후보를 찾지 못했어요.');
          setPlans(json as RoutePlansResponse);
        })
        .catch((caught) => setError(caught instanceof Error ? caught.message : '경로 후보를 찾지 못했어요.'))
        .finally(() => setLoading(false));
    } catch {
      setError('경로 정보를 다시 선택해 주세요.');
      setLoading(false);
    }
  }, []);

  const baseRequest = pending?.request;
  const backHref = useMemo(() => {
    if (!baseRequest) return '/';
    const params = new URLSearchParams({
      line: baseRequest.line,
      originStation: baseRequest.originStation,
      destinationStation: baseRequest.destinationStation ?? '',
      destinationLine: baseRequest.destinationLine ?? '',
      direction: baseRequest.direction ?? '',
      transferStations: baseRequest.transferStations?.join(', ') ?? '',
    });
    return `/?${params.toString()}`;
  }, [baseRequest]);

  const primaryCandidate = plans?.candidates.find((candidate) => candidate.type !== 'UNRESOLVED') ?? plans?.candidates[0];
  const otherCandidates = plans?.candidates.filter((candidate) => candidate.id !== primaryCandidate?.id && candidate.type !== 'UNRESOLVED') ?? [];

  function selectCandidate(candidate: RoutePlanCandidate) {
    if (!baseRequest) return;
    const nextRequest = { ...buildRecommendRequest(baseRequest, candidate), egressPreference, comfortType: fixedComfortType };
    window.sessionStorage.setItem('coolcar_selected_route_plan', JSON.stringify({
      ...candidate,
      recommendRequestPatch: { ...candidate.recommendRequestPatch, egressPreference },
    }));
    window.sessionStorage.setItem('coolcar_pending_recommendation', JSON.stringify({
      request: nextRequest,
      context: {
        destinationLine: nextRequest.destinationLine,
        selectedRoutePlanId: candidate.id,
        selectedRoutePlanTitle: candidate.title,
        selectedRoutePlanDirection: candidate.recommendRequestPatch.direction,
      },
    }));
    router.push('/result?loading=1');
  }

  async function buildManualCandidate() {
    if (!baseRequest || manualTransfers.length === 0) return;
    setManualLoading(true);
    setError('');
    try {
      const response = await fetch('/api/route-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseRequest, comfortType: fixedComfortType, egressPreference, transferStations: manualTransfers, maxCandidates: 3 }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? '직접 경로를 만들지 못했어요.');
      const manual = (json as RoutePlansResponse).candidates.find((candidate) => candidate.type === 'USER_SPECIFIED') ?? (json as RoutePlansResponse).candidates[0];
      if (!manual) throw new Error('선택할 수 있는 직접 경로가 없어요.');
      selectCandidate(manual);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '직접 경로를 만들지 못했어요.');
    } finally {
      setManualLoading(false);
    }
  }

  function addManualTransfer() {
    const trimmed = manualTransferInput.trim();
    if (!trimmed || manualTransfers.length >= 5) return;
    const station = trimmed.endsWith('역') ? trimmed : `${trimmed}역`;
    if (station === baseRequest?.originStation || station === baseRequest?.destinationStation) return;
    if (manualTransfers.includes(station)) return;
    setManualTransfers((current) => [...current, station]);
    setManualTransferInput('');
  }

  function moveManualTransfer(index: number, direction: -1 | 1) {
    setManualTransfers((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  if (loading) {
    return (
      <main className="shell with-tabbar result-loading-page">
        <section className="card result-loading-card">
          <div className="cool-spinner" aria-hidden="true">🧭</div>
          <p className="eyebrow">경로 후보 찾는 중</p>
          <h1>가능한 환승 경로를 보고 있어요</h1>
          <p>출발·도착 노선과 환승 가능한 역을 확인하는 중이에요.</p>
        </section>
      </main>
    );
  }

  if (!baseRequest) {
    return (
      <main className="shell with-tabbar">
        <section className="card empty result-empty">
          <h1>출발·도착을 다시 선택해 주세요</h1>
          <p>{error || '경로 후보를 만들 정보가 부족해요.'}</p>
          <Link className="primary" href="/">홈으로 가기</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell with-tabbar route-plans-page">
      <header className="topbar app-topbar">
        <Link className="ghost" href={backHref}>← 출발·도착 수정</Link>
        <span className="result-kicker">경로 확인</span>
      </header>

      <section className="card route-plan-hero">
        <p className="eyebrow">경로 선택</p>
        <h1>노선 흐름을 보고<br />고르세요</h1>
        <p><b>{baseRequest.originStation}</b> → <b>{baseRequest.destinationStation || '목적지'}</b></p>
        <p className="microcopy">추천 경로를 먼저 보여드려요. 필요하면 다른 환승역으로 바꿀 수 있어요.</p>
      </section>

      {error && <p className="error">{error}</p>}

      {primaryCandidate && (
        <section className="card route-plan-card primary-plan-card" aria-label="추천 경로">
          <div className="route-plan-card-head">
            <span>BEST 덜 더운 선택</span>
            <em>{coverageCopy(primaryCandidate)}</em>
          </div>
          <h2>{primaryCandidate.title}</h2>
          <div className="route-timeline" aria-label="추천 경로 순서">
            {routeStops(primaryCandidate).map((station, index) => (
              <div className="route-timeline-stop" key={`${station}-${index}`}>
                <span className={`metro-line-pill ${lineColorClass(primaryCandidate.lines[Math.min(index, primaryCandidate.lines.length - 1)] ?? primaryCandidate.lines[0])}`}>{primaryCandidate.lines[Math.min(index, primaryCandidate.lines.length - 1)] ?? primaryCandidate.lines[0]}</span>
                <strong>{station}</strong>
              </div>
            ))}
          </div>
          <div className="metro-route-strip" aria-hidden="true">
            {primaryCandidate.lines.map((item) => <span className={lineColorClass(item)} key={item} />)}
          </div>
          <p className="route-plan-lines">{primaryCandidate.lines.join(' → ')}</p>
          <p className="microcopy">{primaryCandidate.summary}</p>
          <div className="egress-preference-card" aria-label="내릴 때 이동 방식">
            <div>
              <strong>내릴 때 어디가 편하세요?</strong>
              <p className="microcopy">{egressDescription(egressPreference)}</p>
            </div>
            <div className="egress-options" role="group" aria-label="하차 이동 방식 선택">
              {EGRESS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={egressPreference === option.value ? 'selected' : ''}
                  onClick={() => setEgressPreference(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button className="primary" type="button" onClick={() => selectCandidate(primaryCandidate)}>
            이 경로로 추천받기
          </button>
        </section>
      )}

      {otherCandidates.length > 0 && (
        <details className="route-plan-secondary">
          <summary>다른 경로 보기</summary>
          <section className="route-plan-list compact-route-plan-list" aria-label="다른 경로 목록">
            {otherCandidates.map((candidate) => (
              <article className="card route-plan-card compact-plan-card" key={candidate.id}>
                <div className="route-plan-card-head">
                  <span>{candidate.badge}</span>
                  <em>{coverageCopy(candidate)}</em>
                </div>
                <h2>{candidate.title}</h2>
                <div className="route-timeline compact" aria-label="다른 경로 순서">
                  {routeStops(candidate).map((station, index) => (
                    <div className="route-timeline-stop" key={`${station}-${index}`}>
                      <span className={`metro-line-pill ${lineColorClass(candidate.lines[Math.min(index, candidate.lines.length - 1)] ?? candidate.lines[0])}`}>{candidate.lines[Math.min(index, candidate.lines.length - 1)] ?? candidate.lines[0]}</span>
                      <strong>{station}</strong>
                    </div>
                  ))}
                </div>
                <div className="metro-route-strip" aria-hidden="true">
                  {candidate.lines.map((item) => <span className={lineColorClass(item)} key={item} />)}
                </div>
                <p className="route-plan-lines">{candidate.lines.join(' → ')}</p>
                <button className="primary" type="button" onClick={() => selectCandidate(candidate)}>{candidate.type === 'UNRESOLVED' ? '쾌적칸 먼저 보기' : '이 경로로 바꾸기'}</button>
              </article>
            ))}
          </section>
        </details>
      )}

      <details className="manual-route-card collapsed-manual-route">
        <summary>경로를 직접 바꾸고 싶어요</summary>
        <section className="manual-route-body">
          <p className="microcopy">지도 앱에서 확인한 환승역이 있다면 여기서만 추가하세요. 메인 추천은 위 경로 하나로 바로 진행됩니다.</p>
          <div className="manual-transfer-input">
            <input value={manualTransferInput} onChange={(event) => setManualTransferInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addManualTransfer(); } }} placeholder="예: 당산역" aria-label="환승역 직접 입력" />
            <button type="button" onClick={addManualTransfer}>추가</button>
          </div>
          <div className="manual-transfer-list">
            {manualTransfers.length === 0 && <p className="microcopy">환승역을 추가하지 않으면 위 추천 경로로 바로 진행하면 돼요.</p>}
            {manualTransfers.map((station, index) => (
              <div key={station}>
                <strong>{index + 1}. {station}</strong>
                <span>
                  <button type="button" onClick={() => moveManualTransfer(index, -1)} disabled={index === 0}>위로</button>
                  <button type="button" onClick={() => moveManualTransfer(index, 1)} disabled={index === manualTransfers.length - 1}>아래로</button>
                  <button type="button" onClick={() => setManualTransfers((current) => current.filter((item) => item !== station))}>삭제</button>
                </span>
              </div>
            ))}
          </div>
          <button className="primary" type="button" onClick={() => void buildManualCandidate()} disabled={manualTransfers.length === 0 || manualLoading}>{manualLoading ? '경로 불러오는 중…' : manualTransfers.length > 1 ? '이 환승 순서로 추천받기' : '이 환승역으로 추천받기'}</button>
        </section>
      </details>

      {plans?.warnings.length ? (
        <section className="card route-plan-notice">
          <h2>확인해 주세요</h2>
          {plans.warnings.map((warning) => <p className="microcopy" key={warning.code}>{warning.message}</p>)}
          <p className="microcopy">{plans.disclaimer}</p>
        </section>
      ) : null}

      <TabBar active="home" />
    </main>
  );
}
