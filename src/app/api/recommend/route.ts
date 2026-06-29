import { after, NextResponse } from 'next/server';
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

  if (!supabase) return NextResponse.json({ ...data, persisted: false });

  // 익명 사용자는 anonymousId가 owner이므로 Supabase Auth 조회를 생략해 critical path를 줄인다.
  const user = parsed.data.anonymousId ? null : await getCurrentUser();

  const recommendationId = data.recommendationId;
  after(async () => {
    await supabase
      .from('recommendation_events')
      .insert({
        id: recommendationId,
        user_id: user?.id ?? null,
        anonymous_id: user ? null : parsed.data.anonymousId ?? null,
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
      });
  });

  return NextResponse.json({ ...data, recommendationId, persisted: true, persistenceMode: 'deferred' });
}
