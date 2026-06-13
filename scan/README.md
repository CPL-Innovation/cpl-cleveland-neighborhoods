# Scan & Interpret Pipeline

Implements [`../technical/scan-pipeline-ux.md`](../technical/scan-pipeline-ux.md) (Tier 1 —
extraction) and the prompt in [`../technical/vlm-description-spec.md`](../technical/vlm-description-spec.md).

Box-scan TIFF masters → derived JPEGs → one VLM read each (address · year · description) →
human review → an Accuracy rollup. Tier 2 interpretation, geocoding, and the re-runnable
whole-pass feature are deliberately **out of scope**.

```
masters/<CHC_ID>.tif            (you drop these in — gitignored)
   │  derive.mjs   sharp: 600→300dpi (by DPI), q85, sRGB, 8-bit/RGB, flatten, bake rotation, strip EXIF
   ▼
derivatives/<CHC_ID>.jpg        (web-friendly copy the VLM + UI use)
   │  vlm-extract.mjs   one Gemini call → { address, year, description, objects }
   ▼
data/scan/scan_review.json      (the per-photo working record — keyed by CHC ID)
   │  server.mjs   serves the app + accepts durable review writes
   ▼
Surface B (review) → Surface C (Accuracy + accuracy.csv)
```

## Setup

```
npm install            # pulls sharp (the only dependency)
export GEMINI_API_KEY=…   # optional; without it the pipeline runs in STUB mode
```

The CHC ID is the **filename stem** — `CHC016776.tiff` → `CHC016776`. `.tif` and `.tiff` both match.

## Run

```
node scan/run.mjs                  # derive every master, then VLM each → scan_review.json
node scan/run.mjs --only CHC016776 # re-attempt one photo (per-photo retry, not re-run-all)
node scan/derive.mjs               # derive only (no VLM)
node scan/accuracy.mjs             # print the rollup + write data/scan/accuracy.csv
node scan/server.mjs               # serve the app + review write-back (default :8000)
```

Re-running is resumable: a master whose JPEG already exists is skipped (use `--force` to redo).

## The review surface

`node scan/server.mjs` replaces `python3 -m http.server` while reviewing — it serves the static
app **and** persists review verdicts. Open `enrichment-app.html`, go to **Ingest → Scan pipeline**,
click **Start review**, and judge each photo. Verdicts auto-save and survive a reload.

## Knobs

- `scan/derive.mjs`: `TARGET_DPI` (300), `JPEG_QUALITY` (85), `ASSUMED_SOURCE_DPI` (600 fallback).
- `scan/vlm-extract.mjs`: `GEMINI_MODEL` env (default `gemini-3-flash`), `MAX_ATTEMPTS` (3), `TIMEOUT_MS`.
- `scan/server.mjs`: `PORT` env (default 8000).

## Swapping the VLM engine

The provider lives entirely inside `scan/vlm-extract.mjs` behind `vlmExtract(jpeg)`. To run the
bake-off against Claude Sonnet 4.6 or GPT-5 mini, add a sibling `callX()` and switch on an env flag —
nothing else in the pipeline changes.

## What this does / doesn't

- ✅ Discover + derive (sharp) + VLM adapter (Gemini, stub fallback) + scan_review store
- ✅ Per-call retry/backoff; failed photos itemized + individually re-attemptable
- ✅ Accuracy rollup (illegible excluded from denominator) + per-photo CSV
- ✅ Write-back server for durable in-app review
- ❌ Geocoding (store the clean address; coordinates are a scale-phase concern)
- ❌ Tier 2 `vlmInterpret`, re-run-all, ContentDM sync, real `photo_enrichment` migration (hooks only)
