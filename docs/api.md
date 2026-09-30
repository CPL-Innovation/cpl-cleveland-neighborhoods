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
| `GET /api/scan/finalize` | **Finalize worklist** — reviewed box-scans + their normalize/pin state (Tier-1 normalize+unify, local-only) | `{ rows: FinalizeRow[], counts }` · 403 · 500 |
| `POST /api/scan/finalize` | **Run the batch** — normalize the pending reviewed set into the unified `photo_enrichment` (caption copy · stamp-date parse · geocode); resumable (local-only). Also **re-geocodes stalled rows**: ones a provider failure left coordinate-less, and ones whose confirmed Tier-1 address changed in Review after normalization (`retried` in the result counts them) | `FinalizeRunResult` · 403 · 500 |
| `POST /api/scan/finalize/[chcId]` | **Staff pin** on a geocode miss (`{ lat, lng }` → `geo_source = staff_lookup`) **or** the then-and-now viewpoint (`{ rephotoEmbedUrl }`, `""` clears); local-only | `{ ok, chc_id, lat, lng }` / `{ ok, chc_id, cleared, bearing }` · 403 · 400 |
| `GET /api/patron/facets` | **Convergence slice** — LIVE read-only read of the 99 graduated facets (single-table read of the unified `photo_enrichment`; normalized caption/year/address/coords, falling back to `scan_review` only pre-Finalize) for "browse by what's in the picture" **and** the box-scan markers on the patron map. Patron surface never writes; public-read hardening deferred to host-on-commit (`lib/patron-facets.ts`) | `{ photos: FacetPhoto[] }` · 500 |
| `GET /api/staff/photos` | The **live half** of the staff Photos list (read-only; returns empty arrays rather than erroring if the DB is down): the unified box-scan rows, plus a **ContentDM geo overlay** the client joins onto the static harvest by id — without it a coordinate just looked up on Record Edit leaves the GEO column still reading "missing" | `{ photos: BoxScanStaffPhoto[], geo: ContentdmGeoOverlay[] }` |
| `GET /api/patron/enrichment` | **Enrichment overlay for harvested ContentDM photos** — LIVE read-only read of `photo_enrichment` (`source = contentdm`), joined client-side on the ContentDM id onto the static catalog harvest. Today: the then-and-now viewpoint. Returns `{ photos: [] }` rather than erroring if the DB is down (`lib/patron-enrichment.ts`) | `{ photos: PatronEnrichment[] }` |
| `GET /api/staff/photos/[id]/rephoto` | The then-and-now viewpoint recorded for one photo in the unified table (`null` when the photo has no enrichment row yet) | `{ rephoto: RephotoRow \| null }` |
| `GET /api/staff/photos/[id]/geo` | The coordinate recorded for one photo in the unified table (`null` when it has no enrichment row yet) | `{ geo: GeoRow \| null }` |
| `POST /api/staff/photos/[id]/geo` | Three actions on one route. `{ action: "suggest", address }` geocodes and **writes nothing** — the librarian decides; a string with no house number is looked up as a named place and can only come back `inferred`. `{ action: "accept", lat, lng, addressRaw, geoSource, geoConfidence, source, contentdmUrl? }` commits it (ContentDM **upserts** — enrichment only, the catalog stays a static harvest). `{ action: "clear" }` retracts it. Local-only until staff auth lands | `{ suggestion: GeoResult }` / `{ ok, id, cleared }` · 403 · 400 |
| `POST /api/staff/photos/[id]/rephoto` | **Record the viewpoint** from the Record Edit screen. Body `{ rephotoEmbedUrl, source, contentdmUrl? }`; `""` clears. `source: "contentdm"` **upserts** the enrichment row (the catalog is a static harvest — the row is enrichment only); `source: "box_scan"` updates an already-finalized row. Local-only until staff auth lands | `{ ok, id, cleared, bearing }` · 403 · 400 |

Scan-pipeline client calls go through `scanApi` (`lib/scan-api.ts`) and the unified-Photos ones through `staffApi` (`lib/staff-api.ts`); the patron surfaces fetch `/api/patron/facets` + `/api/patron/enrichment` directly (the patron app uses neither wrapper), and the staff Photos list fetches `/api/staff/photos` directly.

## Notes
- `POST .../records/[chcId]` deep-merges the `review` JSONB one level (a partial verdict patch preserves the rest of the review). See `lib/scan-store.ts` `upsert`.
- **`DELETE .../records/[chcId]`** (un-ingest) removes the `scan_review` row (`deleteRecord`) and the derived JPEG (`deleteDerivative`, best-effort). The master TIFF stays, so the photo reappears as `new` in the Scan inbox. Unlike ingest, delete is **not** local-only — a DB-row + storage-object delete is serverless-safe.
- **`masters` / `ingest`** are the UI-driven ingest pair, backed by the shared core in `lib/scan-ingest.ts` (same `derive → store → VLM → upsert` as the `scan:run` CLI). Both are **local-only**: `sharp` derivation never runs in serverless, so they return `403` when `process.env.VERCEL` is set. `ingest` runs one master per call so the UI can show live per-photo progress.
- `retry` requires the record to already have a `jpeg_url` (derivation is a local CLI step; serverless does not derive). `lib/storage.ts` fetches the bytes back — via HTTP for a Supabase URL, or off disk for a local `/derivatives/...` path.
- **`prep`** is the crop & deskew stage *upstream* of ingest: it reads `scans/raw/<CHC>.tif` and, on `apply`, writes `scans/masters/<CHC>.tif` (the input to `masters`/`ingest`). Backed by `lib/prep-engine.ts`, which spawns `scan/crop_engine.py` (OpenCV). **Local-only** (403 on `VERCEL`), same as `masters`/`ingest`. Shapes are `RawEntry` / `PrepRecord` in `lib/types.ts`; client wrapper is `lib/prep-api.ts`.
- Auth: none yet. When added, these routes get gated.
