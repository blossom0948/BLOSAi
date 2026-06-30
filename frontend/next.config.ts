import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath: isGithubPages ? "/BLOSAi" : undefined,
  assetPrefix: isGithubPages ? "/BLOSAi/" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
