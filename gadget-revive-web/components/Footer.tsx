'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PhoneIcon, MapPinIcon, EnvelopeIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { getBranding } from '@/lib/branding';

const DEFAULT_NAV_LINKS = [
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
  { name: 'Locations', href: '/locations' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' },
  { name: 'Returns', href: '/returns' },
];

// Brand glyphs (Heroicons has no brand icons) — paths reused across the site.
const SOCIAL_PATHS: Record<string, string> = {
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const realUrl = (v: unknown): string => {
  const s = str(v);
  return s && s !== '#' ? s : '';
};

export default function Footer() {
  const { data, fetched, fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const branding = getBranding(data);

  const phone = fetched ? str(data.topbar_phone) : '';
  const email = fetched ? str(data.footer_email) : '';
  const address = fetched ? str(data.topbar_address) : '';
  const hours = fetched ? str(data.topbar_hours) : '';
  const copyright = fetched
    ? (str(data.footer_copyright) || `© ${new Date().getFullYear()} ${branding.name}. All rights reserved.`)
    : '';
  const poweredBy = str(data.footer_powered_by) || branding.name;

  let navLinks = DEFAULT_NAV_LINKS;
  try {
    const raw = data.footer_nav_links;
    const parsed = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) navLinks = parsed;
  } catch { /* keep default */ }

  const phoneTel = phone.replace(/[\s\-()]/g, '');

  const socials = [
    { name: 'whatsapp', url: realUrl(data.contact_social_whatsapp) },
    { name: 'facebook', url: realUrl(data.facebook_url) || realUrl(data.contact_social_facebook) },
    { name: 'youtube', url: realUrl(data.youtube_url) || realUrl(data.contact_social_youtube) },
    { name: 'instagram', url: realUrl(data.instagram_url) || realUrl(data.contact_social_instagram) },
  ].filter((s) => s.url);

  const playStoreUrl = realUrl(data.play_store_url);
  const appStoreUrl = realUrl(data.app_store_url);

  const headingClass = 'text-xs font-semibold uppercase tracking-[0.2em] text-white mb-5';

  return (
    <footer className="bg-ink text-gray-400">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Top: four evenly-weighted columns ── */}
        <div className="py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* BRAND */}
          <div className="sm:col-span-2 lg:col-span-1 rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex flex-col">
            <div className="flex items-center gap-2.5 mb-4">
              <Image
                src={branding.logoDark}
                alt={branding.name}
                width={32}
                height={32}
                className="h-8 w-8 object-contain brightness-0 invert"
                unoptimized
              />
              <span className="text-lg font-bold text-white">{branding.name}</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">{branding.tagline}</p>
            {address && <p className="text-sm leading-relaxed text-gray-500 mb-5 max-w-xs">{address}</p>}
            {socials.length > 0 && (
              <div className="flex gap-2.5 mt-auto pt-4">
                {socials.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-gray-300 hover:bg-white hover:text-ink transition-colors"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d={SOCIAL_PATHS[s.name]} />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* QUICK LINKS */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className={headingClass}>Quick Links</h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={`${link.name}-${link.href}`}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronRightIcon className="h-3 w-3 flex-shrink-0 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    <span className="truncate">{link.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SUPPORT */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className={headingClass}>Support</h3>
            <div className="space-y-3">
              {phone && (
                <a
                  href={`tel:${phoneTel}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:bg-white/[0.08] transition-colors"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <PhoneIcon className="h-4 w-4 text-gray-300" />
                  </span>
                  <span className="min-w-0">
                    {hours && <span className="block text-[11px] text-gray-500">{hours}</span>}
                    <span className="block text-sm font-bold text-white truncate">{phone}</span>
                  </span>
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:bg-white/[0.08] transition-colors"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <EnvelopeIcon className="h-4 w-4 text-gray-300" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] text-gray-500">Email Us</span>
                    <span className="block text-sm font-bold text-white break-all leading-snug">{email}</span>
                  </span>
                </a>
              )}
              <Link
                href="/locations"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 hover:bg-white/[0.08] transition-colors"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <MapPinIcon className="h-4 w-4 text-gray-300" />
                </span>
                <span>
                  <span className="block text-[11px] text-gray-500">Store Locator</span>
                  <span className="block text-sm font-bold text-white">Find Our Stores</span>
                </span>
              </Link>
            </div>
          </div>

          {/* GET THE APP */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className={headingClass}>Get The App</h3>
            <p className="text-sm text-gray-400 mb-4">Experience {branding.name} on your mobile.</p>
            <div className="flex flex-col gap-3">
              <StoreBadge
                href={playStoreUrl}
                topText="Download on"
                mainText="Google Play"
                icon={
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zM14.5 12.708l2.302 2.302-10.937 6.333 8.635-8.635zM18.5 9.5l2.41 1.394a1 1 0 010 1.732L18.5 14.02l-2.5-2.51 2.5-2.51zM5.865 2.179l10.937 6.333L14.5 10.814 5.865 2.18z" /></svg>
                }
              />
              <StoreBadge
                href={appStoreUrl}
                topText="Download on"
                mainText="App Store"
                icon={
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                }
              />
            </div>
          </div>
        </div>

        {/* ── Copyright ── */}
        <div className="flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{copyright}</span>
          <span>Powered By: {poweredBy}</span>
        </div>
      </div>
    </footer>
  );
}

function StoreBadge({
  href,
  topText,
  mainText,
  icon,
}: {
  href: string;
  topText: string;
  mainText: string;
  icon: React.ReactNode;
}) {
  const className =
    'flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-white hover:bg-white/[0.08] transition-colors';
  const inner = (
    <>
      <span className="text-gray-200">{icon}</span>
      <span className="leading-tight">
        <span className="block text-[9px] uppercase tracking-wide text-gray-400">{topText}</span>
        <span className="block text-sm font-semibold">{mainText}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return <span className={`${className} cursor-default opacity-80`}>{inner}</span>;
}
