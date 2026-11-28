// Origins allowed to frame this site. Only the ERP does, for its live-preview
// panel. Comma separated so dev and production can be listed together.
const erpOrigins = (process.env.ERP_ORIGIN || "http://localhost:3001")
  .split(",").map((s) => s.trim()).filter(Boolean).join(" ");

export default {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  poweredByHeader: false,
  transpilePackages: ["@poweros/ui", "@poweros/business-rules", "@poweros/settings"],
  images: { remotePatterns: [{ protocol:"https", hostname:"*.supabase.co" }] },
  async headers() {
    return [{ source:"/(.*)", headers:[
      { key:"X-Content-Type-Options", value:"nosniff" },
      // The ERP's live-preview panel embeds the site in an iframe, so the old
      // blanket X-Frame-Options: DENY has to become an allowlist.
      // `frame-ancestors` supersedes XFO wherever it is understood — carrying
      // both would still block the ERP, because DENY wins in browsers that
      // ignore frame-ancestors. ERP_ORIGIN may be comma separated so the dev
      // and production ERP origins can be allowed together.
      { key:"Content-Security-Policy", value:`frame-ancestors 'self' ${erpOrigins}` },
      { key:"Strict-Transport-Security", value:"max-age=63072000; includeSubDomains" },
      { key:"Referrer-Policy", value:"strict-origin-when-cross-origin" },
      { key:"Permissions-Policy", value:"camera=(self), microphone=(), geolocation=(), payment=(self)" },
    ] },
      // Signed-in pages and money APIs must never be cached by browsers/CDNs/shared proxies.
      { source:"/:p(my|checkout|login|forgot-password|reset-password|auth|api)/:rest*", headers:[{ key:"Cache-Control", value:"private, no-store, max-age=0" }, { key:"X-Robots-Tag", value:"noindex, nofollow" }] },
      { source:"/manifest.json", headers:[{ key:"Content-Type", value:"application/manifest+json" }] }];
  },
};
