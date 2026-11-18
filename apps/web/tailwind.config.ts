import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      navy: { 50:"#EEF3F8",100:"#D5E3F0",700:"#123659",800:"#0E2B4A",900:"#0A2240" },
      gold: { 400:"#D9A25E",500:"#C48A3F",600:"#A8722F" },
      canvas: "#F9FAFB"
    },
    fontFamily: { sans: ["var(--font-inter)","system-ui","sans-serif"], display: ["var(--font-playfair)","Georgia","serif"] },
    animation: { "fade-in": "fadeIn .4s ease-out", "slide-up": "slideUp .4s ease-out" },
    keyframes: { fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } }, slideUp: { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } } }
  }},
  plugins: [],
} satisfies Config;
