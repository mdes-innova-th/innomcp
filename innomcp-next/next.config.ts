import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname, ".."),
  
  // Ensure proper asset loading
  assetPrefix: process.env.ASSET_PREFIX || undefined,
};

export default nextConfig;
