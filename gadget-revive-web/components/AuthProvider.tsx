'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkAuth, hasHydrated } = useAuthStore();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for zustand/persist to replay the token from localStorage before
    // calling the profile endpoint — otherwise the first call goes out without
    // a bearer and returns 401, wiping the session on refresh.
    if (!hasHydrated) return;

    // Skip auth check on auth pages — there's no session to restore and the
    // /auth/me call would 401, triggering interceptor side-effects that crash
    // mobile browsers when combined with concurrent Header API calls.
    if (pathname.startsWith('/auth')) return;

    checkAuth();
  }, [checkAuth, pathname, hasHydrated]);

  return <>{children}</>;
}
