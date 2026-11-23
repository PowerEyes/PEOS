import "./globals.css";
import { ToastProvider } from "@poweros/ui";
export const metadata = { title: "PowerOS · Power Eyes Opticals" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head><link rel="preconnect" href="https://api.fontshare.com" /><link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet" /></head><body className="font-sans"><ToastProvider>{children}</ToastProvider></body></html>;
}
