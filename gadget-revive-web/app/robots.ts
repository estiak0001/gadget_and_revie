import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * Storefront crawl policy. Everything a shopper can browse without logging in stays open;
 * account, checkout and auth flows are blocked since they carry no unique indexable content
 * and would otherwise waste crawl budget (or, worse, expose a logged-out shell to Google).
 *
 * /orders/track is a generic "enter your order number" tool with no account required, so it's
 * carved back out of the broader /orders/ block.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/orders/track'],
      disallow: [
        '/checkout',
        '/dashboard',
        '/orders/',
        '/support/',
        '/auth/',
        '/forgot-password',
        '/vendor',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
