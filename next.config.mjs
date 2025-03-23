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
    
    // Reduce parallel operations to avoid "too many open files" error
    if (config.optimization && config.optimization.minimizer) {
      for (const minimizer of config.optimization.minimizer) {
        if (minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options.parallel = 2; // Reduce parallel processes
        }
      }
    }
    
    return config;
  },
  // Reduce the number of concurrent pages being built
  experimental: {
    workerThreads: false,
    cpus: 2
  }
};

export default nextConfig;
