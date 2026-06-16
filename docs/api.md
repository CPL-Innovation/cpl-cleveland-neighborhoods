# API

> **Reference** (current truth). Source of truth = the route handlers under
> [`app/api/scan/`](../app/api/scan/) and the client wrapper [`lib/scan-api.ts`](../lib/scan-api.ts);
> request/response shapes are the types in [`lib/types.ts`](../lib/types.ts).
>
> **Status: skeleton.** Expand with full request/response examples once the API surface
> solidifies (and when non-scan endpoints — enrichment write-back, auth — are added).

All routes run on the Node runtime, `dynamic = "force-dynamic"`, and read/write Postgres via
`lib/scan-store.ts`.

| Method · Path | Purpose | Returns |
|---|---|---|
| `GET /api/scan/records` | List all scan records | `ScanRecord[]` |
| `GET /api/scan/records/[chcId]` | One record | `ScanRecord` · 404 |
| `POST /api/scan/records/[chcId]` | Merge a review patch; `{accept:true}` also builds the enrichment payload | updated `ScanRecord` |
| `DELETE /api/scan/records/[chcId]` | **Un-ingest** — drop the row + its derived JPEG (master TIFF untouched) | `{ ok, chc_id }` · 404 |
| `GET /api/scan/masters` | **List `scans/masters/`** with new-vs-ingested status (local-only) | `{ masters: MasterEntry[], dir }` · 403 |
| `POST /api/scan/ingest/[chcId]` | **Ingest one master** (derive → store → VLM → upsert; `maxDuration = 60`, local-only). Body `{ force? }` | `IngestResult` · 403 |
| `GET /api/scan/prep` | **List `scans/raw/`** with prep state (Prep stage, local-only) | `{ raws: RawEntry[], dir }` · 403 |
| `POST /api/scan/prep/[chcId]` | **One crop-engine action** (Prep, local-only, `maxDuration = 60`). Body `{ action: "auto" \| "recrop" \| "apply", box?, thresholdMult? }` | `{ ok, record?: PrepRecord, error? }` · 403 |
| `GET /api/scan/accuracy` | Eval rollup | `AccuracyRollup` |
| `GET /api/scan/accuracy?format=csv` | Same, as CSV download | `text/csv` |
| `POST /api/scan/retry/[chcId]` | Re-run the VLM against the JPEG already in the derivative store (`maxDuration = 60`) | `{ code, record, log? }` |
| `GET /api/scan/facets` | **Tier 1.5 Run 2 facet-review worklist** — eval artifact (`data/scan/facets-run2.json`) + staged corrections + baseline captions + `graduated` flag (local-only) | `{ rows: FacetReviewRow[] }` · 403 · 404 |
| `POST /api/scan/facets/[chcId]` | **Save a staff facet correction / verdict** to the staging file; `{reviewed:true}` **graduates** the approved facets to `photo_enrichment` (Stage 0, validated 99 only), `{reviewed:false}` clears them. Never touches `scan_review` (local-only) | `FacetReviewEntry` · 403 · 400 |

Client calls go through `scanApi` (`lib/scan-api.ts`) — components never `fetch` these paths directly.

## Notes
- `POST .../records/[chcId]` deep-merges the `review` JSONB one level (a partial verdict patch preserves the rest of the review). See `lib/scan-store.ts` `upsert`.
- **`DELETE .../records/[chcId]`** (un-ingest) removes the `scan_review` row (`deleteRecord`) and the derived JPEG (`deleteDerivative`, best-effort). The master TIFF stays, so the photo reappears as `new` in the Scan inbox. Unlike ingest, delete is **not** local-only — a DB-row + storage-object delete is serverless-safe.
- **`masters` / `ingest`** are the UI-driven ingest pair, backed by the shared core in `lib/scan-ingest.ts` (same `derive → store → VLM → upsert` as the `scan:run` CLI). Both are **local-only**: `sharp` derivation never runs in serverless, so they return `403` when `process.env.VERCEL` is set. `ingest` runs one master per call so the UI can show live per-photo progress.
- `retry` requires the record to already have a `jpeg_url` (derivation is a local CLI step; serverless does not derive). `lib/storage.ts` fetches the bytes back — via HTTP for a Supabase URL, or off disk for a local `/derivatives/...` path.
- **`prep`** is the crop & deskew stage *upstream* of ingest: it reads `scans/raw/<CHC>.tif` and, on `apply`, writes `scans/masters/<CHC>.tif` (the input to `masters`/`ingest`). Backed by `lib/prep-engine.ts`, which spawns `scan/crop_engine.py` (OpenCV). **Local-only** (403 on `VERCEL`), same as `masters`/`ingest`. Shapes are `RawEntry` / `PrepRecord` in `lib/types.ts`; client wrapper is `lib/prep-api.ts`.
- Auth: none yet. When added, these routes get gated.
