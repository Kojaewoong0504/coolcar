import { AuthMergeOnLoad } from '@/components/auth/AuthMergeOnLoad';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { getCurrentUser } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const displayName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || '로그인 사용자';

  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>설정</div><a className="ghost" href="/">홈</a></header>
      <section className="hero-card compact"><p className="eyebrow">Personalization</p><h1>내가 편한 지하철<br />기준을 저장해요.</h1><p>v2 MVP는 익명 추천을 우선 제공하고, 소셜 로그인은 저장 경로 동기화와 개인화 고도화 단계로 연결합니다.</p></section>
      <section className="card settings-list">
        <div><b>기본 성향</b><span>더위형 / 추위형 / 혼잡회피 / 밸런스</span></div>
        <div><b>교통약자석 배려 모드</b><span>켜짐 — 착석 유도가 아닌 위치 참고만 제공</span></div>
        <div><b>데이터 신뢰도 표시</b><span>모든 추천 결과에 실측·통계·추정·커뮤니티 배지 표시</span></div>
        <div><b>API 캐싱</b><span>TMAP 통계형 칸 혼잡도는 Redis/메모리 캐시로 무료 API 호출을 보호</span></div>
      </section>
      <section className="card">
        <div className="section-title">계정</div>
        {user ? (
          <div className="account-card"><p><b>{displayName}</b></p><p className="microcopy">로그인됨 · 저장 경로를 사용자 계정으로 연결할 수 있는 기반이 준비됐어요.</p><AuthMergeOnLoad /><LogoutButton /></div>
        ) : (
          <><p className="notice">로그인하지 않아도 추천은 바로 사용할 수 있어요. 저장 경로 동기화가 필요할 때만 소셜 로그인을 사용합니다.</p><SocialLoginButtons next="/settings" /></>
        )}
      </section>
      <section className="card"><div className="section-title">운영 원칙</div><p className="notice">실시간 데이터가 없는 구간은 “현재 가장 덜 붐빔”처럼 말하지 않고, 시간대 패턴 기반 참고 추천으로 안내합니다.</p><div className="result-actions"><a href="/data-source">데이터 출처 보기</a><a href="/privacy">개인정보 안내</a></div></section>
      <nav className="tabbar"><a href="/">홈</a><a href="/saved">저장</a><a href="/data-source">데이터</a><a className="active" href="/settings">설정</a></nav>
    </main>
  );
}
