import { useAuthStore } from '@/lib/stores/auth-store';
import { useEffect } from 'react';

/**
 * Debug component to monitor auth state
 * Only renders in development
 * Remove in production
 */
export default function AuthDebugger() {
  const authState = useAuthStore();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Auth State:', {
        isAuthenticated: authState.isAuthenticated,
        user: authState.user,
        role: authState.user?.role,
        token: authState.token ? `${authState.token.substring(0, 20)}...` : null,
      });
    }
  }, [authState.isAuthenticated, authState.user, authState.token]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <div className="font-bold mb-2">🔐 Auth Debug</div>
      <div className="space-y-1">
        <div>Status: {authState.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}</div>
        <div>User: {authState.user?.name || 'N/A'}</div>
        <div>Email: {authState.user?.email || 'N/A'}</div>
        <div>Role: {authState.user?.role || 'N/A'}</div>
        <div>Token: {authState.token ? '✅ Present' : '❌ Missing'}</div>
      </div>
    </div>
  );
}
