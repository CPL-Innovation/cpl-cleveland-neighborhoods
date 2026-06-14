# Data model

> **Reference** (current truth). **Source of truth = [`drizzle/schema.ts`](../drizzle/schema.ts)
> and [`lib/types.ts`](../lib/types.ts)** — this doc explains and links; it does not re-list every
> column (so it can't drift). Run `npm run db:generate` to see the generated SQL in
> `drizzle/migrations/`.
>
> **Status: skeleton.** Flesh out the field-by-field rationale once the schema solidifies
> (esp. when `photo_enrichment` write-back from the record-edit surface lands, and when the
> controlled-vocab tables are added). For the design rationale today, see the log
> [`technical/enrichment-schema.md`](../technical/enrichment-schema.md).

## Tables

### `scan_review` — the per-photo working record
One row per box-scan photo, keyed by `chc_id` (the filename stem). Holds the VLM output, the
human review verdicts (the eval data), and — on accept — the `photo_enrichment`-shaped payload.
JSONB columns (`derive`, `vlm`, `review`, `enrichment`) are typed via `lib/types.ts`. See
`drizzle/schema.ts` for columns; the design rationale is in
[`technical/scan-pipeline-ux.md`](../technical/scan-pipeline-ux.md) §"Per-photo working record".

**Verdicts (`review` JSONB) — current shape** (`lib/types.ts` is the source of truth):
- `address` / `year` → `{ verdict: "correct" | "edited" | "illegible", value }`. Three flat
  states: `correct` (VLM matched) · `edited` (the only "miss" — reviewer's truth + the
  before/after pair) · `illegible` (no value; **excluded from the accuracy denominator**). The
  old `flag` verdict and its `flag_reason` field were removed in the 4→3 collapse — pre-existing
  rows may still carry an inert `flag_reason: null` key, which nothing reads.
- `description` → `{ verdict: "accepted" | "edited" | "rejected", value }`, plus free-text `notes`.

Lifecycle: `discovered → derived → ready → (reviewed)`; on accept, confirmed fields are copied
into the `enrichment` JSONB and (future) graduated to a `photo_enrichment` row. **Un-ingest**
(`DELETE /api/scan/records/[chcId]`, `lib/scan-store.ts` `deleteRecord`) drops the row and its
derived JPEG; the master TIFF stays, so the photo can be re-ingested.

### `scan_prep` — the per-photo Prep (crop & deskew) state
One row per raw flatbed scan, keyed by `chc_id`, **upstream** of `scan_review`. Holds the
crop box the OpenCV engine detected (or a human hand-fixed), the engine flags, preview paths,
and the prep status. JSONB columns (`box`, `flags`) are typed via `lib/types.ts`; see
`drizzle/schema.ts` for columns and [`technical/prep-surface.md`](../technical/prep-surface.md)
for the design rationale (texture-based detection, the dropped-sky flag, etc.).

Status lifecycle: `pending → auto_ok | flagged → (fixed) → approved`. On **approve**
(`POST /api/scan/prep/[chcId]` `{action:"apply"}`, `lib/prep-engine.ts` `applyOne`), the engine
writes the lossless `scans/masters/<chc>.tif` — and **that file is the only handoff to the rest
of the pipeline**. Nothing downstream (`scan_review`, Run, Review) reads `scan_prep`; the two
domains meet only at `scans/masters/`.

### `photo_enrichment` — 1:1 enrichment record
The canonical enrichment row for a photo (ContentDM-keyed, or `chc_id` for box-scans). Full
field list in `drizzle/schema.ts`; rationale per field in
[`technical/enrichment-schema.md`](../technical/enrichment-schema.md). Today it is written only
by the scan-accept path (`lib/scan-store.ts` → `buildEnrichment`); the record-edit surface does
not yet write it. Controlled-vocab FKs (neighborhood/themes/branch) are plain text for now —
vocab tables are deferred.

## Conventions
- Timestamps `created_at` / `updated_at` (timezone-aware) on both tables.
- No geocoding in this pilot — store the confirmed address string; `lat`/`lng`/`neighborhood_tag` stay null.
- To change the schema: edit `drizzle/schema.ts` → `npm run db:generate` (review SQL) → `npm run db:push` or `db:migrate`.
