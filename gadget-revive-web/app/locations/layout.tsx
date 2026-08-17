import type { Metadata } from 'next';
import { getSiteSettings, pickString, SITE_URL } from '@/lib/seo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

type BranchLocation = {
  id: number;
  name: string;
  type?: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
  map_embed_url?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_featured?: boolean;
};

/** Same public endpoint the client page's branchLocationService.getAll() calls. */
async function fetchLocations(): Promise<BranchLocation[]> {
  try {
    const res = await fetch(`${API_BASE}/branch-locations`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteName = pickString(s.site_name, 'Gadget And Revive');
  const locations = await fetchLocations();
  const main = locations.find((l) => l.is_featured) ?? locations[0];
  const title = 'Our Locations';
  const description = main?.address
    ? `Visit ${siteName} at ${main.address}. Certified gadget repair and genuine parts, in person.`
    : `${siteName} service center locations — certified gadget repair and genuine parts, in person.`;
  const url = `${SITE_URL}/locations`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

/**
 * The Google Maps embed URL already encodes the pin's coordinates as `!2d{lng}!3d{lat}` —
 * a standard, stable param of that embed format. Used as a fallback when latitude/longitude
 * aren't set directly on the location record, since the business has effectively already
 * supplied real coordinates via the map they picked; not a guess.
 */
function extractGeoFromEmbed(embedUrl: string | undefined): { latitude: number; longitude: number } | null {
  if (!embedUrl) return null;
  const match = embedUrl.match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/);
  if (!match) return null;
  return { longitude: Number(match[1]), latitude: Number(match[2]) };
}

/**
 * LocalBusiness JSON-LD per active location — what feeds Google Maps / the local pack for
 * "gadget repair near me" style searches. Cross-references the sitewide Organization node by
 * @id (set in the root layout) instead of repeating the whole Organization object here.
 */
function buildLocalBusinessSchema(location: BranchLocation, siteName: string): Record<string, unknown> {
  // Coerced with Number() defensively — Laravel decimal columns are often serialized as
  // strings, and schema.org's GeoCoordinates wants actual numbers.
  const geo = (location.latitude != null && location.longitude != null)
    ? { latitude: Number(location.latitude), longitude: Number(location.longitude) }
    : extractGeoFromEmbed(location.map_embed_url);

  return {
    '@context': 'https://schema.org',
    '@type': 'ElectronicsStore',
    name: location.name || siteName,
    url: `${SITE_URL}/locations`,
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
    ...(location.address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: location.address,
            addressLocality: 'Dhaka',
            addressCountry: 'BD',
          },
        }
      : {}),
    ...(location.phone ? { telephone: location.phone } : {}),
    ...(location.email ? { email: location.email } : {}),
    ...(geo ? { geo: { '@type': 'GeoCoordinates', ...geo } } : {}),
  };
}

export default async function LocationsLayout({ children }: { children: React.ReactNode }) {
  const [s, locations] = await Promise.all([getSiteSettings(), fetchLocations()]);
  const siteName = pickString(s.site_name, 'Gadget And Revive');

  return (
    <>
      {locations.map((location) => (
        <script
          key={location.id}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLocalBusinessSchema(location, siteName)) }}
        />
      ))}
      {children}
    </>
  );
}
