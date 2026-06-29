'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.refresh();
  }
  return <button className="ghost" type="button" onClick={() => void logout()}>로그아웃</button>;
}
