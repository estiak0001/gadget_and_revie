'use client';

import { usePathname } from 'next/navigation';
import TopBar from './TopBar';
import Header from './Header';
import Footer from './Footer';

// The walk-in kiosk runs full-bleed on a counter tablet: no store chrome, no footer, nothing
// competing with the big feedback faces. Exact match only — the customer's own SMS feedback link
// (/feedback/[token]) is a normal phone page and keeps the site layout.
const KIOSK_PATH = '/feedback';

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === KIOSK_PATH) {
    return <main className="min-h-dvh bg-ink">{children}</main>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopBar />
      <Header />
      <main className="flex-1 flex flex-col [&>*]:flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
