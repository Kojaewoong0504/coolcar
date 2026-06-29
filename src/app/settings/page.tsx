import { AuthMergeOnLoad } from '@/components/auth/AuthMergeOnLoad';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { providerLabel } from '@/lib/auth/profile';
import { getCurrentAuthProfile } from '@/lib/supabase/server';

function Avatar({ name, src }: { name: string; src: string | null }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || '🙂';
  return src ? <img className="profile-avatar large" src={src} alt="" referrerPolicy="no-referrer" /> : <span className="profile-avatar large avatar-fallback">{initial}</span>;
}

export default async function SettingsPage() {
  const profile = await getCurrentAuthProfile();

  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>설정</div><a className="ghost" href="/">홈</a></header>
      <section className="hero-card compact"><p className="eyebrow">Personalization</p><h1>내가 편한 지하철<br />기준을 저장해요.</h1><p>로그인하면 저장 경로와 피드백을 계정에 연결해 여러 기기에서 이어갈 수 있어요.</p></section>
      <section className="card settings-list">
        <div><b>기본 성향</b><span>더위형 / 추위형 / 혼잡회피 / 밸런스</span></div>
        <div><b>교통약자석 배려 모드</b><span>켜짐 — 착석 유도가 아닌 위치 참고만 제공</span></div>
        <div><b>데이터 신뢰도 표시</b><span>모든 추천 결과에 실측·통계·추정·커뮤니티 배지 표시</span></div>
        <div><b>API 캐싱</b><span>TMAP 무료 quota 보호를 위해 캐시가 없으면 추정 추천으로 안내</span></div>
      </section>
      <section className="card">
        <div className="section-title">계정</div>
        {profile ? (
          <div className="account-card rich">
            <Avatar name={profile.displayName} src={profile.avatarUrl} />
            <div className="account-main">
              <p className="account-name"><b>{profile.displayName}</b></p>
              <p className="microcopy">{providerLabel(profile.provider)}로 로그인됨{profile.email ? ` · ${profile.email}` : ''}</p>
              <AuthMergeOnLoad />
            </div>
            <LogoutButton />
          </div>
        ) : (
          <><p className="notice">로그인하지 않아도 추천은 바로 사용할 수 있어요. 저장 경로 동기화가 필요할 때만 소셜 로그인을 사용합니다.</p><SocialLoginButtons next="/settings" /></>
        )}
      </section>
      <section className="card"><div className="section-title">운영 원칙</div><p className="notice">실시간 데이터가 없는 구간은 “현재 가장 덜 붐빔”처럼 말하지 않고, 시간대 패턴 기반 참고 추천으로 안내합니다.</p><div className="result-actions"><a href="/data-source">데이터 출처 보기</a><a href="/privacy">개인정보 안내</a></div></section>
      <nav className="tabbar"><a href="/">홈</a><a href="/saved">저장</a><a href="/data-source">데이터</a><a className="active" href="/settings">설정</a></nav>
    </main>
  );
}
