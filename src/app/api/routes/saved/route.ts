import { NextResponse } from 'next/server';
import { z } from 'zod';
import { savedRouteSchema } from '@/lib/validation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase/server';
import type { RecommendRequest } from '@/lib/types';

type SavedRouteRow = {
  id: string;
  origin_station: string;
  destination_station: string | null;
  line: string;
};

const deleteSavedRouteSchema = z.object({
  id: z.string().uuid(),
  anonymousId: z.string().uuid().optional(),
});

function isRecommendRequest(value: unknown): value is RecommendRequest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RecommendRequest>;
  return typeof candidate.line === 'string'
    && typeof candidate.originStation === 'string'
    && typeof candidate.comfortType === 'string';
}

async function attachRecentRecommendationRequests(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  routes: SavedRouteRow[],
  owner: { userId?: string; anonymousId?: string | null },
) {
  if (routes.length === 0) return routes;

  let eventsQuery = supabase
    .from('recommendation_events')
    .select('station,destination_station,line,request_payload,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  eventsQuery = owner.userId
    ? eventsQuery.eq('user_id', owner.userId)
    : eventsQuery.eq('anonymous_id', owner.anonymousId ?? '');

  const { data: events, error } = await eventsQuery;
  if (error || !events) return routes;

  return routes.map((route) => {
    const match = events.find((event) => {
      const payload = event.request_payload;
      if (!isRecommendRequest(payload)) return false;
      return event.station === route.origin_station
        && event.destination_station === route.destination_station
        && event.line === route.line
        && payload.originStation === route.origin_station
        && payload.destinationStation === (route.destination_station ?? undefined);
    });

    const requestPayload = match?.request_payload;
    if (!isRecommendRequest(requestPayload)) return route;

    return {
      ...route,
      recent_request: requestPayload,
      recent_context: { destinationLine: requestPayload.destinationLine },
    };
  });
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  return supabase;
}

export async function GET(request: Request) {
  const supabase = requireSupabase();
  if (!supabase) return NextResponse.json({ routes: [], persisted: false });

  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get('anonymousId');
  const user = await getCurrentUser();
  if (!user && !anonymousId) return NextResponse.json({ routes: [], persisted: true, message: '로그인 전에는 anonymousId 기준으로만 저장 경로를 조회해요.' });

  let query = supabase
    .from('saved_routes')
    .select('id,label,origin_station,destination_station,line,direction,comfort_type,commute_type,is_default,created_at')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  query = user ? query.eq('user_id', user.id) : query.eq('anonymous_id', anonymousId);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: { code: 'SAVED_ROUTES_READ_FAILED', message: '저장 경로를 불러오지 못했어요.' } }, { status: 500 });
  const routes = await attachRecentRecommendationRequests(supabase, (data ?? []) as SavedRouteRow[], { userId: user?.id, anonymousId });
  return NextResponse.json({ routes, persisted: true });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = savedRouteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? '저장할 경로를 확인해 주세요.' } }, { status: 400 });
  }

  const supabase = requireSupabase();
  if (!supabase) return NextResponse.json({ ok: true, persisted: false, route: null, message: 'MVP 목업 모드로 경로 저장 요청을 받았어요.' });
  const user = await getCurrentUser();
  if (!user && !parsed.data.anonymousId) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: '로그인 또는 익명 ID가 있어야 경로를 저장할 수 있어요.' } }, { status: 401 });

  if (parsed.data.isDefault) {
    let clear = supabase.from('saved_routes').update({ is_default: false });
    clear = user ? clear.eq('user_id', user.id) : clear.eq('anonymous_id', parsed.data.anonymousId ?? '');
    await clear;
  }

  const { data, error } = await supabase
    .from('saved_routes')
    .insert({
      user_id: user?.id ?? null,
      anonymous_id: user ? null : parsed.data.anonymousId,
      label: parsed.data.label ?? `${parsed.data.originStation} → ${parsed.data.destinationStation ?? '목적지 미정'}`,
      origin_station: parsed.data.originStation,
      destination_station: parsed.data.destinationStation ?? null,
      line: parsed.data.line,
      direction: parsed.data.direction ?? null,
      comfort_type: parsed.data.comfortType,
      commute_type: parsed.data.commuteType,
      is_default: parsed.data.isDefault,
    })
    .select('id,label,origin_station,destination_station,line,direction,comfort_type,commute_type,is_default,created_at')
    .single();

  if (error) return NextResponse.json({ error: { code: 'SAVED_ROUTE_SAVE_FAILED', message: '경로 저장에 실패했어요.' } }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, route: data });
}

export async function DELETE(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = deleteSavedRouteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: '삭제할 루틴을 확인해 주세요.' } }, { status: 400 });
  }

  const supabase = requireSupabase();
  if (!supabase) return NextResponse.json({ ok: true, persisted: false, deletedId: parsed.data.id, message: 'MVP 목업 모드로 삭제 요청을 받았어요.' });

  const user = await getCurrentUser();
  if (!user && !parsed.data.anonymousId) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: '로그인 또는 익명 ID가 있어야 루틴을 삭제할 수 있어요.' } }, { status: 401 });
  }

  let deleteQuery = supabase
    .from('saved_routes')
    .delete()
    .eq('id', parsed.data.id);

  deleteQuery = user
    ? deleteQuery.eq('user_id', user.id)
    : deleteQuery.eq('anonymous_id', parsed.data.anonymousId ?? '');

  const { data, error } = await deleteQuery.select('id').single();
  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({
      error: {
        code: status === 404 ? 'SAVED_ROUTE_NOT_FOUND' : 'SAVED_ROUTE_DELETE_FAILED',
        message: status === 404 ? '이미 삭제된 루틴이에요.' : '루틴 삭제에 실패했어요.',
      },
    }, { status });
  }

  return NextResponse.json({ ok: true, persisted: true, deletedId: data.id });
}
