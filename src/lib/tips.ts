export type CoolcarTip = {
  slug: string;
  icon: string;
  title: string;
  subtitle: string;
  category: string;
  heroTitle: string;
  heroSubtitle: string;
  steps: Array<{ no: string; title: string; description: string }>;
};

export const COOLCAR_TIPS: CoolcarTip[] = [
  {
    slug: 'transfer',
    icon: '🚇',
    title: '환승',
    subtitle: '덜 걷고 덜 더운 선택',
    category: '환승',
    heroTitle: '덜 걷고\n덜 더운 선택',
    heroSubtitle: '긴 환승은 체감 더위를 키울 수 있어요.',
    steps: [
      { no: '01', title: '환승역 먼저 고르기', description: '돌아가는 환승보다 가까운 환승을 우선으로 봐요.' },
      { no: '02', title: '걷는 시간 줄이기', description: '계단·통로가 길면 시원한 칸보다 동선이 더 중요할 수 있어요.' },
      { no: '03', title: '칸 추천은 그 다음', description: '선택한 경로 기준으로 덜 덥고 갈아타기 쉬운 칸을 봐요.' },
    ],
  },
  {
    slug: 'cool-seat',
    icon: '🧊',
    title: '시원칸',
    subtitle: '어디가 덜 답답할까',
    category: '시원칸',
    heroTitle: '덜 답답한\n위치 찾기',
    heroSubtitle: '칸 위치와 혼잡 패턴을 함께 봐요.',
    steps: [
      { no: '01', title: '문 앞은 잠깐만', description: '승하차가 몰리면 문 앞 체감이 더 답답할 수 있어요.' },
      { no: '02', title: '중앙으로 한 발', description: '여유가 있으면 칸 안쪽으로 이동해 공기 흐름을 느껴보세요.' },
      { no: '03', title: '추천칸 기준 확인', description: '결과 화면의 추천칸과 피하기 칸을 같이 보면 좋아요.' },
    ],
  },
  {
    slug: 'routine',
    icon: '⭐',
    title: '루틴',
    subtitle: '매일 경로 빠르게 쓰기',
    category: '루틴',
    heroTitle: '출발 전에\n한 번만 누르기',
    heroSubtitle: '자주 타는 길은 저장해두면 편해요.',
    steps: [
      { no: '01', title: '추천 받고 저장', description: '결과 화면에서 경로를 저장하면 다음부터 바로 불러올 수 있어요.' },
      { no: '02', title: '출근 전 재추천', description: '저장 탭에서 오늘 상황 기준으로 다시 계산해요.' },
      { no: '03', title: '안 맞으면 삭제', description: '잘못 저장한 루틴은 저장 탭에서 바로 지울 수 있어요.' },
    ],
  },
  {
    slug: 'feedback',
    icon: '💬',
    title: '제보',
    subtitle: '탄 칸 느낌 남기기',
    category: '제보',
    heroTitle: '짧게 남기면\n추천이 좋아져요',
    heroSubtitle: '긴 리뷰 없이 버튼 한 번이면 충분해요.',
    steps: [
      { no: '01', title: '탔던 칸 확인', description: '추천 결과에서 실제로 탄 칸이 어땠는지 떠올려요.' },
      { no: '02', title: '버튼 한 번', description: '더웠어요, 붐볐어요, 좋았어요 중 가까운 걸 눌러요.' },
      { no: '03', title: '다음 추천 참고', description: '피드백이 쌓이면 같은 경로 추천을 개선하는 데 참고해요.' },
    ],
  },
];

export function getTip(slug: string) {
  return COOLCAR_TIPS.find((tip) => tip.slug === slug);
}
