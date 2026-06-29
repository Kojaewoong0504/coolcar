import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  provider: z.enum(['kakao', 'google', 'apple']),
  next: z.string().optional(),
});

function safeNext(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/settings';
  return value;
}

const kakaoScopes = 'profile_nickname profile_image account_email';
const googleScopes = 'email profile';

function providerScopes(provider: z.infer<typeof schema>['provider']) {
  if (provider === 'kakao') return kakaoScopes;
  if (provider === 'google') return googleScopes;
  return undefined;
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: '로그인 provider를 확인해 주세요.' } }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase Auth 환경변수가 설정되지 않았어요.' } }, { status: 500 });
  }

  const url = new URL(request.url);
  const redirectTo = `${url.origin}/auth/callback?next=${encodeURIComponent(safeNext(parsed.data.next))}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data.provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: providerScopes(parsed.data.provider),
    },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: { code: 'OAUTH_START_FAILED', message: error?.message ?? '소셜 로그인을 시작하지 못했어요.' } }, { status: 502 });
  }

  return NextResponse.json({ ok: true, url: data.url });
}
