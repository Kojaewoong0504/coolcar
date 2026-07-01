import Link from 'next/link';
import { TabBar } from '@/components/TabBar';
import { AuthMergeOnLoad } from '@/components/auth/AuthMergeOnLoad';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { ProfileAvatar } from '@/components/auth/ProfileAvatar';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { providerLabel } from '@/lib/auth/profile';
import { getCurrentAuthProfile } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const profile = await getCurrentAuthProfile();

  return (
    <main className="shell with-tabbar settings-page">
      <header className="topbar">
        <div className="logo"><img className="logo-mark logo-image" src="/icons/icon-192.png" alt="시원칸 앱 아이콘" />내 정보</div>
        <Link className="ghost" href="/">홈</Link>
      </header>

      <section className="hero-card compact settings-hero">
        <p className="eyebrow">계정 · 개인정보 · 앱 설정</p>
        <h1>내 경로와 설정을<br />한 곳에서 봐요.</h1>
        <p>추천은 로그인 없이도 쓸 수 있고, 로그인하면 저장 루틴을 다른 기기에서도 이어볼 수 있어요.</p>
      </section>

      <section className="card settings-section-card">
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
          <>
            <p className="notice">로그인 없이도 추천은 사용할 수 있어요. 저장 루틴을 여러 기기에서 보려면 소셜 로그인을 사용해 주세요.</p>
            <SocialLoginButtons next="/settings" />
          </>
        )}
      </section>

      <section className="card settings-section-card">
        <div className="section-title">개인정보 안내</div>
        <div className="settings-list compact-settings-list">
          <div><b>저장되는 정보</b><span>저장 루틴, 추천 기준, 피드백을 추천 개선에 참고해요.</span></div>
          <div><b>소셜 로그인</b><span>로그인 시 이름, 이메일, 프로필 이미지를 계정 표시에 사용해요.</span></div>
          <div><b>기기 저장</b><span>비로그인 상태에서는 이 기기에 저장된 정보로 루틴을 이어가요.</span></div>
        </div>
        <div className="result-actions"><Link href="/privacy">개인정보 안내 보기</Link></div>
      </section>

      <section className="card settings-section-card">
        <div className="section-title">앱 설정</div>
        <div className="settings-list compact-settings-list">
          <div><b>추천 기준</b><span>더운 날 타기 좋은 칸을 우선으로 안내해요.</span></div>
          <div><b>배려 안내</b><span>교통약자석 주변은 착석 유도가 아닌 위치 참고로만 다뤄요.</span></div>
          <div><b>저장 루틴</b><span>자주 타는 경로는 저장 탭에서 바로 다시 추천받을 수 있어요.</span></div>
        </div>
      </section>

      <section className="card settings-section-card">
        <div className="section-title">앱 정보</div>
        <p className="notice">시원칸은 공개 자료와 시간대 패턴을 참고해 덜 더운 칸을 안내해요. 실제 객실 상황은 열차와 시간대에 따라 달라질 수 있어요.</p>
        <div className="result-actions"><Link href="/data-source">추천 기준 보기</Link><Link href="/tips">이용 팁 보기</Link></div>
      </section>

      <TabBar active="settings" />
    </main>
  );
}
