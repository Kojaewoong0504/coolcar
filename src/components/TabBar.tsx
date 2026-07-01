import Link from 'next/link';
import type { ReactNode } from 'react';

type TabKey = 'home' | 'saved' | 'tips' | 'settings';

type Tab = {
  key: TabKey;
  href: string;
  label: string;
  icon: ReactNode;
};

function HomeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M9.5 20v-6h5v6" /></svg>;
}

function BookmarkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h11v15L12 16l-5.5 3.5z" /></svg>;
}

function TipIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8v2.4" /><path d="M5.9 6.3l1.7 1.7" /><path d="M18.1 6.3 16.4 8" /><path d="M8.2 13.2a4.2 4.2 0 1 1 7.6 0c-.8 1.1-1.4 1.9-1.5 3.1H9.7c-.1-1.2-.7-2-1.5-3.1Z" /><path d="M9.8 19h4.4" /></svg>;
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z" /><path d="M4.8 20c1.1-3.3 3.7-5.2 7.2-5.2s6.1 1.9 7.2 5.2" /></svg>;
}

const tabs: Tab[] = [
  { key: 'home', href: '/', label: '홈', icon: <HomeIcon /> },
  { key: 'saved', href: '/saved', label: '저장', icon: <BookmarkIcon /> },
  { key: 'tips', href: '/tips', label: '팁', icon: <TipIcon /> },
  { key: 'settings', href: '/settings', label: '내 정보', icon: <UserIcon /> },
];

export function TabBar({ active }: { active: TabKey }) {
  return (
    <nav className="tabbar" aria-label="하단 메뉴">
      {tabs.map((tab) => (
        <Link className={tab.key === active ? 'active' : ''} href={tab.href} key={tab.key}>
          <span className="tabbar-icon">{tab.icon}</span>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
