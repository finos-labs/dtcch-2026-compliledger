/**
 * ============================================================================
 * SITE CONFIGURATION
 * ============================================================================
 *
 * Customize your landing page by editing the values below.
 * All text, links, and settings are centralized here for easy editing.
 */

export const siteConfig = {
  name: "SettlementGuard",
  tagline: "Proof at Scale",
  description:
    "Compliance-native settlement enforcement for tokenized markets. Deterministic proof before finality — cryptographically, at scale.",
  url: "https://settlementguard.io",
  twitter: "@settlementguard",

  nav: {
    cta: {
      text: "See the Proof Chain",
      href: "#demo",
    },
    signIn: {
      text: "Verify Attestation",
      href: "#verification",
    },
  },
} as const;

/**
 * ============================================================================
 * FEATURE FLAGS
 * ============================================================================
 *
 * Toggle features on/off without touching component code.
 */
export const features = {
  smoothScroll: true,
  darkMode: true,
} as const;

/**
 * ============================================================================
 * THEME CONFIGURATION
 * ============================================================================
 *
 * Colors are defined in globals.css using CSS custom properties.
 * This config controls which theme features are enabled.
 */
export const themeConfig = {
  defaultTheme: "dark" as "light" | "dark" | "system",
  enableSystemTheme: true,
} as const;
