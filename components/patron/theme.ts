// Patron design tokens — the Dateline Cleveland system ("flat civic discipline"), adopted
// whole for the patron map. Source of truth for the values: the Dateline Cleveland design
// system (tokens.json), built from cpl-dateline-cleveland apps/discovery. One light theme.
//
// The rules that matter more than any value: division by 1px hairline, no radius in page
// flow, shadows only on floating layers, `navy` = brand + interaction, `marigold` = the single
// accent and only ever a FILL or RULE (never text on white), and every machine claim labelled.
//
// Inline styles read `C` / `F` directly; patron.css reads the same values as CSS variables,
// which `patronCssVars` puts on the landing's root element — so there is one set of values,
// here, and Leaflet's injected DOM (inside that root) inherits them too.
import type React from "react";

export const C = {
  navy: "#0057b7",
  navyDeep: "#004591",
  marigold: "#f1c400",
  ink: "#0f1215",
  body: "#2b3340",
  secondary: "#505a69",
  // ⚠ Adoption fix. The source's tertiary (#8a94a3) is 3.07:1 on canvas / 2.78:1 on sunken,
  // and it carries most of the mono meta. The system's README asks adopters to darken it
  // toward `secondary`; this is the lightest step that clears AA on BOTH grounds (5.2 / 4.75).
  tertiary: "#646d7b",
  canvas: "#ffffff",
  sunken: "#f2f4f7",
  hairLight: "#e6e9ee",
  hairMed: "#c9cfd8",
  onNavy: "#ffffff",
  onMarigold: "#0f1215",
  // Honesty labels — the CPL info ink the system recommends for provenance notes (6.4:1).
  infoInk: "#2a6580",
  // Category swatches (functional only — TypeLabel, tile top edges, dots).
  catPhoto: "#4298b5",
  catMap: "#56944f",
  catCartoon: "#ff8d7e",
  // Translucent washes.
  navyWash: "rgba(0, 87, 183, 0.14)",
  navyTint: "rgba(0, 87, 183, 0.07)",
  navySelect: "rgba(0, 87, 183, 0.06)",
  marigoldMark: "rgba(241, 196, 0, 0.42)",
  glass: "rgba(255, 255, 255, 0.92)",
  scrim: "rgba(15, 18, 21, 0.45)",
} as const;

export const F = {
  serif: "'Spectral', 'Source Serif Pro', Georgia, 'Times New Roman', serif",
  sans: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, ui-monospace, monospace",
} as const;

export const SHADOW = {
  popover: "0 14px 36px rgba(15, 18, 21, 0.16)",
  panel: "0 18px 48px rgba(15, 18, 21, 0.18)",
  // Map overlays float over the basemap — lighter than a popover, but still a floating layer.
  overlay: "0 4px 16px rgba(15, 18, 21, 0.10)",
} as const;

/** The tokens as CSS custom properties, for patron.css. Spread onto the landing root. */
export const patronCssVars = {
  "--navy": C.navy,
  "--navy-deep": C.navyDeep,
  "--marigold": C.marigold,
  "--ink": C.ink,
  "--body": C.body,
  "--secondary": C.secondary,
  "--tertiary": C.tertiary,
  "--canvas": C.canvas,
  "--sunken": C.sunken,
  "--hair-light": C.hairLight,
  "--hair-med": C.hairMed,
  "--on-navy": C.onNavy,
  "--on-marigold": C.onMarigold,
  "--info-ink": C.infoInk,
  "--navy-wash": C.navyWash,
  "--navy-select": C.navySelect,
  "--marigold-mark": C.marigoldMark,
  "--font-serif": F.serif,
  "--font-sans": F.sans,
  "--font-mono": F.mono,
  "--shadow-popover": SHADOW.popover,
  "--shadow-overlay": SHADOW.overlay,
} as React.CSSProperties;

// ── Type styles (tokens.json `type`) ─────────────────────────────
// Mono meta is uppercase + tracked; sans chrome is uppercase + tracked; serif is sentence case.
export const T = {
  kicker: { fontFamily: F.sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: C.navy },
  sectionLabel: { fontFamily: F.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: C.ink },
  groupLabel: { fontFamily: F.sans, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.navy },
  meta: { fontFamily: F.mono, fontSize: 10.5, lineHeight: 1.6, letterSpacing: "0.08em", textTransform: "uppercase", color: C.tertiary },
  stamp: { fontFamily: F.mono, fontSize: 9.5, lineHeight: 1.5, letterSpacing: "0.04em", color: C.tertiary },
  fine: { fontFamily: F.mono, fontSize: 9, lineHeight: 1.6, letterSpacing: "0.06em", textTransform: "uppercase", color: C.tertiary },
  section: { fontFamily: F.serif, fontSize: 24, lineHeight: 1.2, fontWeight: 800, color: C.ink },
  detailTitle: { fontFamily: F.serif, fontSize: 30, lineHeight: 1.12, fontWeight: 700, color: C.ink, textWrap: "balance" },
  heroSection: { fontFamily: F.serif, fontSize: 44, lineHeight: 1.06, fontWeight: 700, color: C.ink, textWrap: "balance" },
  cardTitle: { fontFamily: F.serif, fontSize: 19, lineHeight: 1.2, fontWeight: 700, color: C.ink },
  deck: { fontFamily: F.serif, fontSize: 16.5, lineHeight: 1.55, color: C.secondary },
  dek: { fontFamily: F.serif, fontSize: 17, lineHeight: 1.5, fontStyle: "italic", color: C.secondary },
  body: { fontFamily: F.serif, fontSize: 15, lineHeight: 1.62, color: C.body },
  snippet: { fontFamily: F.serif, fontSize: 14.5, lineHeight: 1.6, color: C.secondary },
  empty: { fontFamily: F.serif, fontSize: 26, lineHeight: 1.2, fontWeight: 700, color: C.ink },
} satisfies Record<string, React.CSSProperties>;

/** The hatched placeholder for a missing image — never a grey box, never stock art. */
export const HATCH = `repeating-linear-gradient(45deg, ${C.sunken} 0 8px, ${C.canvas} 8px 16px)`;
