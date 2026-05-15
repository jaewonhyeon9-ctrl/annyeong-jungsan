import type { Config } from "tailwindcss";

// Beige earthtone palette — matches 별빚도장/보장도장 톤
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // base
        sand: {
          50: "#FAF7F2",
          100: "#F3ECE0",
          200: "#E8DDC8",
          300: "#D9C7A6",
          400: "#C5AC85",
          500: "#A8916A",
          600: "#8B7553",
          700: "#6E5C42",
          800: "#544631",
          900: "#3C3122",
        },
        clay: {
          400: "#C28B6E",
          500: "#A26F54",
          600: "#85583F",
        },
        moss: {
          400: "#8FA37A",
          500: "#71875E",
          600: "#586D49",
        },
        ink: "#2A2218",
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
