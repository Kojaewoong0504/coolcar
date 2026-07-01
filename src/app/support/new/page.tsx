'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TabBar } from '@/components/TabBar';
import { lineShortLabel } from '@/lib/metro-lines';
import type { RecommendationResponse } from '@/lib/types';

type ReportType = 'INCORRECT_RECOMMENDATION' | 'ROUTE_INFO' | 'APP_PROBLEM' | 'IDEA' | 'OTHER';

type StoredResult = {
  result: RecommendationResponse;
  context?: { destinationLine?: string };
};

type ResultContext = {
  entryPoint: 'result';
  screen: 'recommendation_result';
  line?: string;
  originStation?: string;
  destinationStation?: string;
  direction?: string;
  selectedCar?: number;
  recommendationId?: string;
  pathSummary?: string;
};

const REPORT_TYPES: Array<{ value: ReportType; icon: string; title: string; description: string }> = [
  { value: 'INCORRECT_RECOMMENDATION', icon: '🧊', title: '추천 결과가 이상해요', description: '칸 위치나 안내가 실제와 달랐어요.' },
  { value: 'ROUTE_INFO', icon: '🚇', title: '역이나 경로가 달라요', description: '출발·도착·환승 정보가 맞지 않아요.' },
  { value: 'APP_PROBLEM', icon: '🛠️', title: '앱 사용이 불편해요', description: '화면이나 버튼이 잘 동작하지 않아요.' },
  { value: 'IDEA', icon: '💡', title: '개선 의견이 있어요', description: '있으면 좋을 기능을 알려주세요.' },
  { value: 'OTHER', icon: '💬', title: '기타 문의', description: '궁금한 점을 편하게 남겨주세요.' },
];

function getAnonymousId() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem('coolcar_anonymous_id') ?? undefined;
}

function routePathCopy(result: RecommendationResponse) {
  const transfers = result.request.transferStations?.filter(Boolean) ?? [];
  if (transfers.length > 0) return [result.request.originStation, ...transfers, result.request.destinationStation || '목적지'].join(' → ');
  return `${result.request.originStation} → ${result.request.destinationStation || '목적지'}`;
}

function readResultContext(): ResultContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem('coolcar_last_result');
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredResult;
    const result = stored.result;
    if (!result?.request) return null;
    return {
      entryPoint: 'result',
      screen: 'recommendation_result',
      line: result.request.line,
      originStation: result.request.originStation,
      destinationStation: result.request.destinationStation,
      direction: result.request.direction,
      selectedCar: result.recommendedCar?.carNo,
      recommendationId: result.recommendationId,
      pathSummary: routePathCopy(result),
    };
  } catch {
    return null;
  }
}

function SupportForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const [type, setType] = useState<ReportType>(from === 'result' ? 'INCORRECT_RECOMMENDATION' : 'OTHER');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [resultContext, setResultContext] = useState<ResultContext | null>(null);
  const [includeContext, setIncludeContext] = useState(from === 'result');
  const [status, setStatus] = useState<'idle' | 'pending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (from === 'result') {
      const context = readResultContext();
      setResultContext(context);
      setIncludeContext(Boolean(context));
    }
  }, [from]);

  const selectedType = useMemo(() => REPORT_TYPES.find((item) => item.value === type) ?? REPORT_TYPES[0], [type]);
  const trimmedMessage = message.trim();
  const canSubmit = trimmedMessage.length >= 10 && status !== 'pending';
  const backHref = from === 'result' ? '/result' : '/settings';

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setError('내용을 조금만 더 적어주세요.');
      return;
    }
    setStatus('pending');
    setError('');
    const payload = {
      type,
      message: trimmedMessage,
      contactEmail: contactEmail.trim() || undefined,
      anonymousId: getAnonymousId(),
      appContext: includeContext && resultContext
        ? resultContext
        : { entryPoint: from === 'settings' ? 'settings' : from === 'tips' ? 'tips' : from === 'home' ? 'home' : 'direct', screen: from ? `${from}_support` : 'support' },
      clientContext: {
        locale: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        platform: navigator.platform,
      },
      website,
    };

    const response = await fetch('/api/support/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.ok === false) {
      setStatus('error');
      setError(json.message ?? '지금은 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <main className="shell with-tabbar support-page">
        <header className="topbar">
          <Link className="ghost" href={backHref}>← 돌아가기</Link>
          <span className="result-kicker">접수 완료</span>
        </header>
        <section className="hero-card compact support-done-card">
          <p className="eyebrow">보냈어요</p>
          <h1>알려주셔서<br />고마워요.</h1>
          <p>남겨주신 내용은 더 나은 시원칸 추천을 만드는 데 참고할게요.</p>
          {contactEmail.trim() && <p className="microcopy">답변이 필요한 내용은 남겨주신 메일로 안내드릴게요.</p>}
        </section>
        <div className="support-done-actions">
          <Link className="primary" href={backHref}>{from === 'result' ? '결과로 돌아가기' : '내 정보로 돌아가기'}</Link>
          <button className="ghost" type="button" onClick={() => { setStatus('idle'); setMessage(''); setContactEmail(''); }}>새로 보내기</button>
        </div>
        <TabBar active="settings" />
      </main>
    );
  }

  return (
    <main className="shell with-tabbar support-page">
      <header className="topbar">
        <Link className="ghost" href={backHref}>← 돌아가기</Link>
        <span className="result-kicker">도움말</span>
      </header>

      <section className="hero-card compact support-hero">
        <p className="eyebrow">문의 및 문제 제보</p>
        <h1>무엇을<br />도와드릴까요?</h1>
        <p>앱 사용 중 불편한 점이나 이상한 추천을 편하게 알려주세요. 로그인하지 않아도 보낼 수 있어요.</p>
      </section>

      <form className="support-form" onSubmit={(event) => void submitReport(event)}>
        <section className="card support-section-card">
          <div className="section-title">유형 선택</div>
          <div className="support-type-list" role="radiogroup" aria-label="문의 유형">
            {REPORT_TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={type === item.value ? 'support-type-card selected' : 'support-type-card'}
                aria-pressed={type === item.value}
                onClick={() => setType(item.value)}
              >
                <span className="settings-row-icon" aria-hidden="true">{item.icon}</span>
                <span><b>{item.title}</b><small>{item.description}</small></span>
              </button>
            ))}
          </div>
        </section>

        {resultContext && (
          <section className="card support-context-card">
            <label className="toggle support-context-toggle">
              <input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} />
              <span>
                <b>현재 추천 내용을 함께 보내기</b>
                <small>{resultContext.pathSummary}{resultContext.line ? ` · ${lineShortLabel(resultContext.line)}` : ''}{resultContext.selectedCar ? ` · ${resultContext.selectedCar}번째 칸` : ''}</small>
              </span>
            </label>
          </section>
        )}

        <section className="card support-section-card">
          <div className="section-title">내용</div>
          <label className="support-field-label">
            <span>{selectedType.title}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              rows={7}
              placeholder="예: 추천된 칸보다 5번째 칸이 더 시원했어요."
            />
          </label>
          <p className="microcopy">개인정보는 꼭 필요한 경우가 아니면 적지 않아도 괜찮아요.</p>
        </section>

        <section className="card support-section-card">
          <div className="section-title">답변 받기</div>
          <label className="support-field-label">
            <span>메일 주소 <em>선택</em></span>
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="답변이 필요할 때만 적어주세요"
            />
          </label>
        </section>

        <label className="support-honeypot" aria-hidden="true">
          홈페이지
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>

        {error && <p className="error-notice">{error}</p>}
        <button className="primary support-submit" type="submit" disabled={!canSubmit}>
          {status === 'pending' ? <><span className="button-spinner" aria-hidden="true" />보내는 중…</> : '보내기'}
        </button>
      </form>

      <TabBar active="settings" />
    </main>
  );
}

export default function SupportNewPage() {
  return (
    <Suspense fallback={<main className="shell"><section className="card">불러오는 중이에요…</section></main>}>
      <SupportForm />
    </Suspense>
  );
}
