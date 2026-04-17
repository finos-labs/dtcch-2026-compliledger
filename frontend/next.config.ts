import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://settlementguard-alb-1419322607.us-east-2.elb.amazonaws.com";

const nextConfig: NextConfig = {
  // Disable source maps in production to protect code
  productionBrowserSourceMaps: false,
  // Remove console.log in production
  compiler: {},
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${BACKEND_URL}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
