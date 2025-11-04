import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  // hide powered by Next.js header
  poweredByHeader: false,
  
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "dataxo.info",
      },
    ],
    localPatterns: [
      {
        pathname: "/api/proxy-image",
      },
      {
        pathname: "/api/proxy-image",
      },
    ],
  },

  // Security headers are now handled by middleware.ts
  // This avoids duplication and allows for dynamic nonce support

  // Configure rewrites to proxy API requests to the Node.js backend
  async rewrites() {
    const backendUrl = process.env.NODE_BACKEND_HOST || "http://localhost:3010";
    return [
      {
        source: "/api/url-stats/:path*",
        destination: `${backendUrl}/api/url-stats/:path*`,
      },
    ];
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      issuer: { and: [/[jt]sx?$/] },
      use: [
        {
          loader: require.resolve('@svgr/webpack'),
          options: {
            prettier: false,
            svgo: true,
            svgoConfig: {
              plugins: [{ removeViewBox: false }],
            },
            titleProp: true,
          },
        },
      ],
    });
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      html2canvas: path.resolve(__dirname, "node_modules/html2canvas-pro"),
    };
    return config;
  },
};

export default nextConfig;
