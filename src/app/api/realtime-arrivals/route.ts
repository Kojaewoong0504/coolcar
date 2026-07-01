import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchSeoulRealtimeArrivals } from '@/lib/seoulRealtimeSubway';

const querySchema = z.object({
  station: z.string().min(1).max(40),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    station: url.searchParams.get('station') ?? '',
    limit: url.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: { code: 'INVALID_INPUT', message: '역 이름과 조회 개수를 확인해 주세요.' },
    }, { status: 400 });
  }

  const result = await fetchSeoulRealtimeArrivals({
    stationName: parsed.data.station,
    startIndex: 0,
    endIndex: parsed.data.limit,
  });

  if (result.status !== 'available') {
    return NextResponse.json({
      ok: false,
      status: result.status,
      message: result.status === 'disabled'
        ? '실시간 도착 정보는 현재 앱에서 사용하지 않도록 설정되어 있어요.'
        : '실시간 도착 정보를 불러오지 못했어요.',
    }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    station: parsed.data.station,
    totalCount: result.totalCount,
    arrivals: result.arrivals.map((arrival) => ({
      lineName: arrival.lineName,
      subwayId: arrival.subwayId,
      updnLine: arrival.updnLine,
      trainLineNm: arrival.trainLineNm,
      statnNm: arrival.statnNm,
      secondsToArrival: arrival.barvlDt,
      trainNo: arrival.btrainNo,
      terminalStation: arrival.bstatnNm,
      receivedAt: arrival.recptnDt,
      arrivalMessage: arrival.arvlMsg2,
      arrivalStatus: arrival.arvlStatusLabel,
      isLastTrain: arrival.lstcarAt,
    })),
  });
}
