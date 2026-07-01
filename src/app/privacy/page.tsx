import Link from 'next/link';
import { TabBar } from '@/components/TabBar';

export default function PrivacyPage() {
  return (
    <main className="shell with-tabbar privacy-page">
      <header className="topbar">
        <div className="logo"><img className="logo-mark logo-image" src="/icons/icon-192.png" alt="시원칸 앱 아이콘" />개인정보 안내</div>
        <Link className="ghost" href="/settings">내 정보</Link>
      </header>

      <section className="hero-card compact privacy-hero">
        <p className="eyebrow">개인정보 안내</p>
        <h1>필요한 정보만<br />추천과 저장에 사용해요.</h1>
        <p>시원칸은 로그인 없이도 사용할 수 있고, 로그인은 저장 루틴을 여러 기기에서 이어볼 때만 선택하면 됩니다.</p>
      </section>

      <section className="card privacy-section-card">
        <div className="section-title">로그인 없이 사용할 때</div>
        <div className="settings-list compact-settings-list">
          <div><b>입력한 경로</b><span>출발역, 도착역, 선택한 노선 정보를 시원한 칸 추천에 사용해요.</span></div>
          <div><b>이 기기 저장</b><span>저장한 경로와 선택 기준은 현재 기기에서 다시 추천받을 때 사용돼요.</span></div>
          <div><b>현재 위치</b><span>현재 위치는 수집하지 않아요. 사용자가 입력한 역 정보만 추천에 사용합니다.</span></div>
        </div>
      </section>

      <section className="card privacy-section-card">
        <div className="section-title">로그인할 때 사용하는 정보</div>
        <div className="settings-list compact-settings-list">
          <div><b>계정 표시</b><span>이름, 이메일, 프로필 이미지를 내 정보 화면에 표시해요.</span></div>
          <div><b>저장 루틴 이어보기</b><span>로그인하면 저장한 경로를 다른 기기에서도 이어볼 수 있어요.</span></div>
          <div><b>소셜 로그인</b><span>Google, Kakao, Apple 로그인은 본인 확인과 계정 연결에만 사용해요.</span></div>
        </div>
      </section>

      <section className="card privacy-section-card">
        <div className="section-title">추천 개선과 피드백</div>
        <p className="notice">결과 화면에서 남긴 피드백은 추천 품질을 점검하는 데 참고합니다. 시원칸은 실제 냉방 상태를 보장하지 않고, 공개 자료와 시간대 패턴을 바탕으로 덜 더울 가능성이 높은 칸을 안내해요.</p>
      </section>

      <section className="card privacy-section-card">
        <div className="section-title">데이터 관리</div>
        <div className="settings-list compact-settings-list">
          <div><b>로그아웃</b><span>내 정보 화면에서 로그아웃할 수 있어요.</span></div>
          <div><b>기기 데이터</b><span>비로그인 상태의 저장 정보는 이 기기에 남아 있을 수 있어요.</span></div>
          <div><b>문의와 삭제 요청</b><span>계정과 저장 정보 삭제가 필요하면 앱 내 문의 경로를 통해 요청할 수 있어요.</span></div>
        </div>
      </section>

      <TabBar active="settings" />
    </main>
  );
}
