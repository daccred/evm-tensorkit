/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["assets.co.dev"],
  },
  webpack: (config, context) => {
    config.optimization.minimize = process.env.NEXT_PUBLIC_CO_DEV_ENV !== "preview";
    return config;
  },
  // Reduce the number of concurrent operations to avoid "too many open files" error
  experimental: {
    workerThreads: false,
    cpus: 1
  }
};

export default nextConfig;
