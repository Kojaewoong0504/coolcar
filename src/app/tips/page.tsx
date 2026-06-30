import Link from 'next/link';
import { COOLCAR_TIPS } from '@/lib/tips';

export default function TipsPage() {
  return (
    <main className="shell with-tabbar tips-page">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>시원칸</div><Link className="ghost" href="/saved">저장</Link></header>

      <section className="hero-card compact tips-hero">
        <p className="eyebrow">팁</p>
        <h1>덜 덥게<br />타는 법</h1>
        <p>필요할 때만 짧게 확인해요.</p>
      </section>

      <section className="tips-today-card" aria-label="오늘의 한 줄 팁">
        <span aria-hidden="true">🌬️</span>
        <div>
          <b>문 앞보다 한 발 안쪽</b>
          <p>더 답답하면 중앙 쪽으로 이동</p>
        </div>
      </section>

      <div className="tips-section-head"><b>카드 섹션</b><span>눌러서 자세히</span></div>
      <section className="tips-grid" aria-label="팁 카드 목록">
        {COOLCAR_TIPS.map((tip) => (
          <Link className="tip-tile" href={`/tips/${tip.slug}`} key={tip.slug}>
            <span className="tip-icon" aria-hidden="true">{tip.icon}</span>
            <b>{tip.title}</b>
            <small>{tip.subtitle}</small>
          </Link>
        ))}
      </section>

      <Link className="tips-check-card" href="/tips/routine">
        <div>
          <b>체크리스트</b>
          <p>타기 전 10초만 확인</p>
        </div>
        <span aria-hidden="true">›</span>
      </Link>

      <nav className="tabbar"><Link href="/">홈</Link><Link href="/saved">저장</Link><Link className="active" href="/tips">팁</Link><Link href="/settings">내 정보</Link></nav>
    </main>
  );
}
