import { NextResponse } from 'next/server';
import { preferenceSchema } from '@/lib/validation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase/server';

type PreferencePayload = {
  comfortType: 'HOT_SENSITIVE' | 'COLD_SENSITIVE' | 'CROWD_AVOIDER' | 'BALANCED';
  waitToleranceMin: 0 | 3 | 5 | 10;
  avoidPrioritySeatArea: boolean;
};

const DEFAULT_PREFERENCES: PreferencePayload = {
  comfortType: 'HOT_SENSITIVE',
  waitToleranceMin: 3,
  avoidPrioritySeatArea: true,
};

function toPreferencePayload(row: Record<string, unknown> | null | undefined): PreferencePayload {
  return {
    comfortType: typeof row?.comfort_type === 'string' ? row.comfort_type as PreferencePayload['comfortType'] : DEFAULT_PREFERENCES.comfortType,
    waitToleranceMin: typeof row?.wait_tolerance_min === 'number' ? row.wait_tolerance_min as PreferencePayload['waitToleranceMin'] : DEFAULT_PREFERENCES.waitToleranceMin,
    avoidPrioritySeatArea: typeof row?.avoid_priority_seat_area === 'boolean' ? row.avoid_priority_seat_area : DEFAULT_PREFERENCES.avoidPrioritySeatArea,
  };
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get('anonymousId');
  const user = await getCurrentUser();

  if (!supabase) return NextResponse.json({ preferences: DEFAULT_PREFERENCES, persisted: false });

  if (user) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('comfort_type,wait_tolerance_min,avoid_priority_seat_area')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ preferences: DEFAULT_PREFERENCES, persisted: false });
    return NextResponse.json({ preferences: toPreferencePayload(data), persisted: Boolean(data), owner: 'user' });
  }

  if (!anonymousId) return NextResponse.json({ preferences: DEFAULT_PREFERENCES, persisted: false, owner: 'local' });

  const { data, error } = await supabase
    .from('anonymous_profiles')
    .select('comfort_type,wait_tolerance_min')
    .eq('anonymous_id', anonymousId)
    .maybeSingle();
  if (error) return NextResponse.json({ preferences: DEFAULT_PREFERENCES, persisted: false });
  return NextResponse.json({ preferences: toPreferencePayload(data), persisted: Boolean(data), owner: 'anonymous' });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = preferenceSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? '취향 정보를 확인해 주세요.' } }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: true, persisted: false, preferences: parsed.data });

  const user = await getCurrentUser();
  if (user) {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        comfort_type: parsed.data.comfortType,
        wait_tolerance_min: parsed.data.waitToleranceMin,
        avoid_priority_seat_area: parsed.data.avoidPrioritySeatArea,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (error) return NextResponse.json({ error: { code: 'PREFERENCE_SAVE_FAILED', message: '취향 저장에 실패했어요.' } }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, owner: 'user', preferences: parsed.data });
  }

  if (!parsed.data.anonymousId) {
    return NextResponse.json({ ok: true, persisted: false, owner: 'local', preferences: parsed.data });
  }

  const { error } = await supabase
    .from('anonymous_profiles')
    .upsert({
      anonymous_id: parsed.data.anonymousId,
      comfort_type: parsed.data.comfortType,
      wait_tolerance_min: parsed.data.waitToleranceMin,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'anonymous_id' });
  if (error) return NextResponse.json({ ok: true, persisted: false, owner: 'local', preferences: parsed.data });
  return NextResponse.json({ ok: true, persisted: true, owner: 'anonymous', preferences: parsed.data });
}
