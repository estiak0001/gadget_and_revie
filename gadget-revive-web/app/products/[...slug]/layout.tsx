import type { Metadata } from 'next';
import { getStorageUrl } from '@/lib/api/config';
import { getSiteSettings, pickString, SITE_URL } from '@/lib/seo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fetch a product by slug on the server so social/crawler previews get the
 * right title, image and description. Returns null for non-product slugs
 * (e.g. category pages), which the category lookup below then tries instead.
 */
async function fetchProduct(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}`, {
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

/**
 * Fetch a product category by slug — same "last URL segment" lookup the client-side
 * resolver in page.tsx uses (see productService.getCategoryBySlug), mirrored here so a
 * category URL gets its own title/description instead of silently falling back to the
 * sitewide default the way every category page did before.
 */
async function fetchCategory(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/categories/products/${encodeURIComponent(slug)}`, {
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

  const product = await fetchProduct(lastSlug);
  if (product) {
    const name = String(product.name);
    const rawDesc = (product.short_description as string) || (product.description as string) || '';
    const description = stripHtml(rawDesc).slice(0, 200) || `Buy ${name} at the best price from Gadget And Revive.`;
    const url = `${SITE_URL}/products/${segments.join('/')}`;
    const image = product.image ? getStorageUrl(product.image as string) : undefined;

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

  const category = await fetchCategory(lastSlug);
  if (category) {
    const name = String(category.name);
    const rawDesc = (category.description as string) || '';
    const description = stripHtml(rawDesc).slice(0, 200)
      || `Shop ${name} at Gadget And Revive — genuine parts and accessories, competitively priced.`;
    const url = `${SITE_URL}/products/${segments.join('/')}`;
    const image = category.image ? getStorageUrl(category.image as string) : undefined;
    const title = `${name} — Shop ${name} Online`;

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

/**
 * Product + Offer JSON-LD — what actually earns price/availability rich snippets in search
 * results. `itemCondition` defaults to NewCondition: there's no condition/grade field on the
 * product model today, and none of the current catalog's names/specs indicate otherwise, so
 * that's the accurate default rather than a guess. If a `specifications.condition` value is
 * ever added it's honored first, so this stays correct without another code change.
 */
function buildProductSchema(
  product: Record<string, unknown>,
  url: string,
  currency: string,
): Record<string, unknown> {
  const name = String(product.name);
  const rawDesc = (product.short_description as string) || (product.description as string) || '';
  const description = stripHtml(rawDesc).slice(0, 500) || undefined;
  const sku = product.sku ? String(product.sku) : undefined;
  const brandName = (product.brand_name as string)
    || (product.brand_details as { name?: string } | undefined)?.name
    || (typeof product.brand === 'string' ? product.brand : undefined);
  const categoryName = (product.category as { name?: string } | undefined)?.name;

  const images = [
    product.image as string | undefined,
    ...(Array.isArray(product.gallery) ? (product.gallery as string[]) : []),
  ]
    .filter((img): img is string => !!img)
    .map((img) => getStorageUrl(img));

  const price = Number(product.current_price ?? product.discount_price ?? product.price ?? 0);
  const inStock = product.always_in_stock === true || product.is_in_stock !== false;

  const specs = product.specifications as Record<string, unknown> | undefined;
  const specCondition = specs
    ? String(specs.condition ?? specs.Condition ?? '').toLowerCase()
    : '';
  const itemCondition = specCondition.includes('used')
    ? 'https://schema.org/UsedCondition'
    : specCondition.includes('refurb')
      ? 'https://schema.org/RefurbishedCondition'
      : 'https://schema.org/NewCondition';

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(description ? { description } : {}),
    ...(sku ? { sku } : {}),
    ...(images.length ? { image: images } : {}),
    ...(brandName ? { brand: { '@type': 'Brand', name: brandName } } : {}),
    ...(categoryName ? { category: categoryName } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: currency,
      price: price.toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition,
    },
  };
}

type CategoryCrumb = { name: string; slug: string };

/**
 * Full category chain root→leaf as {name,url} pairs. Same fallback the client-side page
 * resolver already uses (see buildCategoryPath / the breadcrumbItems logic in page.tsx):
 * prefer the breadcrumb array the API computes, else this category is itself root-level.
 */
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

/** Matching Google's BreadcrumbList format — this is what lets search results show the
 *  category trail instead of the raw URL. Built from the exact same data (and the same
 *  fallback) as the visual <Breadcrumb> component on the page, just rendered as JSON-LD. */
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

export default async function ProductSlugLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const segments = Array.isArray(slug) ? slug : [slug];
  const lastSlug = segments[segments.length - 1];
  const url = `${SITE_URL}/products/${segments.join('/')}`;
  const home = { name: 'Home', url: `${SITE_URL}/` };

  // Deduped by Next's fetch cache against the identical call generateMetadata already makes
  // for this same request — this doesn't cost a second network round-trip.
  const product = await fetchProduct(lastSlug);

  if (product) {
    const s = await getSiteSettings();
    const currency = pickString(s.currency, 'BDT');
    const productSchema = buildProductSchema(product, url, currency);
    const category = product.category as { name: string; slug: string; breadcrumb?: CategoryCrumb[] } | undefined;
    const breadcrumbSchema = buildBreadcrumbSchema([
      home,
      ...(category ? categoryTrail(category, '/products') : []),
      { name: String(product.name), url },
    ]);

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        {children}
      </>
    );
  }

  const category = await fetchCategory(lastSlug);
  if (category) {
    const breadcrumbSchema = buildBreadcrumbSchema([
      home,
      ...categoryTrail(category as { name: string; slug: string; breadcrumb?: CategoryCrumb[] }, '/products'),
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
