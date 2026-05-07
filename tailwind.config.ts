import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Using rgb() with <alpha-value> to enable Tailwind v3 opacity modifiers (e.g. bg-cream/92)
        cream: "rgb(244 239 228 / <alpha-value>)",
        paper: "rgb(251 248 241 / <alpha-value>)",
        ink: "rgb(26 20 16 / <alpha-value>)",
        inkMuted: "rgb(107 98 88 / <alpha-value>)",
        inkFaint: "rgb(169 160 149 / <alpha-value>)",
        rule: "rgb(225 217 199 / <alpha-value>)",
        ruleDark: "rgb(200 190 168 / <alpha-value>)",
        red: "rgb(200 68 42 / <alpha-value>)",
        redDeep: "rgb(154 51 31 / <alpha-value>)",
        mustard: "rgb(212 165 44 / <alpha-value>)",
        grass: "rgb(74 112 72 / <alpha-value>)",
      },
      fontFamily: {
        // Amerik Slant — WALKOFF wordmark + .brand inline spans only
        brand: ["var(--font-amerik)", "sans-serif"],
        // Arbeit Bold/Regular — all headlines and body copy
        display: ["var(--font-arbeit)", "system-ui", "sans-serif"],
        sans: ["var(--font-arbeit)", "system-ui", "sans-serif"],
        // Midruns Script — decorative script accents (hero h1, final CTA, case stats)
        script: ["var(--font-midruns-script)", "cursive"],
        // JetBrains Mono — eyebrows, labels, buttons, badges, code
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      screens: {
        layout: "880px",
      },
    },
  },
  plugins: [],
};

export default config;
