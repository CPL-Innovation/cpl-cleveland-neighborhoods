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
`drizzle/schema.ts` for columns; the working-record shape and verdict semantics are documented
in [`technical/scan-pipeline-ux.md`](../technical/scan-pipeline-ux.md) §"Per-photo working record".

Lifecycle: `discovered → derived → ready → (reviewed)`; on accept, confirmed fields are copied
into the `enrichment` JSONB and (future) graduated to a `photo_enrichment` row.

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
