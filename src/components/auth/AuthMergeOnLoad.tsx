'use client';

import { useEffect, useState } from 'react';

export function AuthMergeOnLoad() {
  const [message, setMessage] = useState('익명 추천·피드백·저장 경로를 이 계정과 연결하는 중이에요.');

  useEffect(() => {
    const anonymousId = window.localStorage.getItem('coolcar_anonymous_id');
    if (!anonymousId) {
      setMessage('이 기기에 연결할 익명 기록이 아직 없어요.');
      return;
    }

    let cancelled = false;
    fetch('/api/auth/merge-anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anonymousId }),
    })
      .then(async (response) => {
        if (cancelled) return;
        const payload = await response.json().catch(() => null) as { merged?: Record<string, number>; error?: { message?: string } } | null;
        if (!response.ok) throw new Error(payload?.error?.message ?? '익명 기록 연결에 실패했어요.');
        const total = Object.values(payload?.merged ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0);
        setMessage(total > 0 ? `익명 기록 ${total}건을 계정에 연결했어요.` : '이미 연결됐거나 새로 연결할 익명 기록이 없어요.');
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : '익명 기록 연결에 실패했어요.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <p className="microcopy">{message}</p>;
}
