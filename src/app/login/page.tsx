import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { TabBar } from '@/components/TabBar';
import Link from 'next/link';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const next = params?.next && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : '/settings';
  const hasError = Boolean(params?.error);

  return (
    <main className="shell with-tabbar login-page">
      <header className="topbar">
        <div className="logo"><img className="logo-mark logo-image" src="/icons/icon-192.png" alt="시원칸 앱 아이콘" />로그인</div>
        <Link className="ghost" href="/settings">내 정보</Link>
      </header>

      <section className="hero-card compact login-hero">
        <p className="eyebrow">선택 로그인</p>
        <h1>저장한 경로를<br />어디서나 이어봐요.</h1>
        <p>시원칸 추천은 로그인 없이도 사용할 수 있어요. 로그인하면 저장한 경로를 여러 기기에서 이어볼 수 있습니다.</p>
      </section>

      <section className="card login-card">
        <div className="section-title">간편 로그인</div>
        {hasError && <p className="notice error-notice">로그인에 실패했어요. 잠시 후 다시 시도해 주세요.</p>}
        <SocialLoginButtons next={next} />
        <p className="microcopy login-privacy-copy">이름, 이메일, 프로필 이미지는 계정 표시와 저장 루틴 동기화에만 사용해요.</p>
      </section>

      <section className="card login-card">
        <div className="section-title">로그인하지 않아도 괜찮아요</div>
        <p className="notice">이 기기에서는 추천과 저장 루틴을 바로 사용할 수 있어요. 다른 기기에서도 이어보고 싶을 때만 로그인해 주세요.</p>
        <div className="result-actions"><Link href={next}>로그인 없이 계속하기</Link><Link href="/privacy">개인정보 안내</Link></div>
      </section>

      <TabBar active="settings" />
    </main>
  );
}
