import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  // Website Studio lets operators type gradient classes into website_content /
  // website_sections. Those strings never appear in source, so Tailwind would
  // purge them; keep the palette it offers available in the shipped CSS.
  safelist: [
    { pattern: /^(from|via|to)-(slate|navy|gold|blue|amber|emerald|violet|rose|teal|white|black|transparent)(-(50|100|200|300|400|500|600|700|800|900))?$/ },
  ],
  theme: { extend: {
    colors: {
      navy: { 50:"#EEF3F8",100:"#D5E3F0",700:"#123659",800:"#0E2B4A",900:"#0A2240" },
      gold: { 400:"#D9A25E",500:"#C48A3F",600:"#A8722F" },
      canvas: "#F9FAFB"
    },
    fontFamily: { sans: ["var(--font-general-sans)","system-ui","sans-serif"], display: ["var(--font-general-sans)","system-ui","sans-serif"] },
    animation: { "fade-in": "fadeIn .4s ease-out", "slide-up": "slideUp .4s ease-out" },
    keyframes: { fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } }, slideUp: { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } } }
  }},
  plugins: [],
} satisfies Config;
