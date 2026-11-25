import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      navy: { 50: "#EEF3F8", 700: "#123659", 800: "#0E2B4A", 900: "#0A2240" },
      gold: { 400: "#D9A25E", 500: "#C48A3F", 600: "#A8722F" },
      canvas: "#F5F7FB" },
    boxShadow: { card: "0 1px 3px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.025)" },
    fontFamily: { sans: ["var(--font-general-sans)", "system-ui", "sans-serif"], display: ["var(--font-general-sans)", "system-ui", "sans-serif"] } } },
  plugins: [],
} satisfies Config;
