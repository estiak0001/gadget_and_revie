'use client';

import Link from 'next/link';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

interface BreadcrumbItem {
  name: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  darkBg?: boolean;
}

export default function Breadcrumb({ items, showHome = true, darkBg = false }: BreadcrumbProps) {
  const textColor = darkBg ? 'text-gray-200' : 'text-gray-600';
  const hoverColor = darkBg ? 'hover:text-white' : 'hover:text-gray-900';
  const chevronColor = darkBg ? 'text-gray-400' : 'text-gray-400';
  const lastItemColor = darkBg ? 'text-gray-300' : 'text-gray-900';
  const homeIconColor = darkBg ? 'text-gray-200' : 'text-gray-600';

  return (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-sm" aria-label="Breadcrumb">
      {showHome && (
        <>
          <Link
            href="/"
            className={`${homeIconColor} ${hoverColor} transition-colors shrink-0`}
          >
            <HomeIcon className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
          <ChevronRightIcon className={`h-4 w-4 shrink-0 ${chevronColor}`} />
        </>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center gap-x-1.5 min-w-0">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className={`${textColor} ${hoverColor} transition-colors font-medium whitespace-nowrap`}
              >
                {item.name}
              </Link>
            ) : (
              <span className={`font-medium ${isLast ? `${lastItemColor} max-w-[200px] sm:max-w-none truncate` : `${textColor} whitespace-nowrap`}`}>
                {item.name}
              </span>
            )}
            {!isLast && (
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
