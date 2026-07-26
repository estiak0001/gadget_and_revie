'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import { useCompareStore } from '@/lib/stores/compare-store';

export default function SupportButton() {
  const pathname = usePathname();
  // Subscribing to just the length keeps re-renders tight — the button moves
  // in sync with adds/removes but doesn't re-render on unrelated store writes.
  const compareCount = useCompareStore((s) => s.items.length);

  // The dashboard has its own fixed bottom app dock on mobile; the support
  // button sits at the same corner and blocks the Settings tab tap target.
  // Hide it on any dashboard route — logged-in users have the "New Ticket"
  // action inside the dashboard itself.
  if (pathname.startsWith('/dashboard')) return null;

  // When the compare bar is visible it spans the full width at z-40 and the
  // support button would sit on top of the Clear / Compare Now actions on the
  // right edge. Lift the button above the compare bar (≈80px tall incl. safe
  // area) so both stay tappable.
  const bottomOffset = compareCount > 0
    ? 'calc(80px + env(safe-area-inset-bottom, 0px))'
    : 'max(1rem, env(safe-area-inset-bottom, 0px))';

  return (
    <Link
      href="/support/new"
      className="fixed right-4 sm:right-6 z-40 flex items-center gap-1.5 bg-ink hover:bg-ink/90 text-white px-4 py-3 sm:px-3 sm:py-2 rounded-full shadow-lg hover:shadow-md transition-all group border-2 border-green-400"
      style={{ bottom: bottomOffset, transition: 'bottom 200ms ease' }}
    >
      <ChatBubbleLeftRightIcon className="h-5 w-5 sm:h-4 sm:w-4 text-green-400" />
      <span className="text-xs font-medium">Support</span>
    </Link>
  );
}
