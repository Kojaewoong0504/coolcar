export type Station = { name: string; line: string; operator: string; stationCode?: string; lat?: number; lng?: number };

export const STATIONS: Station[] = [
  { name: '강남역', line: '2호선', operator: '서울교통공사', stationCode: '222', lat: 37.4979, lng: 127.0276 },
  { name: '강남역', line: '신분당선', operator: '신분당선', stationCode: 'D07', lat: 37.4968, lng: 127.0283 },
  { name: '홍대입구역', line: '2호선', operator: '서울교통공사', stationCode: '239' },
  { name: '여의도역', line: '9호선', operator: '서울시메트로9호선', stationCode: '915' },
  { name: '신논현역', line: '9호선', operator: '서울시메트로9호선', stationCode: '925' },
  { name: '판교역', line: '신분당선', operator: '신분당선', stationCode: 'D11' },
  { name: '선릉역', line: '수인분당선', operator: '코레일' },
  { name: '왕십리역', line: '수인분당선', operator: '코레일' },
  { name: '사당역', line: '2호선', operator: '서울교통공사', stationCode: '226' },
  { name: '종로3가역', line: '1호선', operator: '서울교통공사', stationCode: '130' },
  { name: '고속터미널역', line: '3호선', operator: '서울교통공사', stationCode: '339' },
  { name: '서울역', line: '4호선', operator: '서울교통공사', stationCode: '426' },
  { name: '광화문역', line: '5호선', operator: '서울교통공사', stationCode: '533' },
  { name: '공덕역', line: '6호선', operator: '서울교통공사', stationCode: '626' },
  { name: '건대입구역', line: '7호선', operator: '서울교통공사', stationCode: '727' },
  { name: '잠실역', line: '8호선', operator: '서울교통공사', stationCode: '814' },
];

export function searchStations(query: string): Station[] {
  const q = query.trim().replace(/역$/, '');
  if (q.length < 1) return [];
  return STATIONS.filter((s) => s.name.replace(/역$/, '').includes(q) || s.line.includes(q)).slice(0, 10);
}

export function findStationCode(line: string, stationName: string): string | null {
  const normalized = stationName.trim().endsWith('역') ? stationName.trim() : `${stationName.trim()}역`;
  return STATIONS.find((station) => station.line === line && station.name === normalized)?.stationCode ?? null;
}
