// Design tokens — ported verbatim from staff-shell.jsx STAFF_TOKENS. The staff UI is
// styled inline with these (CSS-in-JS); there are no component stylesheets.
export const STAFF_TOKENS = {
  bg: "#F6F2EB", // warm parchment
  bgPanel: "#FFFFFF",
  bgSurface: "#FBF8F1",
  bgInk: "#221F1B", // sidebar dark
  bgInkSubtle: "#2D2924",
  ink: "#1A1814",
  inkSubtle: "#3D3833",
  inkMuted: "#6B6359",
  inkFaint: "#A39684",
  border: "#D6CDBD",
  borderSoft: "#E8DFCE",
  teal: "#1F5963",
  tealSoft: "#E2EBEC",
  terracotta: "#A8362B",
  ochre: "#C8983A",
  ochreSoft: "#F1E5C8",
  sage: "#5C7A4F",
  sageSoft: "#E4ECDF",
  draft: "#9A6B3C",
  draftSoft: "#F3E6D4",
  serif: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
  sans: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export type StaffTokens = typeof STAFF_TOKENS;
