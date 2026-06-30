import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COOLCAR_TIPS, getTip } from '@/lib/tips';

export function generateStaticParams() {
  return COOLCAR_TIPS.map((tip) => ({ slug: tip.slug }));
}

export default async function TipDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tip = getTip(slug);
  if (!tip) notFound();

  return (
    <main className="shell with-tabbar tip-detail-page">
      <header className="topbar"><Link className="ghost" href="/tips">← 팁</Link><span className="result-kicker">팁 상세</span></header>

      <section className="card tip-detail-hero">
        <p className="eyebrow">{tip.category}</p>
        <h1>{tip.heroTitle.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</h1>
        <p>{tip.heroSubtitle}</p>
      </section>

      <section className="tip-step-list" aria-label={`${tip.title} 상세 팁`}>
        {tip.steps.map((step) => (
          <article className="tip-step-card" key={step.no}>
            <span>{step.no}</span>
            <div>
              <b>{step.title}</b>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </section>

      <Link className="tip-route-cta" href="/">
        <b>내 경로로 바로 추천받기</b>
        <span aria-hidden="true">›</span>
      </Link>

      <nav className="tabbar"><Link href="/">홈</Link><Link href="/saved">저장</Link><Link className="active" href="/tips">팁</Link><Link href="/settings">내 정보</Link></nav>
    </main>
  );
}
