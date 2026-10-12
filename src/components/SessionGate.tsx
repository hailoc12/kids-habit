'use client';
// SessionGate — mount trong Shell + các trang parent: hết session (logout/mất cookie) → về /login
import { useEffect } from 'react';

export default function SessionGate() {
  useEffect(() => {
    fetch('/api/auth', { cache: 'no-store' }).then((r) => {
      if (r.status === 401) window.location.href = '/login';
    }).catch(() => {});
  }, []);
  return null;
}
