'use client';

import { useState } from 'react';

function initial(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '🙂';
}

export function ProfileAvatar({ name, src, large = false }: { name: string; src: string | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const className = `profile-avatar${large ? ' large' : ''}`;
  if (src && !failed) return <img className={className} src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  return <span className={`${className} avatar-fallback`}>{initial(name)}</span>;
}
