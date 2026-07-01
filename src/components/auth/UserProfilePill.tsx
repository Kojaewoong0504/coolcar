'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NormalizedAuthProfile } from '@/lib/auth/profile';

let cachedProfile: NormalizedAuthProfile | null = null;
let cachedLoaded = false;
let profilePromise: Promise<NormalizedAuthProfile | null> | null = null;

export function clearUserProfileCache() {
  cachedProfile = null;
  cachedLoaded = false;
  profilePromise = null;
}

async function fetchProfile() {
  if (cachedLoaded) return cachedProfile;
  if (!profilePromise) {
    profilePromise = fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => response.json())
      .then((payload) => (payload.profile ?? null) as NormalizedAuthProfile | null)
      .catch(() => null)
      .then((profile) => {
        cachedProfile = profile;
        cachedLoaded = true;
        profilePromise = null;
        return profile;
      });
  }
  return profilePromise;
}

function initial(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '🙂';
}

export function UserProfilePill({ profile: providedProfile, loaded: providedLoaded }: { profile?: NormalizedAuthProfile | null; loaded?: boolean } = {}) {
  const controlled = typeof providedLoaded === 'boolean';
  const [profile, setProfile] = useState<NormalizedAuthProfile | null>(providedProfile ?? cachedProfile);
  const [loaded, setLoaded] = useState(controlled ? Boolean(providedLoaded) : cachedLoaded);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (controlled) return;

    function handleAuthChanged() {
      clearUserProfileCache();
      setProfile(null);
      setLoaded(false);
      void fetchProfile()
        .then((nextProfile) => setProfile(nextProfile))
        .finally(() => setLoaded(true));
    }

    window.addEventListener('coolcar-auth-changed', handleAuthChanged);
    return () => window.removeEventListener('coolcar-auth-changed', handleAuthChanged);
  }, [controlled]);

  useEffect(() => {
    if (controlled) {
      setProfile(providedProfile ?? null);
      setLoaded(Boolean(providedLoaded));
      return;
    }
    let cancelled = false;
    fetchProfile()
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [controlled, providedLoaded, providedProfile]);

  if (!loaded) return <Link className="profile-pill ghost" href="/settings" aria-label="계정 확인"><span className="avatar-fallback">…</span></Link>;
  if (!profile) return <Link className="profile-pill login" href="/login">로그인</Link>;

  return (
    <Link className="profile-pill signed-in" href="/settings" aria-label={`${profile.displayName} 설정`}>
      {profile.avatarUrl && !imageFailed ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : <span className="avatar-fallback">{initial(profile.displayName)}</span>}
      <span className="profile-name">{profile.displayName}</span>
    </Link>
  );
}
