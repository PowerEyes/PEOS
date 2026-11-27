export default {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  transpilePackages: ["@poweros/ui", "@poweros/business-rules", "@poweros/settings"],
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium"] },
  async headers() {
    return [{ source: "/(d|print)/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ] }];
  },
};
