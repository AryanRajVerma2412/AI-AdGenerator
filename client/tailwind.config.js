/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "sans-serif"],
      },
      colors: {
        // Nature-inspired light cream background with dark olive text and earthy gold accent
        surface: {
          DEFAULT: "#F7F6EC",
          light: "#FAF9EE",
          card: "#FFFFFF",
          subtle: "#EFECCF",
        },
        olive: {
          DEFAULT: "#28301C", // Main text color (previously background)
          deep: "#1E2515",    // Headings
          dark: "#28301C",
          medium: "#323D25",  // Secondary text
          light: "#4A5737",
          subtle: "#62724C",
          muted: "#7E8F67",
        },
        accent: {
          DEFAULT: "#9A7E3B", // Earthy gold
          hover: "#856C31",
          light: "#B5954B",
          dark: "#7A632C",
          muted: "rgba(154, 126, 59, 0.15)",
        },
        cream: {
          DEFAULT: "#D2CF9A",
          light: "#FAF9EE",
          surface: "#F7F6EC",
          card: "#FFFFFF",
          dark: "#B8B57E",
          muted: "rgba(210, 207, 154, 0.25)",
        },
        brand: {
          50: "#FAF9EE",
          100: "#F7F6EC",
          200: "#EFECCF",
          300: "#D2CF9A",
          400: "#B5954B",
          500: "#9A7E3B",
          600: "#856C31",
          700: "#6B5625",
          800: "#4A5737",
          900: "#323D25",
          950: "#28301C",
        },
        dark: {
          950: "#1E2515",
          900: "#28301C",
          850: "#2D3720",
          800: "#323D25",
          750: "#3C492C",
          700: "#465534",
        },
      },
      animation: {
        "shimmer": "shimmer 2.5s infinite linear",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 5s ease-in-out infinite",
        "glow": "glow 3s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.35s ease-out forwards",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "spin-slow": "spin 12s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        glow: {
          "0%": { opacity: 0.4, filter: "drop-shadow(0 0 15px rgba(154, 126, 59, 0.3))" },
          "100%": { opacity: 0.8, filter: "drop-shadow(0 0 25px rgba(154, 126, 59, 0.5))" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "glow-accent": "0 0 25px -4px rgba(154, 126, 59, 0.25)",
        "glow-gold": "0 0 30px -5px rgba(154, 126, 59, 0.3)",
        "glass": "0 8px 30px 0 rgba(40, 48, 28, 0.08)",
        "inner-light": "inset 0 1px 0 0 rgba(255, 255, 255, 0.8)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
