import { NextResponse } from 'next/server';
import { searchStations } from '@/lib/stations';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Station } from '@/lib/stations';

function normalizeStationName(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/역$/, '');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const line = searchParams.get('line') ?? undefined;
  const limitParam = Number(searchParams.get('limit') ?? '20');
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1), 50);

  // 사용자 입력 자동완성은 500ms 미만 체감이 우선이다.
  // 넓은 static master를 즉시 반환하고, DB는 향후 관리/검증 배치에서 보강한다.
  const staticStations = searchStations(q, { line, limit });
  if (staticStations.length > 0) {
    return NextResponse.json({ stations: staticStations, source: 'STATIC_MASTER' });
  }

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const normalized = normalizeStationName(q);
    let query = supabase
      .from('stations')
      .select('name,line,operator,external_code,lat,lng')
      .order('name', { ascending: true })
      .limit(limit);

    if (line) query = query.eq('line', line);
    if (normalized) query = query.ilike('name', `%${normalized}%`);

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      const stations: Station[] = data.map((row) => ({
        name: row.name,
        line: row.line,
        operator: row.operator ?? '수도권 전철',
        stationCode: row.external_code ?? undefined,
        lat: row.lat === null ? undefined : Number(row.lat),
        lng: row.lng === null ? undefined : Number(row.lng),
      }));
      return NextResponse.json({ stations, source: 'DB' });
    }
  }

  return NextResponse.json({ stations: [], source: 'STATIC_MASTER' });
}
