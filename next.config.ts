import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.patreonusercontent.com" },
      { protocol: "https", hostname: "**.patreon.com" },
    ],
  },
};

export default nextConfig;
