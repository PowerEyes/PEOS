// Origins allowed to frame this site. Only the ERP does, for its live-preview
// panel. Comma separated so dev and production can be listed together.
const erpOrigins = (process.env.ERP_ORIGIN || "http://localhost:3001")
  .split(",").map((s) => s.trim()).filter(Boolean).join(" ");

export default {
  transpilePackages: ["@poweros/ui", "@poweros/business-rules"],
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
      { key:"Referrer-Policy", value:"strict-origin-when-cross-origin" },
    ] },
      { source:"/manifest.json", headers:[{ key:"Content-Type", value:"application/manifest+json" }] }];
  },
};
