import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        omani: {
          red: {
            DEFAULT: "#8B1E24",
            light: "#A82931",
            dark: "#641217",
            50: "#FDF2F3",
            100: "#FCE4E6",
            800: "#73171C",
            900: "#4F0E12",
          },
          green: {
            DEFAULT: "#14532D",
            light: "#1E6F3D",
            dark: "#0C381D",
            50: "#F0FDF4",
            100: "#DCFCE7",
            800: "#166534",
            900: "#0D3B20",
          },
          gold: {
            DEFAULT: "#C59B27",
            light: "#DFB848",
            dark: "#967315",
            50: "#FEFCE8",
            100: "#FEF9C3",
            200: "#FDE047",
            800: "#854D0E",
          },
          ivory: {
            DEFAULT: "#FAF8F4",
            paper: "#F4EFE6",
            border: "#E5DEC9",
          },
        },
      },
      fontFamily: {
        sans: ["'Tajawal'", "'Cairo'", "system-ui", "-apple-system", "sans-serif"],
        serif: ["'Amiri'", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
