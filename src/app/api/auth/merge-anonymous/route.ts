import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase/server';

const schema = z.object({ anonymousId: z.string().uuid() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: '로그인이 필요해요.' } }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'anonymousId를 확인해 주세요.' } }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: { code: 'SUPABASE_NOT_CONFIGURED', message: '서버 저장소가 설정되지 않았어요.' } }, { status: 500 });

  const anonymousId = parsed.data.anonymousId;
  const tables = ['saved_routes', 'recommendation_events', 'feedback_events'] as const;
  const updated: Record<string, number | null> = {};

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .update({ user_id: user.id })
      .eq('anonymous_id', anonymousId)
      .is('user_id', null)
      .select('id');
    if (error) return NextResponse.json({ error: { code: 'MERGE_FAILED', message: `${table} 병합에 실패했어요.` } }, { status: 500 });
    updated[table] = data?.length ?? null;
  }

  const { data: anonStats } = await supabase.from('anonymous_preference_stats').select('*').eq('anonymous_id', anonymousId).maybeSingle();
  if (anonStats) {
    const { data: current } = await supabase.from('user_preference_stats').select('*').eq('user_id', user.id).maybeSingle();
    await supabase.from('user_preference_stats').upsert({
      user_id: user.id,
      hot_sensitivity_score: Number(current?.hot_sensitivity_score ?? 0) + Number(anonStats.hot_sensitivity_score ?? 0),
      cold_sensitivity_score: Number(current?.cold_sensitivity_score ?? 0) + Number(anonStats.cold_sensitivity_score ?? 0),
      crowd_avoidance_score: Number(current?.crowd_avoidance_score ?? 0) + Number(anonStats.crowd_avoidance_score ?? 0),
      wait_acceptance_score: Number(current?.wait_acceptance_score ?? 0) + Number(anonStats.wait_acceptance_score ?? 0),
      preferred_car_zones: { ...(current?.preferred_car_zones ?? {}), ...(anonStats.preferred_car_zones ?? {}) },
      disliked_car_zones: { ...(current?.disliked_car_zones ?? {}), ...(anonStats.disliked_car_zones ?? {}) },
      sample_count: Number(current?.sample_count ?? 0) + Number(anonStats.sample_count ?? 0),
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, merged: updated, preferenceMerged: Boolean(anonStats) });
}
