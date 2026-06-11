/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: async () => `build-${Date.now()}`,
};

export default nextConfig;
