'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PhoneIcon, ClockIcon, MapPinIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useSettingsStore } from '@/lib/stores/settings-store';

const UTILITY_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Guides', href: '/guides' },
  { label: 'Contact', href: '/contact' },
  { label: 'Track Order', href: '/orders/track' },
];

export default function TopBar() {
  const { data, fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const phone = (data.topbar_phone as string | undefined) ?? '';
  const email = (data.topbar_email as string | undefined) ?? '';
  const address = (data.topbar_address as string | undefined) ?? '';
  const hours = (data.topbar_hours as string | undefined) ?? '';
  const promoText = (data.topbar_promo_text as string | undefined) ?? '';

  const phoneHref = phone ? `tel:${phone.replace(/[\s\-()]/g, '')}` : '#';
  const emailHref = email ? `mailto:${email}` : '#';

  return (
    <div className="bg-ink text-gray-300 border-b border-white/10">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-9 items-center justify-between text-xs">
          {/* Left side - Contact Info */}
          <div className="hidden md:flex items-center divide-x divide-gray-700">
            {phone && (
              <a href={phoneHref} className="flex items-center space-x-1.5 pr-4 hover:text-white transition-colors">
                <PhoneIcon className="h-3.5 w-3.5" />
                <span>{phone}</span>
              </a>
            )}
            {email && (
              <a href={emailHref} className="flex items-center space-x-1.5 px-4 hover:text-white transition-colors">
                <EnvelopeIcon className="h-3.5 w-3.5" />
                <span>{email}</span>
              </a>
            )}
            {address && (
              <div className="flex items-center space-x-1.5 pl-4">
                <MapPinIcon className="h-3.5 w-3.5" />
                <span>{address}</span>
              </div>
            )}
          </div>

          {/* Mobile - Just phone */}
          {phone && (
            <a href={phoneHref} className="flex md:hidden items-center space-x-1.5 hover:text-white transition-colors">
              <PhoneIcon className="h-3.5 w-3.5" />
              <span>{phone}</span>
            </a>
          )}

          {/* Right side - Utility links, Hours & Promo */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-4">
              {UTILITY_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-white transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
            {hours && (
              <div className="hidden sm:flex items-center space-x-1.5 text-gray-400">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>{hours}</span>
              </div>
            )}
            {promoText && (
              <div className="bg-white text-ink px-2.5 py-0.5 rounded text-xs font-semibold">
                {promoText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
