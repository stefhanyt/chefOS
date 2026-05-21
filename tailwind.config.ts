import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: [
          "var(--font-display)",
          "Cormorant Garamond",
          "Georgia",
          "serif",
        ],
      },
      colors: {
        ivory: "#F7F5F0",
        surface: "#FFFCF8",
        stone: {
          DEFAULT: "#E8E4DC",
          50: "#FAF8F5",
          100: "#F0EDE6",
          200: "#E8E4DC",
          300: "#D4CFC4",
          400: "#A8A196",
          500: "#7A756C",
          600: "#5C574F",
        },
        navy: {
          DEFAULT: "#0F2438",
          light: "#1A3A5C",
          soft: "#2D4A6F",
          muted: "#4A6278",
        },
        gold: {
          DEFAULT: "#B8956B",
          light: "#D4C4B0",
          muted: "#E8DFD2",
        },
        charcoal: "#1C1C1A",
        /* Legacy aliases — keep for gradual migration */
        royal: "#1A3A5C",
        powder: "#E8DFD2",
        border: "#E8E4DC",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 36, 56, 0.04), 0 4px 12px rgba(15, 36, 56, 0.06)",
        "card-lg":
          "0 2px 4px rgba(15, 36, 56, 0.04), 0 8px 24px rgba(15, 36, 56, 0.08)",
        soft: "0 2px 8px rgba(15, 36, 56, 0.12)",
        hero: "0 12px 40px rgba(15, 36, 56, 0.22)",
        nav: "0 -4px 24px rgba(15, 36, 56, 0.08), 0 8px 16px rgba(15, 36, 56, 0.06)",
      },
      letterSpacing: {
        luxury: "0.02em",
      },
    },
  },
  plugins: [],
}

export default config
