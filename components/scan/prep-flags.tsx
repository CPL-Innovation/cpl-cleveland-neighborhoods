// Human-readable labels for the crop engine's flags (scan/crop_engine.py). Shared by the
// contact-sheet grid and the crop editor so the wording stays in one place.
import { STAFF_TOKENS } from "@/lib/tokens";

export const FLAG_LABELS: Record<string, { label: string; hint: string }> = {
  clip_top: { label: "may clip top", hint: "a bright/smooth band above the photo (often sky) may have been dropped" },
  large_angle: { label: "skewed", hint: "deskew angle is large — confirm the photo is upright" },
  extreme_aspect: { label: "odd aspect", hint: "crop is unusually wide or tall for a print — likely a bad box" },
  multi_component: { label: "stray marks", hint: "a second textured region (margin ink, a split) sits near the photo" },
  detect_weak: { label: "weak detect", hint: "little texture found — the auto box is a guess" },
};

export function flagTone(): string {
  return STAFF_TOKENS.ochre;
}
