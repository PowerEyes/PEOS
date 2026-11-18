import "./globals.css";
import { ToastProvider } from "@poweros/ui";
import { Inter, Fraunces } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
export const metadata = { title: "PowerOS · Power Eyes Opticals" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${inter.variable} ${display.variable} font-sans`}><ToastProvider>{children}</ToastProvider></body></html>;
}
