import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Regenerate at most once an hour — catalog changes don't need to reach crawlers any faster
// than that, and this keeps a crawler hit from ever triggering a synchronous full re-fetch.
export const revalidate = 3600;

async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type CategoryNode = {
  slug: string;
  path?: string;
  is_active?: boolean;
  children?: CategoryNode[];
};

/** Flattens a category tree (root → children → grandchildren) into every node's own
 *  /products (or /services) path — the API already computes the full breadcrumb `path` per
 *  node, so this is just a walk, not a rebuild of it. */
function flattenCategoryPaths(nodes: CategoryNode[] | null | undefined): string[] {
  if (!nodes) return [];
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.is_active === false) continue;
    paths.push(node.path || node.slug);
    if (node.children?.length) paths.push(...flattenCategoryPaths(node.children));
  }
  return paths;
}

/** Pages through a public list endpoint (max 50/page server-side) collecting every
 *  {slug, updated_at}. Capped at 40 pages (2,000 items) so a runaway catalog can never turn a
 *  sitemap request into an unbounded fetch loop. */
async function fetchAllSlugs(path: string): Promise<{ slug: string; updated_at?: string }[]> {
  const items: { slug: string; updated_at?: string }[] = [];
  const MAX_PAGES = 40;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const json = await fetchJson(`${API_BASE}${path}?per_page=50&page=${page}`);
    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const row of rows) {
      if (row?.slug) items.push({ slug: row.slug, updated_at: row.updated_at });
    }
    const lastPage = json?.meta?.last_page ?? 1;
    if (page >= lastPage || rows.length === 0) break;
  }

  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/services`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/locations`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/data-recovery`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/returns`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/orders/track`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const [products, services, productCategoriesRaw, serviceCategoriesRaw, pagesRaw] = await Promise.all([
    fetchAllSlugs('/products'),
    fetchAllSlugs('/services'),
    fetchJson(`${API_BASE}/categories/products/tree`),
    fetchJson(`${API_BASE}/categories/services/tree`),
    fetchJson(`${API_BASE}/public/pages`),
  ]);

  const productCategoryPaths = flattenCategoryPaths(productCategoriesRaw?.data);
  const serviceCategoryPaths = flattenCategoryPaths(serviceCategoriesRaw?.data);
  const pages: { slug: string; updated_at?: string }[] = Array.isArray(pagesRaw?.data) ? pagesRaw.data : [];

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const serviceEntries: MetadataRoute.Sitemap = services.map((s) => ({
    url: `${SITE_URL}/services/${s.slug}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const productCategoryEntries: MetadataRoute.Sitemap = productCategoryPaths.map((path) => ({
    url: `${SITE_URL}/products/${path}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const serviceCategoryEntries: MetadataRoute.Sitemap = serviceCategoryPaths.map((path) => ({
    url: `${SITE_URL}/services/${path}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const pageEntries: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${SITE_URL}/pages/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: 'monthly',
    priority: 0.4,
  }));

  return [
    ...staticEntries,
    ...productCategoryEntries,
    ...serviceCategoryEntries,
    ...productEntries,
    ...serviceEntries,
    ...pageEntries,
  ];
}
