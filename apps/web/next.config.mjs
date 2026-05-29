/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' && process.platform !== 'win32' ? 'standalone' : undefined,
  transpilePackages: ['@saas/shared'],
};

export default nextConfig;
