'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearUserProfileCache } from './UserProfilePill';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    if (loading) return;
    setLoading(true);
    setError('');
    const response = await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) {
      setError('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setLoading(false);
      return;
    }

    clearUserProfileCache();
    window.dispatchEvent(new Event('coolcar-auth-changed'));
    router.replace('/settings');
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="logout-control">
      <button className="ghost" type="button" onClick={() => void logout()} disabled={loading}>{loading ? '로그아웃 중' : '로그아웃'}</button>
      {error && <p className="microcopy error">{error}</p>}
    </div>
  );
}
