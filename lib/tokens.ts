// Design tokens. The staff UI is styled inline with these (CSS-in-JS); there are no
// component stylesheets.
//
// M2 (CPL Design System): the STAFF_TOKENS *definition* draws from the shared
// `@cpl/tokens` package instead of hardcoded warm/teal hex — same keys out, package
// values in. The ~900 `t.*` call sites are untouched; a re-skin is a definition swap.
//
// tokens v0.2: the four M2 stopgaps are gone. The soft chip fills, the warning ink,
// the on-fill foreground and the cool middle surface are all real package slots now —
// this file no longer derives or hardcodes a single color.
//
// We read the static `tokens` export (resolved concrete values, no stylesheet needed).
// Per the M2 theming decision there is NO live theme switching in CN staff; if that ever
// changes, this file migrates to `cssVar`/`cssVarName` — a migration, not a config flip.
import { tokens } from "@cpl/tokens";

export const STAFF_TOKENS = {
  bg: tokens.surface,                // page canvas — white; borders carry the structure
  bgPanel: tokens.surface,
  bgSurface: tokens.surfaceSubtle,   // the cool inset step, now recessed *below* the canvas
  bgSidebar: tokens.surfaceSunken,   // sidebar — light cool fog against the white canvas
  bgInk: tokens.colorPrimaryInk,     // the remaining DARK surfaces (image well, pipeline strip)
  bgInkSubtle: tokens.cplNavyDeep,
  ink: tokens.colorPrimaryInk,       // navy-ink ramp: ink → subtle → muted → faint
  inkSubtle: tokens.text1,
  inkMuted: tokens.text2,
  inkFaint: tokens.text3,
  onFill: tokens.textOnFill,         // foreground on a filled control — never a surface
  border: tokens.border,
  borderSoft: tokens.borderHair,
  teal: tokens.colorPrimary,         // the accent — teal → navy
  tealSoft: tokens.colorPrimarySoft,
  terracotta: tokens.colorDanger,    // reject / failed / error
  // Status colors come in three forms (tokens-spec §4): base = dot/fill, soft = chip
  // background, ink = anything with TEXT on or in it. CN's bare key is the **ink**,
  // because that is what the overwhelming majority of its call sites need — including
  // filled controls, where the white `onFill` label is what has to stay legible.
  // Reach for `*Base` only for a bare dot or a decorative rule carrying no text.
  ochre: tokens.colorWarningInk,     // illegible / partial
  ochreBase: tokens.colorWarning,
  ochreSoft: tokens.colorWarningSoft,
  sage: tokens.colorSuccessInk,      // correct / published
  sageBase: tokens.colorSuccess,
  sageSoft: tokens.colorSuccessSoft,
  draft: tokens.colorInfoInk,        // draft / edited / unsaved — warm brown → cool denim
  draftBase: tokens.colorInfo,
  draftSoft: tokens.colorInfoSoft,
  serif: tokens.cplFontSerif,
  sans: tokens.cplFontSans,
  mono: tokens.cplFontMono,
} as const;

export type StaffTokens = typeof STAFF_TOKENS;
