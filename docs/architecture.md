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

## Design system (an external dependency now)

The staff UI's look is **not defined in this repo**. Two packages own it, both authored in the
Dateline monorepo and consumed here. They are checked out at **`../cpl-design-system/packages/*`**
— a git worktree pinned to the `design-system/cpl-tokens-and-ui` branch, so the design system has
a stable directory that doesn't move when Dateline's own feature branches switch underneath it:

| Package | What CN takes from it | Seam |
|---|---|---|
| `@cpl/tokens` | Every color, type, space, radius and shadow value. `STAFF_TOKENS` (`lib/tokens.ts`) is a *definition over* the package's static `tokens` export — same 22-odd keys out, package values in. **No color literals remain in that file.** | `lib/tokens.ts` — the one file to edit for a re-skin; never the ~900 `t.*` call sites |
| `@cpl/ui` | `HonestyBadge` — the "machine-extracted · curator-reviewable" provenance contract. Replaced CN's bespoke `VLM read` / `VLM` / `AI` / `edited` / `VLM: <value>` markers. | imported directly at call sites (`components/scan/review.tsx`, `components/scan/facet-review.tsx`, `components/staff/ui.tsx`) |

Three consequences worth knowing:

- **Bridged by `npm link`, not the registry.** Neither package is in `package.json`, so any
  `npm install` breaks both links, and linking one **prunes the other**. Always re-link as a
  pair: `npm link @cpl/tokens @cpl/ui`. (See CLAUDE.md § Gotchas.)
- **Values are static, not live.** CN reads the resolved-hex `tokens` export and loads no
  stylesheet. Runtime theme switching would be a migration to `cssVar`/`cssVarName`, not a
  config flip.
- **Status colors come in three forms** — base (dot/fill) · soft (chip background) · ink
  (anything with text). CN's bare `sage`/`ochre`/`draft` keys are the **inks**, because a
  filled control's label is what has to stay legible; `*Base` exists only for bare dots and
  decorative rules. Getting this backwards reintroduces AA failures on labeled controls.

Not everything in CN is a provenance marker: `ConfidenceBadge` and `↑ in production` keep their
own (non-info) colors deliberately — confidence and publication state are different claims from
provenance, and flattening them into the honesty palette would erase that distinction.

## Surfaces (staff app)

The staff app is one client SPA (`components/staff/app.tsx`, mounted at `app/staff/page.tsx`).
Views are switched by `NavContext` state (`components/staff/nav.tsx`), not URL routes.

- **Home / Photos / Record-edit / Stories** — the enrichment interface (`components/staff/*`). Photos/record-edit read harvested records from `public/data/tier3-all/records.json`; edits there are not yet persisted (enrichment-store write-back is future work via `photo_enrichment`).
- **Scan pipeline** (sidebar section) — the scan surfaces (`components/scan/*`); stage order Prep → Ingest → Review → Accuracy, plus Facet review and Finalize:
  - **Prep · crop & deskew** — the first stage (`components/scan/prep.tsx` + `prep-editor.tsx`): a **contact-sheet grid** that runs the OpenCV engine over `scans/raw/`, flags risky crops, lets a librarian hand-fix a box (drag/resize/rotate), and on approve writes `scans/masters/<CHC>.tif` for the rest of the pipeline. Local-only. See [`technical/prep-surface.md`](../technical/prep-surface.md).
  - **Ingest** (Surface A · `pipeline.tsx`) — a **worklist sheet** of every ingested photo (thumbnail · stage · VLM read · review verdicts), modeled on the Photos sheet: filter tabs, a health-rollup footer, itemized failures with per-photo re-attempt. Hosts the two ingest controls: **Ingest ↓** opens the **Scan inbox** (`components/scan/ingest.tsx` — browse `scans/masters/`, ingest new photos with live progress), and row selection → **Remove from pipeline** (un-ingest).
  - **Surface B · review** — the heart: zoomable image + address/year (`correct`/`edit`/`illegible`) + description (`accept`/`edit`/`reject`) + notes. Auto-saves to the API.
  - **Surface C · accuracy** — the eval rollup (illegible excluded from the denominator) + CSV export.
  - **Facet review** (`components/scan/facet-review.tsx`) — Tier 1.5 Run 2 A/B review; on approve, graduates the enforced-schema facets to `photo_enrichment` (Stage 0, validated 99). Local-only, staging-backed.
  - **Finalize** (`components/scan/finalize.tsx`) — the terminal box-scan stage (Tier-1 normalize+unify): a batch button normalizes the confirmed Tier-1 fields (caption · stamp-date · geocode) into the **unified `photo_enrichment` table** (`source = box_scan`), with a geocode-miss **pin tray** (`geo_source = staff_lookup`). A miss stores its own reason and kind (`geo_miss_reason`), so a transient OSM failure is re-attempted by the next run while a genuine no-match waits for a human; the batch also re-runs a row whose confirmed address changed in Review after normalization. Local-only. After this, box-scans surface in the staff **Photos list** (source filter: All / Box-scan / ContentDM) and on the patron map alongside ContentDM.

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

- Patron site (Leaflet map) is migrated. The **convergence slice** ("browse by what's in the picture") added the first **live enrichment→patron read** (`/api/patron/facets` → `lib/patron-facets.ts`): read-only over the 99 graduated facets (`photo_enrichment` ⋈ `scan_review`). Public-read hardening (read-only role / RLS / rate-limiting) is deferred to host-on-commit; the catalog read stays a static harvest.
- **The harvested catalog now carries a live enrichment overlay too** (`/api/patron/enrichment` → `lib/patron-enrichment.ts`): the catalog stays a static file, and the landing joins the enrichment store onto it **on the ContentDM id** in the browser. Without that join, anything staff enrich about a *cataloged* photograph is invisible to patrons — which is how a photo could have a recorded then-and-now and still show no "now". Today the overlay carries the viewpoint only; it is the slot for the rest.
- `photo_enrichment` write-back from the *record-edit* surface has **started**: the then-and-now viewpoint (`POST /api/staff/photos/[id]/rephoto` → `lib/rephoto-store.ts`) is the first real write on that screen, and the first that **upserts a ContentDM row** (identity + `rephoto_*` only — no cataloged fact is copied into a second writable home). The rest of that screen is still mockup; its other writers remain the scan-accept hook and the Tier 1.5 Stage 0 facet graduation (`lib/facet-review-store.ts`, scoped to the validated 99).
- Auth + roles (librarian-editor vs admin).
- Controlled-vocab tables (neighborhoods/themes/branches), geocoding, Tier-2 `vlmInterpret` — all flagged in the design logs.
- Cleanup of the superseded static files once the new path is verified against a live Supabase project.
