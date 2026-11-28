/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Keep the Supabase SDK out of webpack's vendor-chunk graph. Next 14's
    // production runtime on Windows can otherwise reference a vendor chunk
    // that is not emitted for this app, breaking `next start` at request time.
    serverComponentsExternalPackages: ["@supabase/supabase-js"],
  },
};

module.exports = nextConfig;