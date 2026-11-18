import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      navy: { 50: "#EEF3F8", 700: "#123659", 800: "#0E2B4A", 900: "#0A2240" },
      gold: { 400: "#D9A25E", 500: "#C48A3F", 600: "#A8722F" },
      canvas: "#F6F8FB" },
    fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"], display: ["var(--font-display)", "Georgia", "serif"] } } },
  plugins: [],
} satisfies Config;
