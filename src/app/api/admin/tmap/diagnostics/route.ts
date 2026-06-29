import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runTmapDiagnosticProbe } from '@/lib/tmap/diagnostics';
import { getTmapConfig } from '@/lib/tmap/config';
import { logProviderDiagnosticEvent } from '@/lib/providerDiagnosticsLog';

const schema = z.object({
  line: z.string().default('2호선'),
  station: z.string().default('강남'),
  targetTime: z.string().optional(),
  dow: z.string().optional(),
  hh: z.string().optional(),
});

function isAuthorized(request: Request) {
  const config = getTmapConfig();
  if (process.env.NODE_ENV !== 'production' && !config.diagnosticsToken) return true;
  const auth = request.headers.get('authorization') ?? '';
  return Boolean(config.diagnosticsToken && auth === `Bearer ${config.diagnosticsToken}`);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '진단 endpoint 접근 권한이 없습니다.' } }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.' } }, { status: 400 });
  }

  const diagnostic = await runTmapDiagnosticProbe(parsed.data);
  const logResult = await logProviderDiagnosticEvent(diagnostic);

  return NextResponse.json({
    ok: diagnostic.ok,
    code: diagnostic.code,
    httpStatus: diagnostic.httpStatus ?? null,
    message: diagnostic.message,
    safeRequest: {
      endpointHost: diagnostic.endpointHost,
      endpointPath: diagnostic.endpointPath,
      appKeyPresent: diagnostic.appKeyPresent,
      appKeySource: diagnostic.appKeySource ?? null,
      appKeyRedacted: diagnostic.appKeyRedacted,
      params: diagnostic.params,
    },
    responseSnippet: diagnostic.responseSnippet ?? null,
    durationMs: diagnostic.durationMs,
    logged: logResult.persisted,
  }, { status: diagnostic.ok ? 200 : 200 });
}
