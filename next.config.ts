import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The project can live inside a synced folder whose parent has an
  // unrelated lockfile; pin Turbopack to this project.
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s4.anilist.co",
        pathname: "/file/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
