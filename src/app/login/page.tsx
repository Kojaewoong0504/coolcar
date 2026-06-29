import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const next = params?.next && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : '/settings';
  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>시원칸 로그인</div><a className="ghost" href="/">홈</a></header>
      <section className="hero-card compact">
        <p className="eyebrow">OPTIONAL LOGIN</p>
        <h1>저장 루틴을<br />어디서나 이어서.</h1>
        <p>추천은 로그인 없이도 사용할 수 있어요. Google 또는 Kakao로 연결하면 저장한 루틴과 선호도를 여러 기기에서 이어서 볼 수 있어요.</p>
      </section>
      <section className="card">
        <div className="section-title">소셜 로그인</div>
        <SocialLoginButtons next={next} />
        <p className="microcopy">로그인은 저장 루틴을 안전하게 연결할 때만 필요해요. 프로필 사진과 이름은 계정 화면에만 표시합니다.</p>
      </section>
      <section className="card">
        <div className="section-title">기존 루틴 연결</div>
        <p className="notice">이 기기에 저장해 둔 추천·피드백·루틴은 로그인 후 자동으로 계정에 연결돼요.</p>
      </section>
      <nav className="tabbar"><a href="/">홈</a><a href="/saved">저장</a><a href="/data-source">데이터</a><a href="/settings">설정</a></nav>
    </main>
  );
}
