import type { User } from '@supabase/supabase-js';

export type AuthProvider = 'google' | 'kakao' | 'apple' | 'email' | 'unknown';

export type NormalizedAuthProfile = {
  userId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  provider: AuthProvider;
  providers: AuthProvider[];
};

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeProvider(value: unknown): AuthProvider {
  const raw = stringValue(value)?.toLowerCase();
  if (raw === 'google' || raw === 'kakao' || raw === 'apple' || raw === 'email') return raw;
  return 'unknown';
}

function identityData(user: User): Record<string, unknown>[] {
  return (user.identities ?? [])
    .map((identity) => identity.identity_data)
    .filter((data): data is Record<string, unknown> => Boolean(data && typeof data === 'object'));
}

export function providerLabel(provider: AuthProvider) {
  if (provider === 'google') return 'Google';
  if (provider === 'kakao') return 'Kakao';
  if (provider === 'apple') return 'Apple';
  if (provider === 'email') return 'Email';
  return '소셜';
}

export function normalizeSupabaseUser(user: User): NormalizedAuthProfile {
  const metadata = user.user_metadata ?? {};
  const identities = identityData(user);
  const identityProviders = (user.identities ?? []).map((identity) => normalizeProvider(identity.provider));
  const providers = Array.from(new Set([normalizeProvider(user.app_metadata?.provider), ...identityProviders].filter((p) => p !== 'unknown')));
  const provider = providers[0] ?? 'unknown';
  const email = stringValue(user.email) ?? stringValue(metadata.email) ?? identities.map((data) => stringValue(data.email)).find(Boolean) ?? null;
  const displayName =
    stringValue(metadata.name) ??
    stringValue(metadata.full_name) ??
    stringValue(metadata.nickname) ??
    stringValue(metadata.user_name) ??
    identities.map((data) => stringValue(data.name) ?? stringValue(data.full_name) ?? stringValue(data.nickname)).find(Boolean) ??
    email?.split('@')[0] ??
    '로그인 사용자';
  const avatarUrl =
    safeHttpsUrl(metadata.avatar_url) ??
    safeHttpsUrl(metadata.picture) ??
    safeHttpsUrl(metadata.profile_image) ??
    identities.map((data) => safeHttpsUrl(data.avatar_url) ?? safeHttpsUrl(data.picture) ?? safeHttpsUrl(data.profile_image)).find(Boolean) ??
    null;

  return {
    userId: user.id,
    email,
    displayName: displayName.slice(0, 80),
    avatarUrl,
    provider,
    providers: providers.length ? providers : ['unknown'],
  };
}
