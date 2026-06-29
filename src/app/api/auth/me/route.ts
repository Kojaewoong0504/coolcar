import { NextResponse } from 'next/server';
import { getCurrentAuthProfile } from '@/lib/supabase/server';

export async function GET() {
  const profile = await getCurrentAuthProfile();
  return NextResponse.json({ authenticated: Boolean(profile), profile });
}
