import { Redis } from '@upstash/redis';
import { getSupabaseAdmin } from './supabase';

type MemoryEntry = { value: unknown; expiresAt: number };
const memory = new Map<string, MemoryEntry>();
const inflight = new Map<string, Promise<unknown>>();

let redis: Redis | null | undefined;

function getRedis() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export function isRedisCacheEnabled() {
  return Boolean(getRedis());
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const local = memory.get(key);
  if (local && local.expiresAt > now) return local.value as T;
  if (local) memory.delete(key);

  const client = getRedis();
  if (client) {
    const value = await client.get<T>(key).catch(() => null);
    if (value !== null && value !== undefined) return value;
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from('provider_cache_entries')
      .select('value,expires_at')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (data?.value !== undefined) {
      const expiresAt = new Date(data.expires_at as string).getTime();
      memory.set(key, { value: data.value, expiresAt });
      return data.value as T;
    }
  }

  return null;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  const client = getRedis();
  if (client) await client.set(key, value, { ex: ttlSeconds }).catch(() => undefined);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('provider_cache_entries').upsert({
        cache_key: key,
        value,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Cache persistence must never break the product path.
    }
  }
}

export async function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
