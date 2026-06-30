'use client';

import { useEffect, useState } from 'react';

type AuthMergeOnLoadProps = {
  showSuccess?: boolean;
};

export function AuthMergeOnLoad({ showSuccess = false }: AuthMergeOnLoadProps) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const anonymousId = window.localStorage.getItem('coolcar_anonymous_id');
    if (!anonymousId) return;

    let cancelled = false;
    fetch('/api/auth/merge-anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anonymousId }),
    })
      .then(async (response) => {
        if (cancelled) return;
        const payload = await response.json().catch(() => null) as { merged?: Record<string, number>; error?: { message?: string } } | null;
        if (!response.ok) throw new Error(payload?.error?.message ?? '저장 루틴을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.');
        const total = Object.values(payload?.merged ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0);
        setMessage(showSuccess && total > 0 ? '이 기기에 저장했던 루틴을 계정에 이어놨어요.' : '');
      })
      .catch(() => {
        if (!cancelled && showSuccess) setMessage('저장 루틴을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.');
      });

    return () => {
      cancelled = true;
    };
  }, [showSuccess]);

  if (!message) return null;
  return <p className="microcopy">{message}</p>;
}
