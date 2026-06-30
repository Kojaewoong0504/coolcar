import { NextResponse } from 'next/server';
import { buildRoutePlanCandidates } from '@/lib/routePlans';
import { routePlansRequestSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = routePlansRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.' } }, { status: 400 });
  }

  const plans = await buildRoutePlanCandidates(parsed.data);
  return NextResponse.json(plans);
}
