/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone' — enable in Phase 11 for Docker production builds
  transpilePackages: ['@saas/shared'],
};

export default nextConfig;
