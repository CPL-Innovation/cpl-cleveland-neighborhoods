# Scan & Interpret Pipeline

Implements [`../technical/scan-pipeline-ux.md`](../technical/scan-pipeline-ux.md) (Tier 1 —
extraction) and the prompt in [`../technical/vlm-description-spec.md`](../technical/vlm-description-spec.md).

Box-scan TIFF masters → derived JPEGs → one VLM read each (address · year · description) →
human review → an Accuracy rollup. Tier 2 interpretation, geocoding, and the re-runnable
whole-pass feature are deliberately **out of scope**.

> **Migrated to TypeScript + Postgres.** The pipeline is now a `tsx` CLI (`scan/*.ts`) plus
> Next.js API routes sharing the same `lib/` code. The old `scan/*.mjs` + `scan_review.json` +
> `server.mjs` path is gone — review data lives in Postgres, and the staff app *is* the server.

```
scans/masters/<CHC_ID>.tif      (drop box-scans here, or let the Prep stage write them — gitignored)
   │  scan/derive.ts   sharp: source→300dpi (by DPI), q85, sRGB, bake rotation
   ▼
public/derivatives/<CHC_ID>.jpg (the JPEG the VLM + UI use; lib/storage.ts owns the write)
   │  lib/vlm-extract.ts   one Gemini call → { address, year, description, objects }
   ▼
scan_review  (Postgres row, keyed by CHC ID — the per-photo working record)
   │  /staff  reads + writes it through /api/scan/*
   ▼
Surface B (review) → Surface C (Accuracy + data/scan/accuracy.csv)
```

## Setup

See the root [`CLAUDE.md`](../CLAUDE.md) §Setup for the full local-dev bootstrap (local
Postgres + migrations). In brief:

```
npm install                 # pulls sharp, drizzle, postgres, supabase-js
# DATABASE_URL → local Postgres in .env.local; npm run db:migrate
export GEMINI_API_KEY=…      # optional; without it the VLM runs in STUB mode (canned reads)
```

The CHC ID is the **filename stem** — `CHC016776.tiff` → `CHC016776`. `.tif` and `.tiff` both match.

## Run

Two doors into the pipeline — a local CLI batch, or the in-app **Scan inbox**:

```
npm run scan:run                      # derive every master → JPEG store → VLM → scan_review
npm run scan:run -- --only CHC016776  # one photo (per-photo retry)
npm run scan:run -- --force           # re-derive + re-VLM even if already ready
npm run scan:run -- --in some/dir     # point at a different masters folder
npm run scan:accuracy                 # print the rollup + write data/scan/accuracy.csv
```

- **UI-driven ingest** — in the staff app, **Ingest → Scan pipeline → Ingest ↓** opens the
  **Scan inbox**: it lists `scans/masters/`, flags new vs. already-ingested, and ingests selected
  photos one at a time with live progress (same `derive → store → VLM → upsert` core as the CLI,
  in `lib/scan-ingest.ts`). **Local-only** — `sharp` derivation never runs in serverless, so the
  ingest API refuses on a deploy; use `scan:run` from a local checkout there.
- **Un-ingest** — select rows in the pipeline sheet → **Remove from pipeline** deletes the
  `scan_review` row and the derived JPEG. The master TIFF in `scans/masters/` is untouched, so the
  photo reappears as `new` in the inbox and can be re-ingested.

Re-running is resumable: a master whose record is already `ready` is skipped (use `--force` to redo).

## The review surface

Run `npm run dev` and open **`/staff` → Ingest → Scan pipeline**. The pipeline is a worklist
sheet of every ingested photo (thumbnail · stage · VLM read · review verdicts). Click a ready
row, or **Start review**, to judge each photo. Verdicts **auto-save** to Postgres via
`/api/scan/records/[chcId]` and survive a reload.

**Verdicts** (address/year are scored; description is qualitative):

- Address · Year → **`correct`** (VLM matched) · **`edited`** (you typed the right answer — the
  only "miss") · **`illegible`** (no one can read it — *excluded from the accuracy denominator*).
- Description → **`accept`** · **`edit`** · **`reject`**, plus a free-text holistic **notes** field.

## Knobs

- `scan/derive.ts`: `TARGET_DPI` (300), `JPEG_QUALITY` (85), `ASSUMED_SOURCE_DPI` (600 fallback).
- `lib/vlm-extract.ts`: `GEMINI_MODEL` env (default `gemini-3-flash-preview`), `MAX_ATTEMPTS` (3), `TIMEOUT_MS`.
- `lib/storage.ts`: `STORAGE_BACKEND=local|supabase` (else auto), `SUPABASE_DERIVATIVES_BUCKET`.
- `scan/env.mjs` loads `.env.local` / `.env` for the CLI (`DATABASE_URL`, `SUPABASE_*`, `GEMINI_API_KEY`).

## Swapping the VLM engine

The provider lives entirely inside `lib/vlm-extract.ts` behind `vlmExtract(jpegBytes)`. To run a
bake-off against Claude Sonnet 4.6 or GPT-5 mini, add a sibling `callX()` and switch on an env flag —
nothing else in the pipeline changes.

## What this does / doesn't

- ✅ Discover + derive (sharp) + VLM adapter (Gemini, stub fallback) + DB-backed `scan_review` store
- ✅ Two ingest doors: local `scan:run` CLI **and** the in-app Scan inbox (local-only)
- ✅ Un-ingest (remove row + derivative; master stays) for re-ingest
- ✅ Per-call retry/backoff; failed photos itemized + individually re-attemptable
- ✅ Accuracy rollup (`illegible` excluded from denominator) + per-photo CSV
- ❌ Geocoding (store the clean address; coordinates are a scale-phase concern)
- ❌ Tier 2 `vlmInterpret`, re-run-all, ContentDM sync, real `photo_enrichment` migration (hooks only)
