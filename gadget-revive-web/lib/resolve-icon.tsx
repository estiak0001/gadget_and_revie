import { TagIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';
import { ComponentType, SVGProps } from 'react';

type HeroIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const FALLBACK_ICON: HeroIconComponent = TagIcon;

// Cache resolved icons to avoid re-creating dynamic components
const iconCache = new Map<string, HeroIconComponent>();

/**
 * Lazily resolve a HeroIcon by name (e.g. "ComputerDesktopIcon").
 * Uses next/dynamic so only the requested icon is loaded — no wildcard import.
 */
export function resolveIcon(iconName: string | null | undefined): HeroIconComponent {
  if (!iconName) return FALLBACK_ICON;

  const cached = iconCache.get(iconName);
  if (cached) return cached;

  const LazyIcon = dynamic(
    () =>
      import('@heroicons/react/24/outline').then((mod) => {
        const icon = (mod as Record<string, unknown>)[iconName];
        // HeroIcons v2 exports are forwardRef components (typeof === 'object'),
        // not plain functions — accept either so the configured icon resolves
        // instead of always falling back.
        const isComponent = typeof icon === 'function' || (typeof icon === 'object' && icon !== null);
        return { default: isComponent ? (icon as HeroIconComponent) : FALLBACK_ICON };
      }),
    { ssr: false, loading: () => <span className="inline-block w-6 h-6" /> },
  );

  iconCache.set(iconName, LazyIcon);
  return LazyIcon;
}
