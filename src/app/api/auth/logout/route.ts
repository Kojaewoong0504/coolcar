import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
};

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: { message: '로그아웃 설정을 확인하지 못했어요.' } }, { status: 503, headers: noStoreHeaders });
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ ok: false, error: { message: '로그아웃하지 못했어요.' } }, { status: 502, headers: noStoreHeaders });
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
}
