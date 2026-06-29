import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase/server';
import { normalizeSupabaseUser } from '@/lib/auth/profile';

const querySchema = z.object({ anonymousId: z.string().uuid().optional() });

type CountResult = { count: number | null; error: unknown };

function redactedId(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

async function safeCount(query: PromiseLike<CountResult>) {
  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: '로그인이 필요해요.' } }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: { code: 'SUPABASE_NOT_CONFIGURED', message: '서버 저장소가 설정되지 않았어요.' } }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ anonymousId: searchParams.get('anonymousId') ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'anonymousId 형식을 확인해 주세요.' } }, { status: 400 });

  const anonymousId = parsed.data.anonymousId;
  const profile = normalizeSupabaseUser(user);

  const byUser = async (table: string) => safeCount(supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id));
  const byAnonUnclaimed = async (table: string) => anonymousId
    ? safeCount(supabase.from(table).select('id', { count: 'exact', head: true }).eq('anonymous_id', anonymousId).is('user_id', null))
    : null;
  const byBoth = async (table: string) => anonymousId
    ? safeCount(supabase.from(table).select('id', { count: 'exact', head: true }).eq('anonymous_id', anonymousId).eq('user_id', user.id))
    : null;

  const [
    profileRow,
    savedByUser,
    savedAnonUnclaimed,
    savedBoth,
    savedDefaultCount,
    recByUser,
    recAnonUnclaimed,
    recBoth,
    feedbackByUser,
    feedbackAnonUnclaimed,
    feedbackBoth,
    userPreference,
    anonymousPreference,
  ] = await Promise.all([
    supabase.from('user_profiles').select('id,display_name,avatar_url,updated_at').eq('id', user.id).maybeSingle(),
    byUser('saved_routes'),
    byAnonUnclaimed('saved_routes'),
    byBoth('saved_routes'),
    safeCount(supabase.from('saved_routes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_default', true)),
    byUser('recommendation_events'),
    byAnonUnclaimed('recommendation_events'),
    byBoth('recommendation_events'),
    byUser('feedback_events'),
    byAnonUnclaimed('feedback_events'),
    byBoth('feedback_events'),
    supabase.from('user_preference_stats').select('sample_count,updated_at').eq('user_id', user.id).maybeSingle(),
    anonymousId ? supabase.from('anonymous_preference_stats').select('sample_count,updated_at').eq('anonymous_id', anonymousId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  const { data: feedbacks } = await supabase
    .from('feedback_events')
    .select('id,user_id,anonymous_id,recommendation_event_id')
    .eq('user_id', user.id)
    .not('recommendation_event_id', 'is', null)
    .limit(50);

  const recommendationIds = [...new Set((feedbacks ?? []).map((row) => row.recommendation_event_id).filter(Boolean))];
  const { data: recommendations } = recommendationIds.length
    ? await supabase.from('recommendation_events').select('id,user_id,anonymous_id').in('id', recommendationIds)
    : { data: [] as { id: string; user_id: string | null; anonymous_id: string | null }[] };
  const recommendationById = new Map((recommendations ?? []).map((row) => [row.id, row]));
  let ownerMismatchWithRecommendation = 0;
  for (const feedback of feedbacks ?? []) {
    const rec = recommendationById.get(feedback.recommendation_event_id as string);
    if (!rec) continue;
    if (feedback.user_id && rec.user_id && feedback.user_id !== rec.user_id) ownerMismatchWithRecommendation += 1;
    if (!feedback.user_id && feedback.anonymous_id && rec.anonymous_id && feedback.anonymous_id !== rec.anonymous_id) ownerMismatchWithRecommendation += 1;
  }

  const tables = {
    saved_routes: { byUser: savedByUser, byAnonymousUnclaimed: savedAnonUnclaimed, byBothUserAndAnonymous: savedBoth, defaultCountForUser: savedDefaultCount },
    recommendation_events: { byUser: recByUser, byAnonymousUnclaimed: recAnonUnclaimed, byBothUserAndAnonymous: recBoth },
    feedback_events: { byUser: feedbackByUser, byAnonymousUnclaimed: feedbackAnonUnclaimed, byBothUserAndAnonymous: feedbackBoth, linkedToRecommendationChecked: feedbacks?.length ?? 0, ownerMismatchWithRecommendation },
  };

  const anonymousRowsRemaining = Boolean(anonymousId && [savedAnonUnclaimed, recAnonUnclaimed, feedbackAnonUnclaimed].some((count) => Number(count ?? 0) > 0));
  const savedRouteDefaultConflict = Number(savedDefaultCount ?? 0) > 1;
  const preferenceMayDoubleCountOnRerun = Boolean(anonymousPreference.data && userPreference.data);

  return NextResponse.json({
    ok: true,
    authenticated: true,
    profile: {
      userId: redactedId(profile.userId),
      provider: profile.provider,
      emailPresent: Boolean(profile.email),
      displayName: profile.displayName,
      avatarPresent: Boolean(profile.avatarUrl),
    },
    anonymousId: anonymousId ? redactedId(anonymousId) : null,
    userProfile: { exists: Boolean(profileRow.data), updatedAt: profileRow.data?.updated_at ?? null },
    tables,
    preferences: {
      userPreferenceExists: Boolean(userPreference.data),
      userSampleCount: userPreference.data?.sample_count ?? 0,
      anonymousPreferenceExists: Boolean(anonymousPreference.data),
      anonymousSampleCount: anonymousPreference.data?.sample_count ?? 0,
      idempotencyRisk: preferenceMayDoubleCountOnRerun,
    },
    mergeAssessment: {
      eventsMerged: anonymousId ? !anonymousRowsRemaining : null,
      anonymousRowsRemaining,
      preferenceMayDoubleCountOnRerun,
      savedRouteDefaultConflict,
      feedbackRecommendationOwnerMismatch: ownerMismatchWithRecommendation > 0,
    },
  });
}
