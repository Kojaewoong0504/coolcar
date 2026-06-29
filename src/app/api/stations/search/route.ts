import { NextResponse } from 'next/server';
import { searchStations } from '@/lib/stations';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  return NextResponse.json({ stations: searchStations(q) });
}
