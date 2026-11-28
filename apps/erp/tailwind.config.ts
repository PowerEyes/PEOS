import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  // Website Controller builds the product-toggle colour as `bg-${c}-500`.
  // Tailwind cannot see those runtime strings, so keep them in the CSS.
  safelist: ["bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-gold-500"],
  theme: { extend: {
    colors: {
      navy: { 50: "#EEF3F8", 700: "#123659", 800: "#0E2B4A", 900: "#0A2240" },
      gold: { 400: "#D9A25E", 500: "#C48A3F", 600: "#A8722F" },
      canvas: "#F6F8FB" },
    fontFamily: { sans: ["var(--font-general-sans)", "system-ui", "sans-serif"], display: ["var(--font-general-sans)", "system-ui", "sans-serif"] } } },
  plugins: [],
} satisfies Config;
