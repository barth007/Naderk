import type { Metadata } from "next";
import { Geist, Poppins } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ConditionalWrapper } from "@/components/layout/ConditionalWrapper";
import { Toaster } from "sonner";
import { getSiteSettings, brandFromSettings } from "@/lib/site-brand";
import "./globals.css";


const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const siteUrl = rawSiteUrl.startsWith("http")
  ? rawSiteUrl
  : `https://${rawSiteUrl}`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = brandFromSettings(await getSiteSettings());
  const siteName = brand.name;
  const defaultTitle = `${brand.name} | Advanced Vision Care`;
  const siteDescription = `${brand.name} provides ${brand.description}`;
  const ogImage = brand.logoUrl ?? "/naderk_logo.png";
  const iconUrl = brand.faviconUrl ?? brand.logoUrl ?? "/icon.png";

  return {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${brand.name}`,
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    brand.name,
    "eye clinic",
    "vision care",
    "telehealth eye consultation",
    "optical store",
    "eye diagnostics",
    "laboratory services",
    "ophthalmology",
    "Africa healthcare",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: siteDescription,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: brand.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: siteDescription,
    images: [ogImage],
  },
  // Resolved server-side so React owns these <link> tags for the whole request.
  // They used to be hardcoded to /icon.png and then torn out of <head> by a
  // client effect, which left React's hoistable bookkeeping pointing at
  // detached nodes — the "parentNode.removeChild of null" crash on navigation.
  icons: {
    icon: iconUrl,
    shortcut: iconUrl,
    apple: iconUrl,
  },
    category: "healthcare",
  };
}

import QueryProvider from "@/components/providers/QueryProvider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Same fetch generateMetadata used; Next dedupes it within the render pass.
  // Seeding the client cache with it keeps the server render and the client's
  // first render identical, so BrandLogo no longer triggers a hydration
  // mismatch that discards the whole tree.
  const siteSettings = await getSiteSettings();

  return (
    <html lang="en" className={`${geistSans.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <QueryProvider initialSiteSettings={siteSettings}>
          <ConditionalWrapper>
            <Navbar />
          </ConditionalWrapper>
          <main className="flex-1">{children}</main>
          <ConditionalWrapper>
            <Footer />
          </ConditionalWrapper>
          <Toaster richColors position="top-center" />
        </QueryProvider>
      </body>
    </html>
  );
}
