'use client';

import { useState } from 'react';

type Provider = 'kakao' | 'google' | 'apple';
const providers: { id: Provider; label: string; emoji: string }[] = [
  { id: 'kakao', label: '카카오로 계속하기', emoji: '💬' },
  { id: 'google', label: 'Google로 계속하기', emoji: 'G' },
  { id: 'apple', label: 'Apple로 계속하기', emoji: '' },
];

export function SocialLoginButtons({ next = '/settings' }: { next?: string }) {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState('');

  async function signIn(provider: Provider) {
    setError('');
    setLoading(provider);
    try {
      const response = await fetch('/api/auth/oauth-start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, next }),
      });
      const payload = await response.json().catch(() => null) as { url?: string; error?: { message?: string } } | null;
      if (!response.ok || !payload?.url) throw new Error(payload?.error?.message ?? '로그인을 시작하지 못했어요.');
      window.location.href = payload.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인을 시작하지 못했어요.');
      setLoading(null);
    }
  }

  return (
    <div className="auth-buttons">
      {providers.map((provider) => (
        <button className="auth-button" key={provider.id} type="button" onClick={() => void signIn(provider.id)} disabled={Boolean(loading)}>
          <span>{provider.emoji}</span>{loading === provider.id ? '연결 중…' : provider.label}
        </button>
      ))}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
