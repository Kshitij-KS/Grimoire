import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // Suppress pack-file cache warnings about large string serialization
    config.infrastructureLogging = { level: "error" };
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in CI/production builds when auth token is available
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better error stack traces
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress source map upload logs in development
  silent: !process.env.CI,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },

  // Hides source maps from generated client bundles
  hideSourceMaps: true,
});
