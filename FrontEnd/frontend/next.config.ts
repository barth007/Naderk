import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables self-contained production build for Docker deployment (node server.js)
  output: 'standalone',
  // LiveKit's WebRTC peer connection cannot survive React Strict Mode's
  // dev-only mount→cleanup→remount cycle. Strict Mode is a no-op in production.
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async redirects() {
    return [
      // Catch stale /auth/login references — the real login page is /login
      {
        source: "/auth/login",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/services/optical-store",
        destination: "/dashboard/marketplace",
        permanent: true,
      },
      {
        source: "/dashboard/store",
        destination: "/dashboard/marketplace",
        permanent: true,
      },
      {
        source: "/marketplace/optical-builder",
        destination: "/dashboard/marketplace/optical-builder",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
