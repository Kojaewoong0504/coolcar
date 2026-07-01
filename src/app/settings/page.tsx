import Link from 'next/link';
import { TabBar } from '@/components/TabBar';
import { AuthMergeOnLoad } from '@/components/auth/AuthMergeOnLoad';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { ProfileAvatar } from '@/components/auth/ProfileAvatar';
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
        <p className="eyebrow">내 정보</p>
        <h1>저장한 경로와<br />계정을 관리해요.</h1>
        <p>시원칸 추천은 로그인 없이도 바로 사용할 수 있어요. 로그인하면 저장 루틴을 다른 기기에서도 이어볼 수 있습니다.</p>
      </section>

      <section className="card settings-section-card account-section-card">
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
          <div className="account-card anonymous-account-card">
            <div className="settings-row-icon" aria-hidden="true">👤</div>
            <div>
              <b>로그인 없이 이용 중</b>
              <p className="microcopy">지금도 시원한 칸 추천과 이 기기 저장 루틴을 사용할 수 있어요.</p>
            </div>
            <Link className="primary account-login-link" href="/login?next=/settings">로그인하기</Link>
            <p className="microcopy account-login-note">다른 기기에서도 저장 루틴을 보려면 로그인해 주세요.</p>
          </div>
        )}
      </section>

      <section className="card settings-section-card">
        <div className="section-title">내 경로</div>
        <Link className="settings-link-row" href="/saved">
          <span className="settings-row-icon" aria-hidden="true">📍</span>
          <span><b>저장한 경로</b><small>자주 타는 경로를 바로 다시 추천받아요.</small></span>
          <em aria-hidden="true">›</em>
        </Link>
      </section>

      <section className="card settings-section-card">
        <div className="section-title">시원칸 안내</div>
        <div className="settings-menu-list">
          <Link className="settings-link-row" href="/data-source">
            <span className="settings-row-icon" aria-hidden="true">🧊</span>
            <span><b>추천 기준</b><small>더운 날 타기 좋은 칸을 고르는 방식을 확인해요.</small></span>
            <em aria-hidden="true">›</em>
          </Link>
          <Link className="settings-link-row" href="/tips">
            <span className="settings-row-icon" aria-hidden="true">💡</span>
            <span><b>이용 팁</b><small>여름철 지하철을 조금 더 시원하게 타는 방법을 모았어요.</small></span>
            <em aria-hidden="true">›</em>
          </Link>
          <div className="settings-info-row">
            <span className="settings-row-icon" aria-hidden="true">🤝</span>
            <span><b>배려 안내</b><small>교통약자석 주변 정보는 착석 유도가 아닌 위치 참고로만 안내해요.</small></span>
          </div>
        </div>
      </section>

      <section className="card settings-section-card">
        <div className="section-title">고객 지원 및 정보</div>
        <div className="settings-menu-list">
          <Link className="settings-link-row" href="/support/new?from=settings">
            <span className="settings-row-icon" aria-hidden="true">💬</span>
            <span><b>문의 및 문제 제보</b><small>앱 사용 중 불편한 점이나 개선 의견을 보내주세요.</small></span>
            <em aria-hidden="true">›</em>
          </Link>
          <Link className="settings-link-row" href="/privacy">
            <span className="settings-row-icon" aria-hidden="true">🔒</span>
            <span><b>개인정보 안내</b><small>로그인 정보와 기기 저장 정보를 어떻게 쓰는지 확인해요.</small></span>
            <em aria-hidden="true">›</em>
          </Link>
          <Link className="settings-link-row" href="/data-source">
            <span className="settings-row-icon" aria-hidden="true">ℹ️</span>
            <span><b>앱 정보</b><small>시원칸은 공개 자료와 시간대 패턴을 참고해 안내해요.</small></span>
            <em aria-hidden="true">›</em>
          </Link>
        </div>
      </section>

      <TabBar active="settings" />
    </main>
  );
}
