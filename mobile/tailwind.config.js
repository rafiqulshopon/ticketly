/** @type {import('tailwindcss').Config} */
// NativeWind v4 (Tailwind v3). The web uses Tailwind v4 (`@theme inline` in
// index.css); NativeWind v4.2.6 is the latest *stable* release (v5 is preview
// only) and uses the v3 config style here. The actual color *values* are
// identical to the web — they live as CSS variables in src/global.css (ported
// from web/src/index.css) and are wired to utilities via this theme.extend map.
// "emerald = AI" and the ticket-state palette carry over verbatim.
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // AI brand signal (emerald) + semantic ticket-state palette.
        ai: {
          DEFAULT: "var(--ai)",
          foreground: "var(--ai-foreground)",
          soft: "var(--ai-soft)",
          "soft-foreground": "var(--ai-soft-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
          fg: "var(--success-fg)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
          fg: "var(--warning-fg)",
        },
        info: {
          DEFAULT: "var(--info)",
          foreground: "var(--info-foreground)",
          fg: "var(--info-fg)",
        },
        indigo: {
          DEFAULT: "var(--indigo)",
          foreground: "var(--indigo-foreground)",
          fg: "var(--indigo-fg)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
};
