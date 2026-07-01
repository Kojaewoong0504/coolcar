import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supportReportSchema } from '@/lib/validation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RateBucket = { count: number; resetAt: number };

const RATE_BUCKETS = new Map<string, RateBucket>();
const BODY_LIMIT_BYTES = Number(process.env.SUPPORT_REPORTS_MAX_BODY_BYTES ?? 32_768);
const MAX_MESSAGE_CHARS = Number(process.env.SUPPORT_REPORTS_MAX_MESSAGE_CHARS ?? 2000);
const REPORT_TYPE_LABELS: Record<string, string> = {
  INCORRECT_RECOMMENDATION: '추천 결과',
  ROUTE_INFO: '역·경로',
  APP_PROBLEM: '앱 사용',
  IDEA: '개선 의견',
  OTHER: '기타 문의',
};

function jsonHeaders() {
  return {
    'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
    Pragma: 'no-cache',
  };
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

function hashSubmitter(request: Request) {
  const secret = process.env.SUPPORT_REPORTS_IP_HASH_SECRET || process.env.SUPABASE_JWKS_URL || 'coolcar-support-dev-secret';
  const day = new Date().toISOString().slice(0, 10);
  return createHmac('sha256', secret).update(`${day}:${getClientIp(request)}`).digest('hex').slice(0, 32);
}

function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = RATE_BUCKETS.get(key);
  if (!current || current.resetAt <= now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function compact(value?: string | null, max = 180) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function maskEmail(email?: string | null) {
  if (!email) return null;
  const [name, domain] = email.split('@');
  if (!name || !domain) return null;
  return `${name[0] ?? '*'}***@${domain}`;
}

function stripSensitiveText(text: string) {
  return text
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[가림]')
    .replace(/(sk_live_|sk_test_|pk_live_|pk_test_)[A-Za-z0-9_-]{12,}/g, '[가림]')
    .slice(0, MAX_MESSAGE_CHARS);
}

async function notifyDiscord(report: {
  type: string;
  message: string;
  contactEmail?: string | null;
  appContext: Record<string, unknown>;
}) {
  if (process.env.SUPPORT_REPORTS_DISCORD_ENABLED === 'false') return { ok: false, skipped: true };
  const webhookUrl = process.env.SUPPORT_REPORTS_DISCORD_WEBHOOK_URL || process.env.SUPPORT_REPORTS_NOTIFY_DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return { ok: false, skipped: true };

  const context = report.appContext;
  const route = [context.originStation, context.destinationStation].filter(Boolean).join(' → ');
  const content = [
    `**[시원칸 문제 제보] ${REPORT_TYPE_LABELS[report.type] ?? '문의'}**`,
    route ? `구간: ${compact(String(route), 80)}` : null,
    context.line ? `노선: ${compact(String(context.line), 40)}` : null,
    context.selectedCar ? `추천 칸: ${context.selectedCar}번째 칸` : null,
    `내용: ${compact(report.message, 260)}`,
    `답변 요청: ${report.contactEmail ? maskEmail(report.contactEmail) : '없음'}`,
  ].filter(Boolean).join('\n');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  return { ok: response.ok, skipped: false, status: response.status };
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > BODY_LIMIT_BYTES) {
    return NextResponse.json({ ok: false, message: '내용이 너무 길어요. 조금 줄여서 다시 보내주세요.' }, { status: 413, headers: jsonHeaders() });
  }

  const submitterHash = hashSubmitter(request);
  if (!checkRateLimit(`support:${submitterHash}:minute`, 3, 60_000) || !checkRateLimit(`support:${submitterHash}:hour`, 12, 60 * 60_000)) {
    return NextResponse.json({ ok: false, message: '잠시 후 다시 보내주세요.' }, { status: 429, headers: jsonHeaders() });
  }

  const json = await request.json().catch(() => null);
  const parsed = supportReportSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? '입력 내용을 확인해 주세요.' }, { status: 400, headers: jsonHeaders() });
  }

  if (parsed.data.website) {
    return NextResponse.json({ ok: true, persisted: false, message: '보내주셔서 감사합니다.' }, { headers: jsonHeaders() });
  }

  const user = await getCurrentUser();
  const supabase = getSupabaseAdmin();
  const contactEmail = parsed.data.contactEmail || null;
  const message = stripSensitiveText(parsed.data.message);
  const appContext = parsed.data.appContext;
  const clientContext = parsed.data.clientContext;

  if (!supabase) {
    return NextResponse.json({ ok: true, persisted: false, message: '보내주셔서 감사합니다. 확인해 볼게요.' }, { headers: jsonHeaders() });
  }

  const insertPayload = {
    type: parsed.data.type,
    status: 'new',
    priority: 'normal',
    message,
    user_id: user?.id ?? null,
    anonymous_id: user ? null : parsed.data.anonymousId ?? null,
    contact_email: contactEmail,
    wants_reply: Boolean(contactEmail),
    app_context: appContext,
    client_context: clientContext,
    submitter_hash: submitterHash,
  };

  const { data, error } = await supabase
    .from('support_reports')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: '지금은 보내지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500, headers: jsonHeaders() });
  }

  notifyDiscord({ type: parsed.data.type, message, contactEmail, appContext })
    .then(async (result) => {
      if (!result.skipped) {
        await supabase
          .from('support_reports')
          .update({
            discord_notified_at: result.ok ? new Date().toISOString() : null,
            discord_notify_error: result.ok ? null : `status:${result.status ?? 'unknown'}`,
          })
          .eq('id', data.id);
      }
    })
    .catch(async () => {
      await supabase
        .from('support_reports')
        .update({ discord_notify_error: 'notify_failed' })
        .eq('id', data.id);
    });

  return NextResponse.json({ ok: true, persisted: true, message: '보내주셔서 감사합니다. 확인해 볼게요.' }, { headers: jsonHeaders() });
}
