---
type: log
status: active
created: 2026-06-13
---

# Prep Surface — Crop & Deskew

> **Last updated:** 2026-06-13 · v1.0 · status: built

The first stage of the **Scan pipeline** area, inside the enrichment interface:
**Prep → Ingest → Review**. Live at `/staff → Scan pipeline → Prep`.

Raw flatbed scans of physical prints carry three zones: the scanner bed (white around the
print), the print's own white **paper border**, and the **photographic image** (emulsion) with
any ink written on it. Prep removes the first two and corrects skew, turning `scans/raw/<CHC>.tif`
into the clean `scans/masters/<CHC>.tif` that the downstream **Ingest** stage already assumes. The
eval of Prep is visual: a crop is verifiable in a thumbnail, so the surface is a **contact-sheet
grid**, not a one-photo screen like Review.

`scans/masters/` is the boundary. Prep only ever *writes* it; Ingest/Review are untouched.

## Crop target (precise)

Keep the **photographic image rectangle only**. Decisive rule: *keep ink only if it's on the
image.* On-emulsion captions (a street name, a date written across the print) are inside the
rectangle → kept. Writing floating in the white margin (a loose "330" below the print) → cropped
out. Verified on real CPL scans: CHC019065's "18115 Groveland Ave" caption is retained; a stray
margin "330" on a synthetic fixture drops out.

## Why texture, not brightness

A pale or blown-out sky in the photo is as bright as the white paper border, so a brightness
threshold can't separate them. The emulsion is **grainy** (high local variance); paper and bed
are **smooth**. So the engine (`scan/crop_engine.py`, OpenCV) masks on **local std-dev**, not
brightness:

1. Load TIFF (cv2 / Pillow — survives 16-bit, grayscale, LZW); normalized 8-bit gray copy for masking only.
2. **Local-variance mask** over a small window — grainy emulsion lights up, smooth paper stays dark.
3. **Morphological close** → solidify the emulsion into one blob.
4. **Single largest connected component** = the photo. Isolated margin ink is its own small
   component and drops out *for free*. We deliberately do **not** OR in a global dark-ink mask —
   that would wrongly re-include margin writing.
5. `minAreaRect` → rectangle + skew angle → deskew via `warpAffine`, crop tight (≈zero inset).
   The deskew rotation is the only resample; a 0° box is a pure lossless slice. The master is
   written at full bit depth (LZW TIFF) — no downscaling, no JPEG.

The box is returned to the frontend in **raw full-res pixels** `{cx, cy, w, h, angle}` so a human
can adjust it.

### Known failure mode — dropped sky (flagged aggressively)

A blown-out sky at the **top** of a photo reads as smooth "paper" and gets dropped from the
blob, clipping into the image. Brightness *and* texture are identical to a real top border (both
~250 / std ~1, measured), so the only usable signal is **margin asymmetry**: when the top margin
balloons relative to the other three (>1.25×) *and* a bright-smooth band sits just above the
blob, we raise `clip_top`. Over-flagging at the top is intended — a flag costs a glance; a silent
mis-crop costs the photo.

Other flags: `large_angle` (skew > 3.5°), `extreme_aspect`, `multi_component` (a second textured
region — margin ink or a split near the photo), `detect_weak` (little texture found). On real
scans the texture blob sometimes latches onto a high-contrast sub-region (a white-on-black
caption band, the chrome of parked cars) instead of the whole grayscale photo — that surfaces as
`weak_detect`/`odd_aspect` and is exactly what the hand-fix editor is for.

## The surface

- **Kick off:** point Prep at `scans/raw/` → **Auto-crop** runs the engine over every un-cropped
  scan, one at a time with live progress (mirrors the Scan inbox).
- **Contact-sheet grid:** one tile per print, **raw ▸ cropped**, keyed by CHC ID. Unflagged tiles
  default to approvable; flagged tiles are highlighted with their reasons.
- **Fix a flagged tile:** open it → an interactive crop box (drag to move · corner handles to
  resize · top handle to rotate) pre-filled with the engine's box, over the raw scan. Adjust by
  hand, or **Looser / Tighter** to recompute, then **Save** (→ `fixed`) or **Approve → master**.
- **Approve all → masters:** writes `scans/masters/<CHC>.tif` (lossless) for every `auto_ok`/
  `fixed` tile, then hands off to the Ingest stage. Nothing reaches Ingest until approved.
- **Durability:** a per-CHC `scan_prep` row (`pending | auto_ok | flagged | fixed | approved`),
  same promise as Review — a batch survives a closed laptop.
- **Throughput stat** (`processed · flagged · wall-clock`) — the staff-time-saved metric this
  stage is justified on.

## Architecture (how it's wired)

Prep is a **local-only** job, the same shape as the existing ingest doors (`lib/scan-ingest.ts`):
the CV runs `python3` against a local TIFF, so the API routes gate on `prepEnabled()` (`!VERCEL`)
and 403 in serverless.

```
scans/raw/<CHC>.tif
  │  scan/crop_engine.py   (subprocess; one JSON request → one JSON response)
  │    auto    detect box + flags, render raw + crop previews
  │    recrop  re-render from a hand-fixed box (or looser/tighter re-detect)
  │    apply   write the lossless cropped+deskewed master
  ▼
public/prep/<CHC>.{raw,crop}.jpg   (previews; served at /prep/*, gitignored)
scan_prep  (Postgres row, keyed by CHC ID — the durable prep state)
  │  /staff Prep grid + crop editor read/write via /api/scan/prep[/<CHC>]
  ▼
scans/masters/<CHC>.tif   ──hand off──▶  Ingest stage (Scan pipeline area), unchanged
```

- Engine (Node side): `lib/prep-engine.ts` — `autoCropOne · recropOne · applyOne · listRaw`.
- State store: `lib/prep-store.ts` (mirrors `scan-store.ts`); table in `drizzle/schema.ts`.
- Client: `lib/prep-api.ts`; surface `components/scan/prep.tsx` + `prep-editor.tsx`
  (+ shared flag labels in `prep-flags.tsx`).
- Routes: `app/api/scan/prep/route.ts` (list) · `app/api/scan/prep/[chcId]/route.ts` (action).

Folders: `scans/raw/` (Prep input) and `scans/masters/` (Prep output / Run input) live under one
gitignored `scans/` parent — both are large, local-only files, never web-served. Overridable via
`SCAN_RAW_DIR` / `SCAN_MASTERS_DIR`.

## Dependencies

`python3` with **OpenCV (`cv2`)** + **NumPy** (Pillow optional, used as a TIFF fallback).
`tifffile` is intentionally *not* required — it's binary-incompatible with NumPy 2.x in this
env, and cv2's libtiff + Pillow cover 16-bit / grayscale / LZW masters. Override the interpreter
with `PREP_PYTHON`.

## Acceptance (met)

- **Sample-first:** drop ~15–20 in `scans/raw/`, auto-crop, tune from the grid, then run the rest.
- No white border or margin ink retained; on-image content (top-edge sky + on-image handwriting)
  preserved or, where at risk, **flagged** — never silently mis-cropped.
- Prints visually upright (deskew). Failures are flagged and hand-fixable.
- Throughput stat emitted.
