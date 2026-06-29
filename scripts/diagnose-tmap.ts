#!/usr/bin/env tsx
import { loadEnvFile } from 'node:process';
import { runTmapDiagnosticProbe } from '../src/lib/tmap/diagnostics';
import { logProviderDiagnosticEvent } from '../src/lib/providerDiagnosticsLog';

async function main() {
  try {
    loadEnvFile('.env');
  } catch {
    // Runtime env may already be provided by Vercel/CI. Keep script quiet on missing local .env.
  }

  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    if (key && rest.length) args.set(key, rest.join('='));
  }

  const diagnostic = await runTmapDiagnosticProbe({
    line: args.get('line') ?? '2호선',
    station: args.get('station') ?? '강남',
    dow: args.get('dow') ?? undefined,
    hh: args.get('hh') ?? undefined,
    force: args.get('force') === 'true',
  });

  const logResult = await logProviderDiagnosticEvent(diagnostic);
  const output = {
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
    cacheHit: diagnostic.cacheHit ?? false,
    cacheTtlSeconds: diagnostic.cacheTtlSeconds ?? null,
    durationMs: diagnostic.durationMs,
    logged: logResult.persisted,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(diagnostic.ok ? 0 : 2);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, code: 'SCRIPT_ERROR', message: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
