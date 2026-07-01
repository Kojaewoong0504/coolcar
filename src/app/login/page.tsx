import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import Link from 'next/link';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const next = params?.next && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : '/settings';
  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>시원칸 로그인</div><Link className="ghost" href="/">홈</Link></header>
      <section className="hero-card compact">
        <p className="eyebrow">OPTIONAL LOGIN</p>
        <h1>저장 루틴을<br />어디서나 이어서.</h1>
        <p>추천은 로그인 없이도 사용할 수 있어요. Google 또는 Kakao로 로그인하면 저장한 루틴을 여러 기기에서 이어서 볼 수 있어요.</p>
      </section>
      <section className="card">
        <div className="section-title">소셜 로그인</div>
        <SocialLoginButtons next={next} />
        <p className="microcopy">로그인은 저장 루틴을 다른 기기에서도 볼 때만 필요해요. 프로필 사진과 이름은 계정 화면에만 표시합니다.</p>
      </section>
      <section className="card">
        <div className="section-title">기존 루틴 이어보기</div>
        <p className="notice">이 기기에 저장해 둔 루틴은 로그인 후 계정에서 이어서 볼 수 있어요.</p>
      </section>
      <nav className="tabbar"><Link href="/"><span>⌂</span>홈</Link><Link href="/saved"><span>★</span>저장</Link><Link href="/tips"><span>✦</span>팁</Link><Link href="/settings"><span>◌</span>내 정보</Link></nav>
    </main>
  );
}
