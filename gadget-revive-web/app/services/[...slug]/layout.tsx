import type { Metadata } from 'next';
import { getStorageUrl } from '@/lib/api/config';
import { getSiteSettings, pickString, SITE_URL } from '@/lib/seo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fetch a service by slug on the server — same "last URL segment" lookup the client-side
 * resolver in page.tsx uses (serviceService.getById accepts an id or a slug). Returns null for
 * non-service slugs (category pages), which the category lookup below then tries instead.
 */
async function fetchService(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/services/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    return data && typeof data === 'object' && data.name ? data : null;
  } catch {
    return null;
  }
}

/** Same lookup serviceService.getCategoryBySlug uses client-side. */
async function fetchServiceCategory(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/categories/services/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    return data && typeof data === 'object' && data.name ? data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string[] }> },
): Promise<Metadata> {
  const { slug } = await params;
  const segments = Array.isArray(slug) ? slug : [slug];
  const lastSlug = segments[segments.length - 1];

  const service = await fetchService(lastSlug);
  if (service) {
    const name = String(service.name);
    const rawDesc = (service.short_description as string) || (service.description as string) || '';
    const description = stripHtml(rawDesc).slice(0, 200) || `Book ${name} at Gadget And Revive — certified technicians, upfront pricing.`;
    const url = `${SITE_URL}/services/${segments.join('/')}`;
    const image = service.image ? getStorageUrl(service.image as string) : undefined;

    return {
      title: name,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        title: name,
        description,
        url,
        ...(image ? { images: [{ url: image, alt: name }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title: name,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  }

  const category = await fetchServiceCategory(lastSlug);
  if (category) {
    const name = String(category.name);
    const rawDesc = (category.description as string) || '';
    const description = stripHtml(rawDesc).slice(0, 200)
      || `Book ${name} services at Gadget And Revive — certified technicians, upfront pricing.`;
    const url = `${SITE_URL}/services/${segments.join('/')}`;
    const image = category.image ? getStorageUrl(category.image as string) : undefined;
    const title = `${name} Services`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        title,
        description,
        url,
        ...(image ? { images: [{ url: image, alt: name }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  }

  return {};
}

/** Service JSON-LD for the detail branch. No availability/itemCondition — those are Product
 *  concepts, not meaningful for a repair/booking service. */
function buildServiceSchema(
  service: Record<string, unknown>,
  url: string,
  currency: string,
): Record<string, unknown> {
  const name = String(service.name);
  const rawDesc = (service.short_description as string) || (service.description as string) || '';
  const description = stripHtml(rawDesc).slice(0, 500) || undefined;
  const categoryName = (service.category as { name?: string } | undefined)?.name;

  const images = [
    service.image as string | undefined,
    ...(Array.isArray(service.gallery) ? (service.gallery as string[]) : []),
  ]
    .filter((img): img is string => !!img)
    .map((img) => getStorageUrl(img));

  const price = Number(service.current_price ?? service.discount_price ?? service.base_price ?? 0);

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(categoryName ? { serviceType: categoryName } : {}),
    provider: { '@id': `${SITE_URL}/#organization` },
    areaServed: { '@type': 'City', name: 'Dhaka' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: currency,
      price: price.toFixed(2),
    },
  };
}

type CategoryCrumb = { name: string; slug: string };

/** Same fallback the client-side breadcrumbItems arrays use: prefer the API's breadcrumb
 *  array, else this category is itself root-level. */
function categoryTrail(
  category: { name: string; slug: string; breadcrumb?: CategoryCrumb[] },
  basePath: string,
): { name: string; url: string }[] {
  const crumbs = category.breadcrumb?.length ? category.breadcrumb : [{ name: category.name, slug: category.slug }];
  return crumbs.map((c, i) => ({
    name: c.name,
    url: `${SITE_URL}${basePath}/${crumbs.slice(0, i + 1).map((x) => x.slug).join('/')}`,
  }));
}

function buildBreadcrumbSchema(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export default async function ServiceSlugLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const segments = Array.isArray(slug) ? slug : [slug];
  const lastSlug = segments[segments.length - 1];
  const url = `${SITE_URL}/services/${segments.join('/')}`;
  // Matches the visual breadcrumb exactly: Home (icon) → Services → category chain → ...
  const home = { name: 'Home', url: `${SITE_URL}/` };
  const servicesRoot = { name: 'Services', url: `${SITE_URL}/services` };

  // Deduped by Next's fetch cache against the identical call generateMetadata already makes
  // for this same request — this doesn't cost a second network round-trip.
  const service = await fetchService(lastSlug);

  if (service) {
    const s = await getSiteSettings();
    const currency = pickString(s.currency, 'BDT');
    const serviceSchema = buildServiceSchema(service, url, currency);
    const category = service.category as { name: string; slug: string; breadcrumb?: CategoryCrumb[] } | undefined;
    const breadcrumbSchema = buildBreadcrumbSchema([
      home,
      servicesRoot,
      ...(category ? categoryTrail(category, '/services') : []),
      { name: String(service.name), url },
    ]);

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        {children}
      </>
    );
  }

  const category = await fetchServiceCategory(lastSlug);
  if (category) {
    const breadcrumbSchema = buildBreadcrumbSchema([
      home,
      servicesRoot,
      ...categoryTrail(category as { name: string; slug: string; breadcrumb?: CategoryCrumb[] }, '/services'),
    ]);

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        {children}
      </>
    );
  }

  return <>{children}</>;
}
