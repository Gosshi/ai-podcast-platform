import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/episodes/:id",
        destination: "/decisions/:id",
        permanent: true,
      },
      {
        source: "/watchlist",
        destination: "/saved",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
