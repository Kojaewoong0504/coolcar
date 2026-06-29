import { getSupabaseAdmin } from './supabase';
import type { TmapDiagnosticRecord } from './tmap/diagnostics';

export async function logProviderDiagnosticEvent(record: TmapDiagnosticRecord) {
  const supabase = getSupabaseAdmin();
  const safePayload = {
    provider: record.provider,
    diagnostic_code: record.code,
    ok: record.ok,
    http_status: record.httpStatus ?? null,
    endpoint_host: record.endpointHost,
    endpoint_path: record.endpointPath,
    app_key_present: record.appKeyPresent,
    app_key_source: record.appKeySource ?? null,
    request_params: record.params,
    response_snippet: record.responseSnippet ?? null,
    duration_ms: record.durationMs,
    error_name: record.errorName ?? null,
    error_message: record.errorMessage ?? record.message,
  };

  if (!supabase) {
    console.warn('[provider-diagnostic]', safePayload);
    return { persisted: false };
  }

  const { error } = await supabase.from('provider_diagnostic_events').insert(safePayload);
  if (error) {
    console.warn('[provider-diagnostic:persist-failed]', { ...safePayload, supabaseError: error.message });
    return { persisted: false, warning: error.message };
  }

  return { persisted: true };
}
