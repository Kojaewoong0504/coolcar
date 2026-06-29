import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublishableKey, getSupabaseUrl } from '../supabase';

export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) throw new Error('Supabase browser env is not configured.');
  return createBrowserClient(url, key);
}
