import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import AuthProvider from "@/components/AuthProvider";
import { Toaster } from 'react-hot-toast';
import ConditionalLayout from "@/components/ConditionalLayout";
import DynamicHead from "@/components/DynamicHead";
import StaleDeployRecovery from "@/components/StaleDeployRecovery";
import {
  getSiteSettings,
  resolveLogo,
  resolveFavicon,
  pickString,
  SITE_URL,
} from "@/lib/seo";

const SupportButton = dynamic(() => import("@/components/SupportButton"), {
  loading: () => null,
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const DEFAULT_DESCRIPTION =
  "Gadget And Revive connects customers with verified vendors for gadget repair services and genuine spare parts.";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();

  const siteName = pickString(s.site_name, "Gadget And Revive");
  const tagline = pickString(s.site_tagline, "Repair. Shop. Revive.");
  const title = pickString(s.meta_title) || `${siteName} — ${tagline}`;
  const description = pickString(s.meta_description, s.site_description, DEFAULT_DESCRIPTION);
  const keywords = pickString(s.meta_keywords);
  const logo = resolveLogo(s.site_logo);
  const favicon = resolveFavicon(s.site_favicon);

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${siteName}` },
    description,
    applicationName: siteName,
    ...(keywords ? { keywords } : {}),
    // When a real favicon is configured we use it; otherwise the app/icon.png
    // file convention provides the default (server-rendered) favicon.
    ...(favicon ? { icons: { icon: favicon, apple: favicon } } : {}),
    alternates: { canonical: SITE_URL },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: SITE_URL,
      locale: "en_US",
      images: [{ url: logo, alt: `${siteName} logo` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [logo],
    },
    robots: { index: true, follow: true },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: siteName,
    },
    formatDetection: {
      telephone: true,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const s = await getSiteSettings();
  const siteName = pickString(s.site_name, "Gadget And Revive");
  const description = pickString(s.meta_description, s.site_description, DEFAULT_DESCRIPTION);
  const logo = resolveLogo(s.site_logo);

  const sameAs = [
    s.facebook_url,
    s.instagram_url,
    s.youtube_url,
    s.twitter_url,
    s.linkedin_url,
  ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);

  const phone = pickString(s.contact_phone, s.topbar_phone);
  const email = pickString(s.contact_email, s.topbar_email, s.footer_email);

  // Organization markup is what Google reads for the brand logo shown next to
  // search results and in the knowledge panel.
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: SITE_URL,
    logo,
    image: logo,
    description,
    ...(sameAs.length ? { sameAs } : {}),
    ...(phone || email
      ? {
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer service",
              ...(phone ? { telephone: phone } : {}),
              ...(email ? { email } : {}),
            },
          ],
        }
      : {}),
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <StaleDeployRecovery />
        <AuthProvider>
          <DynamicHead />
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
          <SupportButton />
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
