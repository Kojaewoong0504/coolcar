'use client';

import { useEffect, useState } from 'react';
import type { NormalizedAuthProfile } from '@/lib/auth/profile';

function initial(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '🙂';
}

export function UserProfilePill() {
  const [profile, setProfile] = useState<NormalizedAuthProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setProfile(payload.profile ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return <a className="profile-pill ghost" href="/settings" aria-label="계정 확인"><span className="avatar-fallback">…</span></a>;
  if (!profile) return <a className="profile-pill login" href="/login">로그인</a>;

  return (
    <a className="profile-pill signed-in" href="/settings" aria-label={`${profile.displayName} 설정`}>
      {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-fallback">{initial(profile.displayName)}</span>}
      <span className="profile-name">{profile.displayName}</span>
    </a>
  );
}
