import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep type errors blocking production builds.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
