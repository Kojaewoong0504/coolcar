import { NextResponse } from 'next/server';
import { getCurrentAuthProfile } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
};

export async function GET() {
  const profile = await getCurrentAuthProfile();
  return NextResponse.json({ authenticated: Boolean(profile), profile }, { headers: noStoreHeaders });
}
