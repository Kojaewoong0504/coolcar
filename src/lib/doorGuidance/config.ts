export function getSeoulOpenApiKey() {
  return process.env.SEOUL_OPENAPI_KEY?.trim() || process.env.SEOUL_OPEN_API_KEY?.trim() || '';
}

export function getSeoulOpenApiBaseUrl() {
  return (process.env.SEOUL_OPENAPI_BASE_URL?.trim() || 'http://openapi.seoul.go.kr:8088').replace(/\/+$/, '');
}

export function getSeoulOpenApiTimeoutMs() {
  const raw = Number(process.env.SEOUL_OPENAPI_TIMEOUT_MS ?? 1500);
  if (!Number.isFinite(raw) || raw < 300) return 1500;
  return Math.min(raw, 5000);
}

export function isPublicDoorGuideEnabled() {
  return Boolean(getSeoulOpenApiKey());
}
