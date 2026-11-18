
import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

const inter = Inter({ subsets:["latin"], variable:"--font-inter" });

// Announcement / logo / nav / footer are rendered in this layout, so the only
// way for an ERP edit to reach every route immediately is for every route to
// render per request. Selected explicitly for Phase 5; the site-settings /
// analytics read above is thereby fresh too, which is what a CMS wants.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default:"Power Eyes Opticals — Mogappair, Chennai", template:"%s — Power Eyes Opticals" },
  description:"Expert eye care and premium eyewear since 1998. Eyeglasses, sunglasses, contact lenses and free eye testing at Mogappair East and West, Chennai.",
  keywords:["eyeglasses","sunglasses","contact lenses","eye test","opticals","Mogappair","Chennai","Power Eyes"],
  openGraph:{
    type:"website", locale:"en_IN", siteName:"Power Eyes Opticals",
    images:[{ url:"/og-image.jpg", width:1200, height:630, alt:"Power Eyes Opticals" }],
  },
  icons:{
    icon:"/favicon.ico",
    apple:[{ url:"/icon-192.png" }],
  },
  manifest:"/manifest.json",
  themeColor:"#0B1B36",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [site, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()]);
  const analyticsId = site.analyticsId.trim();
  const isGA = /^G-[A-Z0-9]+$/i.test(analyticsId);
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-canvas antialiased`}>
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
                <ExitIntentPopup />
              </ToastProvider>
            </CartProvider>
          </SiteProvider>
        </ChromeProvider>
      </body>
    </html>
  );
}
