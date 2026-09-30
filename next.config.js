/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is for the Linux container; Windows need not create symlinks.
  output: process.platform === 'win32' ? undefined : 'standalone',
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    return config
  },
}

module.exports = nextConfig

