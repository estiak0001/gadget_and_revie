'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Sidebar, { canAccessPath } from './Sidebar';
import Header from './Header';
import { cn } from '@/lib/utils';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  // AdminLayout remounts on every page navigation, so the initial state must
  // be resolved synchronously from the viewport (and the saved preference) to
  // avoid a collapsed→expanded flicker on desktop.
  const isDesktopNow = () =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  const desktopPrefOpen = () => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('admin_sidebar_open');
    return stored === null ? true : stored === '1';
  };

  const [isDesktop, setIsDesktop] = useState(isDesktopNow);
  // Desktop: open/collapsed per saved preference. Mobile: off-canvas, closed.
  const [sidebarOpen, setSidebarOpen] = useState(() => isDesktopNow() && desktopPrefOpen());

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // React to breakpoint changes only (not on mount — initial state is already
  // resolved above, so attaching a listener avoids any flicker).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      setIsDesktop(mq.matches);
      setSidebarOpen(mq.matches ? desktopPrefOpen() : false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Close the mobile drawer on an actual route change.
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (!isDesktop) {
        setSidebarOpen(false);
      }
    }
  }, [pathname, isDesktop]);

  // Toggle and persist the desktop collapse preference so it survives the
  // per-page remount.
  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (isDesktop && typeof window !== 'undefined') {
        window.localStorage.setItem('admin_sidebar_open', next ? '1' : '0');
      }
      return next;
    });
  };

  // Lock body scroll while the mobile drawer is open so scrolling stays inside
  // the sidebar instead of moving the page behind it.
  useEffect(() => {
    const shouldLock = sidebarOpen && !isDesktop;
    document.body.style.overflow = shouldLock ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen, isDesktop]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login') {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // Menu-wise access guard — hides a page even if someone navigates straight to its URL
  // instead of clicking the (already-filtered) sidebar. Real enforcement is the API's
  // `permission:` middleware; this just avoids landing on a dead page.
  useEffect(() => {
    if (!isLoading && isAuthenticated && !canAccessPath(pathname, user?.role, user?.permissions)) {
      toast.error("You don't have access to that section");
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, pathname, user?.role, user?.permissions, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} />

      {/* Mobile backdrop — tap to close the drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          'transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        )}
      >
        <Header onToggleSidebar={toggleSidebar} />
        <main className="p-3 sm:p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
