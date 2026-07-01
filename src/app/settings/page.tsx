import Link from 'next/link';
import { AuthMergeOnLoad } from '@/components/auth/AuthMergeOnLoad';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { ProfileAvatar } from '@/components/auth/ProfileAvatar';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { providerLabel } from '@/lib/auth/profile';
import { getCurrentAuthProfile } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const profile = await getCurrentAuthProfile();

  return (
    <main className="shell with-tabbar">
      <header className="topbar"><div className="logo"><span className="logo-mark">🧊</span>내 정보</div><Link className="ghost" href="/">홈</Link></header>
      <section className="hero-card compact"><p className="eyebrow">내 정보</p><h1>저장한 경로를<br />어디서든 이어가요.</h1><p>로그인하면 이 기기에서 저장한 루틴을 다른 기기에서도 볼 수 있어요.</p></section>
      <section className="card settings-list">
        <div><b>추천 기준</b><span>더운 날 타기 좋은 칸을 먼저 안내해요.</span></div>
        <div><b>저장 루틴</b><span>자주 타는 경로를 저장하고 바로 다시 추천받을 수 있어요.</span></div>
        <div><b>배려 안내</b><span>교통약자석 주변은 착석 유도가 아닌 위치 참고로만 안내해요.</span></div>
        <div><b>추천 안내</b><span>실시간 정보가 부족하면 참고 추천으로 표시해요.</span></div>
      </section>
      <section className="card">
        <div className="section-title">계정</div>
        {profile ? (
          <div className="account-card rich">
            <ProfileAvatar name={profile.displayName} src={profile.avatarUrl} large />
            <div className="account-main">
              <p className="account-name"><b>{profile.displayName}</b></p>
              <p className="microcopy">{providerLabel(profile.provider)}로 로그인됨{profile.email ? ` · ${profile.email}` : ''}</p>
              <AuthMergeOnLoad />
            </div>
            <LogoutButton />
          </div>
        ) : (
          <><p className="notice">로그인하지 않아도 추천은 바로 사용할 수 있어요. 저장한 경로를 다른 기기에서도 보고 싶을 때만 소셜 로그인을 사용해 주세요.</p><SocialLoginButtons next="/settings" /></>
        )}
      </section>
      <section className="card"><div className="section-title">앱 안내</div><p className="notice">시원칸은 공개 데이터와 시간대 패턴을 함께 참고해 더 시원하게 탈 가능성이 높은 칸을 안내해요. 실제 객실 온도와 혼잡은 열차 상황에 따라 달라질 수 있어요.</p><div className="result-actions"><Link href="/data-source">추천 기준 보기</Link><Link href="/privacy">개인정보 안내</Link></div></section>
      <nav className="tabbar"><Link href="/"><span>⌂</span>홈</Link><Link href="/saved"><span>★</span>저장</Link><Link href="/tips"><span>✦</span>팁</Link><Link className="active" href="/settings"><span>◌</span>내 정보</Link></nav>
    </main>
  );
}
