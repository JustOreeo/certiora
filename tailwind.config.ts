import type { Config } from "tailwindcss";

// ─── Certiora Tailwind Config ────────────────────────────────────────────────
// All color/radius/shadow values here reference CSS variables defined in
// globals.css. To change the theme, update the variables in globals.css —
// no changes needed here.
// ─────────────────────────────────────────────────────────────────────────────

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Colors ──────────────────────────────────────────────────────────
      colors: {
        // Brand primitive scale  →  bg-brand-500, text-brand-200, etc.
        brand: {
          50:  "var(--color-brand-50)",
          100: "var(--color-brand-100)",
          200: "var(--color-brand-200)",
          300: "var(--color-brand-300)",
          400: "var(--color-brand-400)",
          500: "var(--color-brand-500)",
          600: "var(--color-brand-600)",
          700: "var(--color-brand-700)",
          800: "var(--color-brand-800)",
          900: "var(--color-brand-900)",
        },

        // Semantic primary  →  bg-primary, hover:bg-primary-hover, etc.
        primary: {
          DEFAULT: "var(--color-primary)",
          hover:   "var(--color-primary-hover)",
          active:  "var(--color-primary-active)",
          subtle:  "var(--color-primary-subtle)",
          muted:   "var(--color-primary-muted)",
        },

        // Surfaces  →  bg-surface-base, bg-surface-card, bg-surface-sidebar
        surface: {
          base:    "var(--color-surface-base)",
          card:    "var(--color-surface-card)",
          input:   "var(--color-surface-input)",
          sidebar: "var(--color-surface-sidebar)",
        },

        // Text hierarchy  →  text-heading, text-body, text-secondary, etc.
        heading:   "var(--color-text-heading)",
        body:      "var(--color-text-body)",
        secondary: "var(--color-text-secondary)",
        muted:     "var(--color-text-muted)",
        inverse:   "var(--color-text-inverse)",
        link:      "var(--color-text-link)",

        // Sidebar text  →  text-sidebar, text-sidebar-muted
        sidebar: {
          DEFAULT: "var(--color-sidebar-text)",
          muted:   "var(--color-sidebar-muted)",
          active:  "var(--color-sidebar-active)",
        },

        // Borders  →  border, border-subtle, border-strong, border-focus
        border: {
          DEFAULT: "var(--color-border)",
          subtle:  "var(--color-border-subtle)",
          strong:  "var(--color-border-strong)",
          focus:   "var(--color-border-focus)",
        },

        // Semantic states  →  text-success, bg-success-bg, border-success-border
        success: {
          DEFAULT: "var(--color-success)",
          bg:      "var(--color-success-bg)",
          border:  "var(--color-success-border)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          bg:      "var(--color-warning-bg)",
          border:  "var(--color-warning-border)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          bg:      "var(--color-error-bg)",
          border:  "var(--color-error-border)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          bg:      "var(--color-info-bg)",
          border:  "var(--color-info-border)",
        },
      },

      // ── Font families ────────────────────────────────────────────────────
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },

      // ── Border radius ────────────────────────────────────────────────────
      // Replaces Tailwind defaults so all rounded-* utilities use our scale.
      borderRadius: {
        xs:   "var(--radius-xs)",
        sm:   "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        xl:   "var(--radius-xl)",
        "2xl":"var(--radius-2xl)",
        full: "var(--radius-full)",
      },

      // ── Box shadows ──────────────────────────────────────────────────────
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },

      // ── Ring colors (focus rings) ────────────────────────────────────────
      ringColor: {
        DEFAULT: "var(--color-border-focus)",
        primary: "var(--color-primary)",
      },
    },
  },
  plugins: [],
};

export default config;
