/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["fast-xml-parser"],
  },
};

export default nextConfig;
