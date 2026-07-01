import Link from 'next/link';
import { TabBar } from '@/components/TabBar';

export default function DataSourcePage() {
  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>추천 기준</div><Link className="ghost" href="/">홈</Link></header>
      <section className="hero-card compact"><p className="eyebrow">추천 기준</p><h1>왜 이 칸을<br />추천했는지 알려드려요.</h1><p>시원칸은 노선, 시간대, 칸 위치, 환승 동선을 함께 보고 더 시원하게 탈 가능성이 높은 칸을 안내해요.</p></section>
      <section className="card source-grid">
        <div><b>덜 더운 위치</b><p>양끝·중앙 위치 차이와 시간대별 패턴을 함께 봐요.</p></div>
        <div><b>너무 붐비지 않게</b><p>혼잡할 가능성이 큰 칸은 되도록 피해서 안내해요.</p></div>
        <div><b>환승과 하차 동선</b><p>검증된 정보가 있으면 갈아타거나 내릴 때 덜 걷는 위치도 함께 봐요.</p></div>
        <div><b>피드백 반영</b><p>추천이 달랐다면 결과 화면에서 알려 주세요. 다음 개선에 참고해요.</p></div>
      </section>
      <section className="card"><div className="section-title">알고 타면 좋아요</div><ul className="reasons"><li>실시간 정보가 있는 구간은 공개된 혼잡·운행 정보를 먼저 참고해요.</li><li>정보가 부족한 구간은 실시간처럼 말하지 않고 참고 추천으로 안내해요.</li><li>열차 편성, 냉방 상태, 승객 흐름에 따라 실제 체감은 달라질 수 있어요.</li></ul><p className="notice">추천은 참고용이에요. 플랫폼과 열차 안 안내를 함께 확인해 주세요.</p></section>
      <TabBar active="settings" />
    </main>
  );
}
