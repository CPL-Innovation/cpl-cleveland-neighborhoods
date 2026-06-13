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
| `GET /api/scan/accuracy` | Eval rollup | `AccuracyRollup` |
| `GET /api/scan/accuracy?format=csv` | Same, as CSV download | `text/csv` |
| `POST /api/scan/retry/[chcId]` | Re-run the VLM against the JPEG already in the derivative store (`maxDuration = 60`) | `{ code, record, log? }` |

Client calls go through `scanApi` (`lib/scan-api.ts`) — components never `fetch` these paths directly.

## Notes
- `POST .../records/[chcId]` deep-merges the `review` JSONB one level (a partial verdict patch preserves the rest of the review). See `lib/scan-store.ts` `upsert`.
- `retry` requires the record to already have a `jpeg_url` (derivation is a local CLI step; serverless does not derive). `lib/storage.ts` fetches the bytes back — via HTTP for a Supabase URL, or off disk for a local `/derivatives/...` path.
- Auth: none yet. When added, these routes get gated.
