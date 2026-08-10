import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@atlas/domain",
    "@atlas/api-contracts",
    "@atlas/db",
    "@atlas/knowledge",
    "@atlas/ai",
    "@atlas/auth",
    "@atlas/observability",
  ],
  poweredByHeader: false,
  compress: true,
  staticPageGenerationTimeout: 180,
  experimental: {
    optimizePackageImports: ["@react-three/drei", "motion", "three"],
  },
  webpack(config, { isServer }) {
    // Resolve Three.js through its source entry so Webpack can split the engine
    // by module instead of emitting one monolithic client chunk.
    config.resolve.alias = {
      ...config.resolve.alias,
      "three$": path.join(process.cwd(), "node_modules/three/src/Three.js"),
    };

    if (!isServer && config.optimization.splitChunks && typeof config.optimization.splitChunks !== "boolean") {
      // Keep the interactive globe lazy-loadable while enforcing the repository's
      // 500 KB uncompressed per-chunk budget.
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        threeRenderers: {
          test: /[\\/]node_modules[\\/]three[\\/]src[\\/]renderers[\\/]/,
          name: "three-renderers",
          chunks: "all",
          priority: 50,
          enforce: true,
        },
        threeEngine: {
          test: /[\\/]node_modules[\\/]three[\\/]src[\\/](?:core|math)[\\/]/,
          name: "three-engine",
          chunks: "all",
          priority: 50,
          enforce: true,
        },
        threeScene: {
          test: /[\\/]node_modules[\\/]three[\\/]src[\\/](?:animation|cameras|geometries|helpers|lights|materials|objects|scenes|textures)[\\/]/,
          name: "three-scene",
          chunks: "all",
          priority: 50,
          enforce: true,
        },
        threeAddons: {
          test: /[\\/]node_modules[\\/]three[\\/](?:examples|addons)[\\/]/,
          name: "three-addons",
          chunks: "all",
          priority: 50,
          enforce: true,
        },
        threeMisc: {
          test: /[\\/]node_modules[\\/]three[\\/]/,
          name: "three-misc",
          chunks: "all",
          priority: 40,
          enforce: true,
        },
        reactThree: {
          test: /[\\/]node_modules[\\/]@react-three[\\/]/,
          name: "react-three",
          chunks: "all",
          priority: 40,
          enforce: true,
        },
        postprocessing: {
          test: /[\\/]node_modules[\\/](?:postprocessing|@react-three[\\/]postprocessing)[\\/]/,
          name: "postprocessing",
          chunks: "all",
          priority: 45,
          enforce: true,
        },
      };
    }
    return config;
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/media/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: false,
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
