import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';

export default function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  void searchParams;
  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>시원칸 로그인</div><a className="ghost" href="/">홈</a></header>
      <section className="hero-card compact">
        <p className="eyebrow">Optional login</p>
        <h1>저장 경로를<br />기기 밖에서도.</h1>
        <p>첫 추천은 계속 익명으로 가능해요. 로그인하면 저장 경로와 선호도를 여러 기기에서 이어갈 수 있게 준비합니다.</p>
      </section>
      <section className="card">
        <div className="section-title">소셜 로그인</div>
        <SocialLoginButtons next="/settings" />
        <p className="microcopy">Supabase Auth의 Kakao/Google/Apple provider 설정과 redirect URL 등록이 완료된 provider부터 사용할 수 있어요.</p>
      </section>
      <section className="card">
        <div className="section-title">익명 데이터 연결</div>
        <p className="notice">이 기기의 익명 추천·피드백·저장 경로는 `coolcar_anonymous_id`로 보관됩니다. 로그인 후 설정 화면에서 자동으로 계정에 연결합니다.</p>
      </section>
      <nav className="tabbar"><a href="/">홈</a><a href="/saved">저장</a><a href="/data-source">데이터</a><a href="/settings">설정</a></nav>
    </main>
  );
}
