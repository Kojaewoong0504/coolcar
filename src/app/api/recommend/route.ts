import { NextResponse } from 'next/server';
import { recommendRequestSchema } from '@/lib/validation';
import { recommend } from '@/lib/recommendation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = recommendRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.' } }, { status: 400 });
  }

  const data = await recommend(parsed.data);
  const supabase = getSupabaseAdmin();
  const user = await getCurrentUser();

  if (!supabase) return NextResponse.json({ ...data, persisted: false });

  const { data: inserted, error } = await supabase
    .from('recommendation_events')
    .insert({
      user_id: user?.id ?? null,
      anonymous_id: parsed.data.anonymousId ?? null,
      line: parsed.data.line,
      station: parsed.data.originStation,
      destination_station: parsed.data.destinationStation ?? null,
      direction: parsed.data.direction ?? null,
      target_time: parsed.data.targetTime ?? new Date().toISOString(),
      comfort_type: parsed.data.comfortType,
      recommended_car_no: data.recommendedCar.carNo,
      source_provider: data.sourceMeta.provider,
      source_type: data.sourceMeta.sourceType,
      confidence: data.sourceMeta.confidence,
      request_payload: parsed.data,
      response_payload: data,
    })
    .select('id')
    .single();

  if (error || !inserted?.id) {
    return NextResponse.json({ ...data, persisted: false, persistenceWarning: '추천은 완료했지만 이벤트 저장은 실패했어요.' });
  }

  return NextResponse.json({ ...data, recommendationId: inserted.id, persisted: true });
}
