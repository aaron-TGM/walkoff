import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint the moment engine along with the site.
  eslint: { dirs: ["app", "components", "lib", "engine"] },
};

export default nextConfig;
