export type CoolcarTip = {
  slug: string;
  icon: string;
  title: string;
  subtitle: string;
  category: string;
  heroTitle: string;
  heroSubtitle: string;
  source: {
    label: string;
    note: string;
    url: string;
  };
  steps: Array<{ no: string; title: string; description: string }>;
};

export const COOLCAR_TIPS: CoolcarTip[] = [
  {
    slug: 'cool-end',
    icon: '🚇',
    title: '양끝 칸',
    subtitle: '덥다면 중앙보다 끝쪽',
    category: '시원칸',
    heroTitle: '덥다면\n양끝 쪽부터',
    heroSubtitle: '열차 상황에 따라 다르지만, 객실 중앙보다 양끝이 덜 덥게 느껴질 수 있어요.',
    source: {
      label: '서울시 내 손안에 서울 · 서울교통공사 냉방 안내',
      note: '객실 중앙부는 상대적으로 온도가 높고, 객실 양쪽 끝은 낮다는 안내를 참고했어요.',
      url: 'https://mediahub.seoul.go.kr/archives/2018347',
    },
    steps: [
      { no: '01', title: '중앙이 답답하면 끝쪽 보기', description: '사람이 몰린 중앙부가 덥게 느껴지면 양끝 칸 방향을 먼저 확인해요.' },
      { no: '02', title: '무리한 이동은 피하기', description: '혼잡할 땐 억지로 이동하지 말고 다음 정차 후 움직이는 편이 안전해요.' },
      { no: '03', title: '추천칸과 같이 보기', description: '앱의 추천칸은 칸 위치와 경로 동선을 함께 보고 골라줘요.' },
    ],
  },
  {
    slug: 'weak-cool',
    icon: '🌡️',
    title: '약냉방칸',
    subtitle: '추위를 타면 여기',
    category: '약냉방',
    heroTitle: '추우면\n약냉방칸',
    heroSubtitle: '서울교통공사 공개 데이터 기준으로 호선별 약냉방칸 위치가 달라요.',
    source: {
      label: '서울 열린데이터광장 · 서울교통공사 호선별 약냉방칸 위치정보',
      note: '3·4호선은 4·7번째, 5·6·7호선은 4·5번째, 8호선은 3·4번째 칸을 참고해요. 1·2호선은 약냉방칸을 운영하지 않아요.',
      url: 'https://data.seoul.go.kr/dataList/OA-22530/F/1/datasetView.do',
    },
    steps: [
      { no: '01', title: '1·2호선은 일반냉방', description: '서울교통공사 공개 자료 기준 1·2호선은 약냉방칸을 따로 운영하지 않아요.' },
      { no: '02', title: '3~8호선은 위치 확인', description: '3·4호선은 4·7번째, 5·6·7호선은 4·5번째, 8호선은 3·4번째 칸을 참고해요.' },
      { no: '03', title: '더위 민감이면 피하기', description: '시원칸 추천을 원한다면 약냉방칸보다 일반냉방 쪽을 우선으로 봐요.' },
    ],
  },
  {
    slug: 'heatwave',
    icon: '💧',
    title: '폭염 이동',
    subtitle: '물 먼저, 무리하지 않기',
    category: '폭염',
    heroTitle: '폭염일 땐\n물 먼저',
    heroSubtitle: '갈증 전에도 물을 챙기고, 어지러우면 바로 쉬는 게 좋아요.',
    source: {
      label: '기상청 날씨누리·국민안전24 폭염 행동요령',
      note: '폭염 시 물을 자주 마시고, 현기증·메스꺼움·두통 등이 있으면 시원한 곳으로 이동해 쉬라는 행동요령을 참고했어요.',
      url: 'https://www.weather.go.kr/w/hazard/safety-guide/heatwave.do',
    },
    steps: [
      { no: '01', title: '물병 챙기기', description: '긴 이동 전에는 물을 챙기고, 카페인 음료보다 물을 먼저 마셔요.' },
      { no: '02', title: '증상 있으면 쉬기', description: '현기증, 메스꺼움, 두통이 있으면 이동을 멈추고 시원한 곳에서 쉬어요.' },
      { no: '03', title: '혼잡 시간 피하기', description: '가능하면 가장 붐비는 시간대를 피해 이동하면 체감 더위를 줄일 수 있어요.' },
    ],
  },
  {
    slug: 'transfer',
    icon: '↔️',
    title: '환승 동선',
    subtitle: '덜 걷는 경로 먼저',
    category: '환승',
    heroTitle: '덜 걷고\n덜 답답하게',
    heroSubtitle: '긴 환승 통로와 계단 이동은 더운 날 체감 피로를 키울 수 있어요.',
    source: {
      label: '서울 열린데이터광장 · 서울교통공사 서울 도시철도 환승정보',
      note: '환승역별 최단 환승 경로, 하차 위치, 환승 승차 위치, 소요시간 정보를 제공하는 공공 데이터를 참고했어요.',
      url: 'https://data.seoul.go.kr/dataList/OA-22521/F/1/datasetView.do',
    },
    steps: [
      { no: '01', title: '환승역 먼저 보기', description: '돌아가는 환승보다 이동거리가 짧은 경로를 먼저 확인해요.' },
      { no: '02', title: '계단·통로 줄이기', description: '더운 날에는 몇 칸 차이보다 긴 통로를 줄이는 게 더 편할 수 있어요.' },
      { no: '03', title: '환승 후 다시 보기', description: '환승했다면 다음 구간 추천칸을 다시 확인하면 더 정확해요.' },
    ],
  },
];

export function getTip(slug: string) {
  return COOLCAR_TIPS.find((tip) => tip.slug === slug);
}
