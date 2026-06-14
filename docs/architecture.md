# Architecture

> **Reference** (current truth — update in the same change that alters behavior). For *why*
> decisions were made, see the dated logs in [`technical/`](../technical/).
> Last reflects: the Next.js + Supabase migration of the staff/scan slice, with
> **local-by-default** dev backends (local Postgres + on-disk JPEG store).

## System at a glance

```
                         ┌──────────────────────────────────────────────┐
  Patron (later pass)    │  STATIC PROTOTYPE  (not yet migrated)          │
  index.html + *.jsx ────┤  CDN React + Babel-in-browser, Leaflet map     │
                         │  reads data/tier3-all/records.json             │
                         └──────────────────────────────────────────────┘

                         ┌──────────────────────────────────────────────┐
  Staff + scan (live)    │  NEXT.JS 14 (App Router, TypeScript)           │
                         │                                                │
  /staff  ───────────────┤  client SPA: <StaffApp/> (NavContext router)   │
                         │   components/staff/* + components/scan/*        │
                         │                                                │
  /api/scan/* ───────────┤  route handlers (Node runtime) ───────────────┼──► Postgres¹
                         │   records · records/[chcId] (GET/POST/DELETE)  │     scan_review
                         │   accuracy · retry · masters · ingest/[chcId]³ │     photo_enrichment
                         │  lib/ (db, scan-store, accuracy, vlm-extract,  │
                         │   storage, scan-api, scan-ingest, tokens, types)──► JPEG store²
                         └──────────────────────────────────────────────┘     derivatives/*.jpg
                                                                                    ▲
  LOCAL CLI / UI inbox   ┌──────────────────────────────────────────────┐         │
  scan:run · Ingest ↓ ───┤  lib/scan-ingest.ts: for each scans/masters/*.tif│        │
                         │   sharp derive → upload JPEG ──────────────────┼─────────┘
                         │   → vlmExtract (Gemini) → upsert scan_review    │──► Postgres¹
                         └──────────────────────────────────────────────┘
```

> ¹ **Postgres** — local Postgres (Postgres.app) in dev, Supabase Postgres when deployed.
>   Selected purely by `DATABASE_URL`; `lib/db.ts` is backend-agnostic.
> ² **JPEG store** — `lib/storage.ts` picks a backend: local disk (`public/derivatives/`,
>   served by Next at `/derivatives/<chc>.jpg`) by default, or Supabase Storage when
>   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are set. Force with `STORAGE_BACKEND=local|supabase`.
> ³ **`masters` / `ingest`** — the UI-driven ingest pair (the in-app **Scan inbox**), backed by
>   the same `lib/scan-ingest.ts` core as the CLI. **Local-only** (they derive with `sharp`): the
>   routes return `403` in a serverless deploy. `DELETE records/[chcId]` is the **un-ingest** —
>   drops the row + derivative; it *is* serverless-safe.

## What runs where (the load-bearing boundary)

| Concern | Where it runs | Why |
|---|---|---|
| TIFF→JPEG derivation (`sharp`) | **Local only** — the `scan:run` CLI *and* the in-app Scan inbox (`/api/scan/ingest`, gated to non-serverless) | Reads local `scans/masters/*.tif`; `sharp` + large TIFFs don't belong on serverless. Sidesteps the whole serverless-image problem. |
| Crop & deskew (Prep, OpenCV) | **Local only** — `lib/prep-engine.ts` spawns `scan/crop_engine.py` (`/api/scan/prep*`, gated to non-serverless) | Reads `scans/raw/*.tif`, writes `scans/masters/*.tif`; CV + large TIFFs are a local job, same boundary as `sharp`. |
| VLM read (Gemini) | Local CLI (batch) **and** serverless `retry` | Batch reads bytes from `sharp`; `retry` fetches the stored JPEG back from the store and re-runs — no filesystem needed. |
| Review reads/writes | API routes → Postgres (local in dev, Supabase deployed) | Durable per-photo review; the "scan_review table" is now real. |
| Derived image hosting | Pluggable (`lib/storage.ts`): local disk `public/derivatives/` in dev · Supabase Storage when deployed | The store writes the JPEG **once**; `scan_review.jpeg_path`/`jpeg_url` is what the UI `<img>` loads (relative `/derivatives/<chc>.jpg` locally, public URL on Supabase). |
| Harvested ContentDM data | Static JSON (`public/data/tier3-all/records.json`) | Read-only; not in the DB for this slice. |

## Surfaces (staff app)

The staff app is one client SPA (`components/staff/app.tsx`, mounted at `app/staff/page.tsx`).
Views are switched by `NavContext` state (`components/staff/nav.tsx`), not URL routes.

- **Home / Photos / Record-edit / Stories** — the enrichment interface (`components/staff/*`). Photos/record-edit read harvested records from `public/data/tier3-all/records.json`; edits there are not yet persisted (enrichment-store write-back is future work via `photo_enrichment`).
- **Ingest → Prep / Scan pipeline** — the scan surfaces (`components/scan/*`):
  - **Prep · crop & deskew** — the first stage (`components/scan/prep.tsx` + `prep-editor.tsx`): a **contact-sheet grid** that runs the OpenCV engine over `scans/raw/`, flags risky crops, lets a librarian hand-fix a box (drag/resize/rotate), and on approve writes `scans/masters/<CHC>.tif` for the rest of the pipeline. Local-only. See [`technical/prep-surface.md`](../technical/prep-surface.md).
  - **Surface A · pipeline** — a **worklist sheet** of every ingested photo (thumbnail · stage · VLM read · review verdicts), modeled on the Photos sheet: filter tabs, a health-rollup footer, itemized failures with per-photo re-attempt. Hosts the two ingest controls: **Ingest ↓** opens the **Scan inbox** (`components/scan/ingest.tsx` — browse `scans/masters/`, ingest new photos with live progress), and row selection → **Remove from pipeline** (un-ingest).
  - **Surface B · review** — the heart: zoomable image + address/year (`correct`/`edit`/`illegible`) + description (`accept`/`edit`/`reject`) + notes. Auto-saves to the API.
  - **Surface C · accuracy** — the eval rollup (illegible excluded from the denominator) + CSV export.

Shared chrome in `components/staff/shell.tsx`; shared primitives in `components/staff/ui.tsx`.

## Ingestion pipelines (two doors)

1. **ContentDM harvest** (`harvest/`, unchanged) — Tier 1 (live ContentDM) → Tier 2 (full JSONL) → Tier 3 (lean `records.json`). Read-only catalog mirror. See [`harvest/README.md`](../harvest/README.md).
2. **Box-scan pipeline** (`scan/` + `lib/scan-ingest.ts`) — net-new digitizations that aren't in ContentDM. Two doors into the same `derive → store → VLM → upsert scan_review` core: the local **`scan:run`** CLI, or the in-app **Scan inbox** (`/api/scan/masters` + `/api/scan/ingest`, both local-only). Un-ingest removes a row + derivative. On review-accept, confirmed fields graduate into the `enrichment` payload. See [`scan/README.md`](../scan/README.md) and the design log [`technical/scan-pipeline-ux.md`](../technical/scan-pipeline-ux.md).

## Backend

- **Data store:** plain Postgres via Drizzle — **local Postgres in dev**, Supabase Postgres when deployed. Switched by `DATABASE_URL` alone. Schema is the source of truth: [`drizzle/schema.ts`](../drizzle/schema.ts) (`scan_review`, `photo_enrichment`). See [`data-model.md`](data-model.md).
- **DB access:** `lib/db.ts` — lazy, backend-agnostic Drizzle client. `prepare: false` (required by the Supabase transaction pooler; harmless against local Postgres).
- **Store layer:** `lib/scan-store.ts` (read-modify-write, deep-merges the `review` JSONB; `buildEnrichment` builds the `photo_enrichment`-shaped accept payload — no geocoding in this pilot).
- **API:** `app/api/scan/*` — see [`api.md`](api.md).
- **Auth:** none yet (deferred). When added, it gates the staff routes; the SPA shell is the natural seam. Supabase Auth is the likely fit.

## Deploy target

Vercel (App Router + serverless functions) + Supabase (DB + Storage). The local `scan:run`
batch runs on an operator's machine, not Vercel. Env vars go in the Vercel dashboard; see
`.env.local.example` for the full list. Not yet deployed.

## Known gaps / future passes

- Patron site (Leaflet map) migration into the Next app.
- `photo_enrichment` write-back from the *record-edit* surface (today only the scan-accept path writes it).
- Auth + roles (librarian-editor vs admin).
- Controlled-vocab tables (neighborhoods/themes/branches), geocoding, Tier-2 `vlmInterpret` — all flagged in the design logs.
- Cleanup of the superseded static files once the new path is verified against a live Supabase project.
