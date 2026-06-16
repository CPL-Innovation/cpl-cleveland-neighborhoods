# Scan & Interpret Pipeline

Implements the scan-pipeline design (Tier 1 — extraction). The VLM prompt is vendored at
[`../lib/vlm-prompt.ts`](../lib/vlm-prompt.ts); its canonical design intent + rationale live
in the design vault at `build/enrichment-app/` (`scan-pipeline-ux.md`, `vlm-description-spec.md`).

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

- **UI-driven ingest** — in the staff app, **Scan pipeline → Ingest → Ingest ↓** opens the
  **Scan inbox**: it lists `scans/masters/`, flags new vs. already-ingested, and ingests selected
  photos one at a time with live progress (same `derive → store → VLM → upsert` core as the CLI,
  in `lib/scan-ingest.ts`). **Local-only** — `sharp` derivation never runs in serverless, so the
  ingest API refuses on a deploy; use `scan:run` from a local checkout there.
- **Un-ingest** — select rows in the pipeline sheet → **Remove from pipeline** deletes the
  `scan_review` row and the derived JPEG. The master TIFF in `scans/masters/` is untouched, so the
  photo reappears as `new` in the inbox and can be re-ingested.

Re-running is resumable: a master whose record is already `ready` is skipped (use `--force` to redo).

## Tier 1.5 — facet discovery (offline analysis, not the pipeline)

A **separate, one-off** instrument from the Tier 1 pipeline above — it does not touch `scan_review`,
`photo_enrichment`, or the UI. `scan/facet-discovery.ts` re-reads the existing
`public/derivatives/` JPEGs and runs a second, inventory-only VLM call (`vlmFacet` in
[`../lib/vlm-facet.ts`](../lib/vlm-facet.ts), sibling to `vlmExtract`) that returns only a
`visible_inventory` — a dense, visible-only set of attributes grouped by candidate axis (structures,
materials, archival_markup, …). Design intent: `build/enrichment-app/vlm-facet-spec.md` (design vault).

It is a **three-way cross-check** across three strong frontier VLMs — Gemini 3.1 Pro, Claude Opus 4.8,
GPT-5 — so the per-axis agreement signal (all three agree → lock the facet; two agree → soft; all
split → model-dependent) tells us which facets are *reliable*, not just present. Each arm uses its
provider's native structured-output mode (container enforced, values free; never free-parse).

```
npm run scan:facets                       # every keyed arm, all derivatives → one JSON per model
npm run scan:facets -- --provider opus     # one arm only (gemini | opus | gpt5)
npm run scan:facets -- --only CHC019059    # one photo (smoke test)
npm run scan:facets -- --limit 5           # first N (cheap dry run)
```

Output: `data/scan/facets-discovery-{gemini,opus,gpt5}.json`, keyed by CHC ID, identical shape,
diffable key-by-key (gitignored — analysis artifact, consumed offline). Arms without a key run in
STUB mode and are skipped from the real signal. **No re-review** — raw output, mistakes included.

### Run 2 — the enforced-schema A/B

Discovery (Run 1) froze the *container* and freed the *values*; **Run 2 also constrains the values
to closed enums** — the v1 LOCKED schema (`Run2Facets` in [`../lib/types.ts`](../lib/types.ts)).
Two pieces, in order:

- **Piece A — extraction.** `scan/facet-run2.ts` (`npm run scan:run2`) calls `vlmRun2`
  ([`../lib/vlm-run2.ts`](../lib/vlm-run2.ts)) — **Gemini 3.1 Pro, single model** (the cross-check
  is done; Run 2 evaluates the production candidate, not models against each other) — under the
  enforced enum schema via Gemini's `responseSchema`, with three in-prompt guards (change-only
  condition, no-fabrication, confidence-honesty). Output `data/scan/facets-run2.json`, keyed by CHC
  ID. **Resumable** — re-running skips records already in the out file (so a quota-interrupted run
  finishes without re-billing); `--force` re-extracts. Eval artifact only — no production write.

  ```
  npm run scan:run2                  enforced extraction over every derivative (resumes)
  npm run scan:run2 -- --only CHC…    one photo · --limit N · --force · --out <path>
  ```

- **Piece B — staff facet-review UI + A/B scoring.** `/staff → Scan pipeline → Facet review`
  ([`../components/scan/facet-review.tsx`](../components/scan/facet-review.tsx)): per-photo image +
  baseline Tier-1 caption (the "value over the caption" comparison) + the ~16 facet fields as
  editable widgets (multi-select chips, single-selects, booleans, transcription arrays, confidence
  on the soft-confidence fields). Reads the eval artifact via `/api/scan/facets`; staff corrections
  persist to a **staging file** (`data/scan/facets-run2-review.json`) via `lib/facet-review-store.ts`.

### Stage 0 — graduate the validated 99 to production

**The A/B cleared (v0.5 — all four scoring questions passed).** The firebreak is now **lifting,
scoped to Stage 0**: the same 99 City Hall-box facets the A/B validated graduate to the production
`photo_enrichment` store, *behind the staff review surface*. In the Facet review UI, **approving a
record** (the "approve → production" toggle + Save, i.e. `reviewed: true`) writes its staff-approved
facets to `photo_enrichment` (`facets` JSONB + `facets_reviewed_at`/`_by`/`facets_source`
provenance); un-approving clears them. Scoped by construction to the 99 (the only records the eval
artifact knows about).

Two reviewer-approved **v0.5 schema fixes** applied: `cracked_pavement` moved
`condition_and_change → street_and_ground` (a ground state, not a transition — change rate settles
at 12/99); `materials` is wall-cladding-only (a brick chimney on a wood house is `wood_frame` +
`chimney`, not `brick`).

> **Firebreak status — lifting, scoped (not a flip-the-collection switch).** Stage 0 writes the
> validated 99 only. **Stage 1** (a new neighborhood batch — the representativeness + Flash-vs-Pro
> test) and **Stage 2** (bulk) remain **gated** and are *not built*. The discipline shifted from
> "don't write" to "don't write *ahead of the evidence*." The write path is local-only (it reads
> the local eval artifact).

## The review surface

Run `npm run dev` and open **`/staff` → Scan pipeline → Ingest**. The Ingest surface is a worklist
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
- `lib/vlm-facet.ts` (Tier 1.5): per-arm model overrides `FACET_MODEL_GEMINI` (default
  `gemini-3.1-pro-preview`), `FACET_MODEL_OPUS` (default `claude-opus-4-8`), `FACET_MODEL_GPT5`
  (default `gpt-5`); keys `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`. A missing key →
  that arm runs in STUB mode.

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
