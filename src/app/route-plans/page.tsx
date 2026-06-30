'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RecommendRequest, RoutePlanCandidate, RoutePlansResponse } from '@/lib/types';

type PendingRoutePlan = {
  request: RecommendRequest;
  context?: { destinationLine?: string };
};

function routePath(candidate: RoutePlanCandidate) {
  return [candidate.originStation, ...candidate.transferStations, candidate.destinationStation].join(' → ');
}

function coverageCopy(candidate: RoutePlanCandidate) {
  if (candidate.coverage.nextTransferDoorGuide === 'available') return '환승 위치 안내 가능';
  if (candidate.coverage.nextTransferDoorGuide === 'needs_direction') return '방면 확인 필요';
  if (candidate.type === 'DIRECT') return candidate.coverage.finalExitDoorGuide === 'available' ? '하차 위치 안내 가능' : '쾌적칸 중심';
  if (candidate.type === 'UNRESOLVED') return '환승문 미반영';
  return '일부 구간 안내 가능';
}

function buildRecommendRequest(base: RecommendRequest, candidate: RoutePlanCandidate): RecommendRequest {
  return {
    ...base,
    line: candidate.recommendRequestPatch.line,
    destinationLine: candidate.recommendRequestPatch.destinationLine ?? base.destinationLine,
    direction: candidate.recommendRequestPatch.direction ?? base.direction,
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
  const [manualDirection, setManualDirection] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [candidateDirections, setCandidateDirections] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = window.sessionStorage.getItem('coolcar_pending_route_plan');
    if (!raw) {
      setLoading(false);
      setError('출발역과 도착역을 다시 선택해 주세요.');
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PendingRoutePlan;
      setPending(parsed);
      fetch('/api/route-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed.request, maxCandidates: 4 }),
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
      comfortType: baseRequest.comfortType,
      direction: baseRequest.direction ?? '',
      transferStations: baseRequest.transferStations?.join(', ') ?? '',
    });
    return `/?${params.toString()}`;
  }, [baseRequest]);

  function selectCandidate(candidate: RoutePlanCandidate, directionOverride?: string) {
    if (!baseRequest) return;
    const cleanDirection = directionOverride?.trim();
    const patchedCandidate: RoutePlanCandidate = cleanDirection
      ? { ...candidate, recommendRequestPatch: { ...candidate.recommendRequestPatch, direction: cleanDirection } }
      : candidate;
    const nextRequest = buildRecommendRequest(baseRequest, patchedCandidate);
    window.sessionStorage.setItem('coolcar_selected_route_plan', JSON.stringify(patchedCandidate));
    window.sessionStorage.setItem('coolcar_pending_recommendation', JSON.stringify({
      request: nextRequest,
      context: {
        destinationLine: nextRequest.destinationLine,
        selectedRoutePlanId: patchedCandidate.id,
        selectedRoutePlanTitle: patchedCandidate.title,
        selectedRoutePlanDirection: cleanDirection,
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
        body: JSON.stringify({ ...baseRequest, direction: manualDirection.trim() || baseRequest.direction, transferStations: manualTransfers, maxCandidates: 3 }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? '직접 경로를 만들지 못했어요.');
      const manual = (json as RoutePlansResponse).candidates.find((candidate) => candidate.type === 'USER_SPECIFIED') ?? (json as RoutePlansResponse).candidates[0];
      if (!manual) throw new Error('선택할 수 있는 직접 경로가 없어요.');
      selectCandidate(manual, manualDirection.trim() || undefined);
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
        <span className="result-kicker">경로 후보</span>
      </header>

      <section className="card route-plan-hero">
        <p className="eyebrow">먼저 경로를 골라요</p>
        <h1>어떤 경로로 가시나요?</h1>
        <p><b>{baseRequest.originStation}</b> → <b>{baseRequest.destinationStation || '목적지'}</b></p>
        <p className="microcopy">원하는 환승 경로를 고르면, 그 경로 기준으로 구간별 타기 좋은 칸을 추천해요.</p>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="route-plan-list" aria-label="경로 후보 목록">
        {plans?.candidates.map((candidate) => (
          <article className="card route-plan-card" key={candidate.id}>
            <div className="route-plan-card-head">
              <span>{candidate.badge}</span>
              <em>{coverageCopy(candidate)}</em>
            </div>
            <h2>{candidate.title}</h2>
            <p className="route-plan-path">{routePath(candidate)}</p>
            <p className="route-plan-lines">{candidate.lines.join(' → ')}</p>
            <p className="microcopy">{candidate.summary}</p>
            <div className="route-plan-legs">
              {candidate.legs.map((leg) => (
                <div key={`${candidate.id}-${leg.legNo}`}>
                  <span>{leg.legNo}구간</span>
                  <strong>{leg.fromStation} → {leg.toStation}</strong>
                  <small>{leg.line}{leg.transferToLine ? ` · ${leg.transferToLine} 환승 기준` : ''}</small>
                </div>
              ))}
            </div>
            <p className="route-plan-safe-note">{candidate.safetyNote}</p>
            {candidate.type !== 'UNRESOLVED' && (
              <label className="direction-input-card">
                <span>지금 타는 {candidate.recommendRequestPatch.line} 방면</span>
                <input
                  value={candidateDirections[candidate.id] ?? ''}
                  onChange={(event) => setCandidateDirections((current) => ({ ...current, [candidate.id]: event.target.value }))}
                  placeholder="안내판에 보이는 방면명 입력"
                  aria-label={`${candidate.title} 방면 입력`}
                />
                <small>예: 잠실, 신도림처럼 안내판에 보이는 이름을 입력해 주세요. 모르면 비워두고 쾌적칸 중심으로 볼 수 있어요.</small>
              </label>
            )}
            <button className="primary" type="button" onClick={() => selectCandidate(candidate, candidateDirections[candidate.id])}>{candidate.type === 'UNRESOLVED' ? '경로 없이 쾌적칸 보기' : candidateDirections[candidate.id]?.trim() ? '이 방면으로 칸 추천받기' : '방면 없이 쾌적칸 보기'}</button>
          </article>
        ))}
      </section>

      <section className="card manual-route-card">
        <p className="eyebrow">직접 설정</p>
        <h2>환승역을 알고 있다면 직접 넣어주세요</h2>
        <p className="microcopy">입력한 순서대로 경로를 나눠 추천합니다. 아직은 첫 환승역 중심으로 안내 품질을 확인해요.</p>
        <div className="manual-transfer-input">
          <input value={manualTransferInput} onChange={(event) => setManualTransferInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addManualTransfer(); } }} placeholder="예: 당산역" aria-label="환승역 직접 입력" />
          <button type="button" onClick={addManualTransfer}>추가</button>
        </div>
        <label className="direction-input-card manual-direction-input">
          <span>첫 구간 방면</span>
          <input value={manualDirection} onChange={(event) => setManualDirection(event.target.value)} placeholder="안내판에 보이는 방면명 입력" aria-label="직접 설정 경로 방면 입력" />
          <small>방면을 입력하면 첫 환승역의 칸·문 위치를 더 정확히 확인해요. 모르면 비워둬도 됩니다.</small>
        </label>
        <div className="manual-transfer-list">
          {manualTransfers.length === 0 && <p className="microcopy">환승역을 추가하지 않으면 위의 ‘경로 미확정’ 후보로 쾌적칸만 볼 수 있어요.</p>}
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
        <button className="primary" type="button" onClick={() => void buildManualCandidate()} disabled={manualTransfers.length === 0 || manualLoading}>{manualLoading ? '직접 경로 확인 중…' : manualTransfers.length > 1 ? '이 환승 순서로 추천받기' : '이 환승역으로 추천받기'}</button>
      </section>

      {plans?.warnings.length ? (
        <section className="card route-plan-notice">
          <h2>확인해 주세요</h2>
          {plans.warnings.map((warning) => <p className="microcopy" key={warning.code}>{warning.message}</p>)}
          <p className="microcopy">{plans.disclaimer}</p>
        </section>
      ) : null}

      <nav className="tabbar"><Link href="/">홈</Link><Link href="/saved">저장</Link><Link href="/data-source">데이터</Link><Link href="/settings">설정</Link></nav>
    </main>
  );
}
