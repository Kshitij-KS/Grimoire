/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // Suppress pack-file cache warnings about large string serialization
    config.infrastructureLogging = { level: "error" };
    return config;
  },
};

export default nextConfig;
