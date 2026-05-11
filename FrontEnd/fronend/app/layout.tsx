import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const siteName = "Naderk Eye Clinic";
const defaultTitle = "Naderk Eye Clinic | Advanced Vision Care";
const siteDescription =
  "Naderk Eye Clinic provides comprehensive eye care, telehealth consultations, laboratory diagnostics, and optical services with modern technology and expert support.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://naderk.vercel.app";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | Naderk Eye Clinic",
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "Naderk Eye Clinic",
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
        url: "/naderk_logo.png",
        width: 1200,
        height: 630,
        alt: "Naderk Eye Clinic",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: siteDescription,
    images: ["/naderk_logo.png"],
  },
  icons: {
    icon: "/naderk_logo.png",
    shortcut: "/naderk_logo.png",
    apple: "/naderk_logo.png",
  },
  category: "healthcare",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
