import { NextResponse } from 'next/server';
import { feedbackSchema } from '@/lib/validation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase/server';

function statsDelta(feedbackType: string, temperatureFeel?: string, crowdingFeel?: string) {
  return {
    hot: feedbackType === 'HOT' || temperatureFeel === 'HOT' ? 1 : 0,
    cold: feedbackType === 'COLD' || temperatureFeel === 'COLD' ? 1 : 0,
    crowd: feedbackType === 'CROWDED' || crowdingFeel === 'HIGH' ? 1 : 0,
    wait: feedbackType === 'GOOD' ? 0.2 : 0,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? '피드백 값을 확인해 주세요.' } }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const user = await getCurrentUser();
  if (!supabase) {
    return NextResponse.json({ ok: true, persisted: false, updatedPreference: null, message: 'MVP 목업 모드로 피드백을 받았어요.' });
  }

  let recommendationEventId: string | null = parsed.data.recommendationId ?? null;
  if (recommendationEventId) {
    let existing: { id: string; user_id: string | null; anonymous_id: string | null } | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const result = await supabase
        .from('recommendation_events')
        .select('id,user_id,anonymous_id')
        .eq('id', recommendationEventId)
        .maybeSingle();
      existing = result.data;
      if (existing?.id) break;
      await sleep(80);
    }
    const sameOwner = user
      ? existing?.user_id === user.id
      : Boolean(parsed.data.anonymousId && existing?.anonymous_id === parsed.data.anonymousId);
    if (!existing?.id || !sameOwner) recommendationEventId = null;
  }

  const { error } = await supabase.from('feedback_events').insert({
    recommendation_event_id: recommendationEventId,
    user_id: user?.id ?? null,
    anonymous_id: user ? null : parsed.data.anonymousId ?? null,
    line: parsed.data.line,
    station: parsed.data.station,
    direction: parsed.data.direction ?? null,
    car_no: parsed.data.carNo,
    feedback_type: parsed.data.feedbackType,
    temperature_feel: parsed.data.temperatureFeel ?? null,
    crowding_feel: parsed.data.crowdingFeel ?? null,
  });

  if (error) return NextResponse.json({ error: { code: 'FEEDBACK_SAVE_FAILED', message: '피드백 저장에 실패했어요. 잠시 후 다시 시도해 주세요.' } }, { status: 500 });

  let updatedPreference = null;
  if (user || parsed.data.anonymousId) {
    const statsTable = user ? 'user_preference_stats' : 'anonymous_preference_stats';
    const ownerColumn = user ? 'user_id' : 'anonymous_id';
    const ownerValue = user?.id ?? parsed.data.anonymousId;
    const delta = statsDelta(parsed.data.feedbackType, parsed.data.temperatureFeel, parsed.data.crowdingFeel);
    const { data: current } = await supabase
      .from(statsTable)
      .select('hot_sensitivity_score,cold_sensitivity_score,crowd_avoidance_score,wait_acceptance_score,sample_count,preferred_car_zones,disliked_car_zones')
      .eq(ownerColumn, ownerValue)
      .maybeSingle();

    const preferred = (current?.preferred_car_zones ?? {}) as Record<string, number>;
    const disliked = (current?.disliked_car_zones ?? {}) as Record<string, number>;
    const carKey = String(parsed.data.carNo);
    if (parsed.data.feedbackType === 'GOOD') preferred[carKey] = (preferred[carKey] ?? 0) + 1;
    if (parsed.data.feedbackType === 'WRONG' || parsed.data.feedbackType === 'CROWDED') disliked[carKey] = (disliked[carKey] ?? 0) + 1;

    const next = {
      [ownerColumn]: ownerValue,
      hot_sensitivity_score: Number(current?.hot_sensitivity_score ?? 0) + delta.hot,
      cold_sensitivity_score: Number(current?.cold_sensitivity_score ?? 0) + delta.cold,
      crowd_avoidance_score: Number(current?.crowd_avoidance_score ?? 0) + delta.crowd,
      wait_acceptance_score: Number(current?.wait_acceptance_score ?? 0) + delta.wait,
      preferred_car_zones: preferred,
      disliked_car_zones: disliked,
      sample_count: Number(current?.sample_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
    const { data: stats } = await supabase.from(statsTable).upsert(next).select('*').single();
    updatedPreference = stats;
  }

  return NextResponse.json({ ok: true, persisted: true, recommendationLinked: Boolean(recommendationEventId), updatedPreference, message: '피드백을 저장했어요.' });
}
