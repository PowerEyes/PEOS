
import { getStoreName } from "@/lib/site";
import { getOrgId } from "@/lib/tenant";
import { supabasePublic } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { CompareBar } from "@/components/CompareBar";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@poweros/ui";
import { getSiteSettings } from "@/lib/site";
import { SiteProvider } from "@/lib/site-context";
import { ChromeProvider } from "@/components/chrome";
import { getSiteChrome } from "@/lib/chrome";

// Site settings and chrome are CMS-driven, so the root layout must render per
// request to pick up ERP edits. Individual marketing pages below opt into
// static generation with revalidation where appropriate.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getStoreName();
  return {
  title: { default: name, template: `%s — ${name}` },
  description: `Eyeglasses, sunglasses, contact lenses and eye tests at ${name}.`,
  openGraph:{ type:"website", locale:"en_IN", siteName: name, images:[{ url:"/og-image.jpg", width:1200, height:630, alt: name }] },
  icons:{
    icon:"/favicon.ico",
    apple:[{ url:"/icon-192.png" }],
  },
  manifest:"/manifest.json",
  themeColor:"#0B1B36",
  };
}

async function getExitOffer() {
  try {
    const now = new Date().toISOString();
    const { data } = await supabasePublic().from("coupons").select("code,type,value,min_order,valid_until").eq("org_id", await getOrgId()).eq("is_active", true).or(`valid_until.is.null,valid_until.gt.${now}`).order("value", { ascending: false }).limit(1);
    const c = data?.[0]; if (!c) return null;
    return { code: c.code as string, label: c.type === "percent" ? `${c.value}% OFF` : `₹${c.value} OFF`, sub: Number(c.min_order) > 0 ? `on orders above ₹${c.min_order}` : "on your order" };
  } catch { return null; }
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const exitOffer = await getExitOffer();
  const [site, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()]);
  const analyticsId = site.analyticsId.trim();
  const isGA = /^G-[A-Z0-9]+$/i.test(analyticsId);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-canvas antialiased font-sans">
        {analyticsId && (isGA ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`} strategy="afterInteractive" />
            <Script id="ga-config" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${analyticsId}');`}</Script>
          </>
        ) : (
          <Script src="https://plausible.io/js/script.js" data-domain={analyticsId} strategy="afterInteractive" />
        ))}
        <ChromeProvider value={chrome}>
          <SiteProvider value={site}>
            <CartProvider>
              <ToastProvider>
                {children}
                {/* Global floating UI — rendered on every page */}
                <CompareBar />
                <ExitIntentPopup offer={exitOffer} />
              </ToastProvider>
            </CartProvider>
          </SiteProvider>
        </ChromeProvider>
      </body>
    </html>
  );
}
