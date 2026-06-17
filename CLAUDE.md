# CLAUDE.md

Project spine for both humans and Claude Code. This is a **reference** doc — present-tense
"how it works now," kept in sync with the code. For the *why/what* behind decisions, read the
design specs in the **Obsidian design vault** (`…/Second Brain/01 Develop/CPL Cleveland
Neighborhoods/build/`, entry point `build/BUILD-SPEC.md`) — these moved out of the repo's old
`technical/` folder and are now read-only design intent (the repo stays the source of truth for
*implementation*; intent changes route back via `build/_FROM-BUILD.md`).

## What this is

Cleveland Neighborhoods — an archival map of historic CPL photographs, plus a **library-facing
enrichment interface** (staff app) and a **scan-and-interpret pipeline** that ingests box-scan
TIFFs, runs one VLM read per photo (address · year · description), and lets a librarian review
the output. The eval (accuracy of the VLM vs. the handwriting on the prints) is a by-product of
that review. Upstream of all that, a **Prep** stage crops & deskews raw flatbed scans (`scans/raw/`)
into the clean `scans/masters/` the rest of the pipeline assumes. The **Scan pipeline** area
(sidebar section) runs `Prep → Ingest → Review`: Prep crops raw→masters, **Ingest** derives +
VLM-reads masters into records, Review captures verdicts (with an Accuracy eval rollup).

## Status (read this first)

- **Staff + scan surfaces: migrated** to Next.js 14 (App Router) + TypeScript. Live at `/staff`.
- **Patron site (Leaflet map, landing): migrated** to Next + TypeScript — lives at the root route `/` (`app/page.tsx` → `components/patron/`). The Leaflet map is client-only (`next/dynamic`, `ssr:false`); the photo pool is the curated demo seed merged with harvested ContentDM records (`/data/tier3-all/records.json`) in React state (the old `window.ALL_PHOTOS` global is retired). Leaflet is an npm dep now, not a CDN script. **The whole frontend is now Next** — no static `*.jsx`/`index.html` left at root.
- **Convergence slice (Tier 1.5 → patron): built.** "Browse by what's in the picture" (header → Browse) — facet filters + 2 exemplar queries (signage · streets mid-change) over the validated 99, a result grid into the existing photo-detail panel (extended with the facets + caption + an "AI-extracted (staff-reviewable)" honesty label). **First LIVE enrichment→patron read** (`/api/patron/facets` → `lib/patron-facets.ts`, read-only on the patron side); the architecture's "patron frontend is genuinely static" is retired *for enrichment only* (catalog read stays a static harvest). Local-first; public-read hardening (read-only role / RLS / rate-limit) deferred to host-on-commit.
- **Tier-1 normalize + unify (box-scan 99 → first-class photos): built.** `photo_enrichment` gained a **thin identity model** — surrogate PK `id` + `source` discriminator (`contentdm | box_scan`) + `source_id` + nullable `contentdm_id` — so box-scans and ContentDM records share one **unified Photos table**. The 99's confirmed Tier-1 strings are **normalized onto the unified row** (additive, raw kept beside): `description → patron_caption` (`caption_source`), `address → address_raw + lat/lng` (geocode; `geo_source`), `year stamp → year_raw + date_start` (`date_source = archival_stamp`, the pilot honesty valve). A new **Finalize** pipeline stage (`Prep → Ingest → Facet review → Finalize`, `components/scan/finalize.tsx` + `lib/finalize-store.ts`) runs the batch (caption copy · stamp-date parse · geocode → unified write) and hosts the **geocode-miss pin tray** (staff type coordinates → `geo_source = staff_lookup`). Geocoder is OpenStreetMap Nominatim behind a seam (`lib/geocode.ts`, `GEOCODER=none` to disable). The convergence read **collapsed to a single-table read** (`lib/patron-facets.ts` reads the normalized fields directly; scan_review join is fallback-only). Local-only; scope = the 99. **Both views now surface the unified table as one collection:** the staff **Photos list** merges the box-scans on top of the static ContentDM harvest (`/api/staff/photos` → `lib/staff-photos.ts`, adapted via `adaptBoxScanToStaff`) with a **functional Source segmented filter** (All / Box-scan / ContentDM, the first non-cosmetic filter in that bar — keys off `StaffRecord.source`), and the **patron map** plots the geocoded box-scans alongside ContentDM markers (`adaptFacetPhoto` in `components/patron/data.ts`, reading `/api/patron/facets`). Box-scans with no legible year stay in the pool but off the map (same rule as ungeocoded ContentDM).
- **Legacy prototype files removed.** The superseded staff/scan `*.jsx` and their host HTMLs (`enrichment-app.html`, `enrichment.html`, `mockup.html`), **and the patron prototype (`index.html` + `cleveland-map.jsx` + `desktop-landing.jsx`)**, were deleted once the Next tree replaced them (recoverable from git history); a few `lib/`/`components/` files still carry `// Ported from <name>.jsx` provenance comments. The legacy `scan/*.mjs` were likewise deleted; only `scan/env.mjs` remains, still loaded by the `.ts` CLIs.
- **Local-by-default in dev:** the DB is **local Postgres** (Postgres.app) and derived JPEGs live on **local disk** (`public/derivatives/`, served at `/derivatives/<chc>.jpg`). Both swap to Supabase (Postgres + Storage) by env vars alone — no code change. Supabase is the deploy target, not a dev dependency.
- **DB round-trip verified end-to-end** against local Postgres (`scan:run` → on-disk JPEG store → DB → `/staff` → `/api/scan/*`). `npm run build` (full typecheck) passes.
- **Prep (crop & deskew): built** — `/staff → Scan pipeline → Prep`. A contact-sheet grid driving an OpenCV engine (`scan/crop_engine.py`, run as a local subprocess) that turns `scans/raw/<CHC>.tif` → `scans/masters/<CHC>.tif`. Local-only like the ingest doors. Verified end-to-end on real CPL scans. Needs `python3` + `cv2`/`numpy` (see Gotchas).
- **Auth: deferred** (clean seam left).

## Stack

- Next.js 14 App Router · React 18 · TypeScript (strict) · Node 22
- Drizzle ORM + `postgres` driver → **Postgres** (local in dev · Supabase when deployed; switched by `DATABASE_URL`)
- Derived JPEG store: **local disk** (`public/derivatives/`) in dev · **Supabase Storage** when deployed — pluggable in `lib/storage.ts`
- `sharp` for TIFF→JPEG derivation (**local CLI only**, never serverless)
- Gemini (`gemini-3-flash-preview`) for the Tier 1 VLM read, behind `lib/vlm-extract.ts`
- **Tier 1.5 faceting** (sibling track to Tier 1, on trial behind a production-write firebreak):
  - *Run 1 — discovery* (`lib/vlm-facet.ts`): a one-off offline 3-way cross-check across **Gemini 3.1 Pro** (raw v1beta REST) · **Claude Opus 4.8** (`@anthropic-ai/sdk`) · **GPT-5** (`openai` SDK), each in its native structured-output mode. `scan/facet-discovery.ts` (`npm run scan:facets`).
  - *Run 2 — enforced-schema A/B* (`lib/vlm-run2.ts`): **Gemini 3.1 Pro**, the v1 LOCKED enum schema enforced via Gemini's `responseSchema` + three in-prompt guards (change-only condition, no-fabrication, confidence-honesty). `scan/facet-run2.ts` (`npm run scan:run2`) → `data/scan/facets-run2.json`.
  - *Run 2 review surface + Stage 0 production write* (`components/scan/facet-review.tsx` + `lib/facet-review-store.ts`): staff facet-review at `/staff → Scan pipeline → Facet review`. Reads the eval artifact; corrections persist to a **staging file** (`data/scan/facets-run2-review.json`). **The A/B cleared (v0.5)**, so the firebreak is lifting **scoped to Stage 0 — the validated 99 only**: approving a record (`reviewed: true`) graduates its facets into `photo_enrichment` (`facets` JSONB + `facets_reviewed_*` provenance), un-approving clears them. New-neighborhood (Stage 1) + bulk (Stage 2) remain gated. Local-only.
- **OpenCV** (`python3` + `cv2`/`numpy`) for the Prep crop/deskew engine, run as a **local subprocess** (`scan/crop_engine.py`), behind `lib/prep-engine.ts`
- **Leaflet** (npm) + CARTO Positron tiles for the patron map, used imperatively in `components/patron/cleveland-map.tsx` (client-only via `next/dynamic`)

## Setup

```bash
npm install

# ── Local dev (default): local Postgres + on-disk JPEG store ──
brew install --cask postgres-app    # then launch Postgres.app once (starts a server on :5432)
createdb cpl_neighborhoods          # one-time
cp .env.local.example .env.local    # set DATABASE_URL=postgresql://<you>@localhost:5432/cpl_neighborhoods
                                    # (leave SUPABASE_* unset → storage backend = local disk)
npm run db:migrate                  # apply drizzle/migrations → scan_review + photo_enrichment
npm run scan:run                    # derive scans/masters/ → public/derivatives/ → VLM → rows
npm run dev                         # → http://localhost:3000/staff

# ── Deploy (Supabase): same code, env-only ──
# In .env.local set DATABASE_URL to the Supabase pooled string (port 6543),
# plus SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → storage backend auto-switches to Supabase.
```

> `db:push` uses an interactive TUI prompt (reads `/dev/tty`) — prefer `db:migrate` in
> non-interactive/CLI contexts. Force a storage backend explicitly with `STORAGE_BACKEND=local|supabase`.

For the **Prep** stage: ensure `python3` has `cv2` + `numpy` (`pip install opencv-python numpy`),
drop raw flatbed scans in `scans/raw/<CHC>.tif`, then `/staff → Scan pipeline → Prep → Auto-crop`. Approve
writes `scans/masters/<CHC>.tif`, which `npm run scan:run` (or the Scan inbox) then ingests.

`.env.local`, `.env`, `raw/`, `masters/`, `derivatives/`, `public/derivatives/`, `public/prep/`, `data/scan/`, `node_modules/` are gitignored.
The scan CLI + drizzle-kit load env via `scan/env.mjs`; Next loads `.env.local` itself.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Next dev server (`/staff` is the app) |
| `npm run build` | Production build + **full TypeScript typecheck** (the gate) |
| `npm run db:generate` / `db:migrate` / `db:push` | Drizzle migrations / push schema |
| `npm run scan:run [-- --only CHC123] [-- --force]` | Local batch: derive → JPEG store → VLM → DB |
| `npm run scan:accuracy` | Print the accuracy rollup + write `data/scan/accuracy.csv` |
| `npm run scan:facets [-- --provider opus] [-- --only CHC123]` | **Tier 1.5 facet discovery** (Run 1, offline, one-off): re-read derivatives → `vlmFacet` 3-way (Gemini/Opus/GPT-5) → `data/scan/facets-discovery-{gemini,opus,gpt5}.json`. Never touches the DB/UI. |
| `npm run scan:run2 [-- --only CHC123] [-- --force]` | **Tier 1.5 Run 2 extraction** (the enforced-schema A/B, offline): re-read derivatives → `vlmRun2` (Gemini 3.1 Pro, v1 LOCKED enum schema) → `data/scan/facets-run2.json`. Resumable (skips records already in the out file). Eval artifact only — no DB/production write. |

## Layout

```
app/
  page.tsx                → renders <PatronLanding/> (patron site, root route `/`)
  staff/page.tsx          → renders <StaffApp/> (client SPA)
  api/scan/...            → records, records/[chcId], accuracy, retry/[chcId],
                            masters (list scans/masters/), ingest/[chcId] (UI-driven, local-only),
                            prep + prep/[chcId] (crop/deskew engine, local-only),
                            facets + facets/[chcId] (Tier 1.5 Run 2 review: reads eval artifact +
                            staging; on approve graduates facets → photo_enrichment, Stage 0 / 99 only),
                            finalize + finalize/[chcId] (Finalize stage, local-only: GET worklist,
                            POST batch-normalize → unified photo_enrichment, POST [chcId] = staff pin)
  api/patron/facets       → convergence slice: LIVE read-only read of the 99 graduated facets
                            (single-table read of the unified photo_enrichment), "browse by what's in
                            the picture" + the box-scan markers merged onto the patron map
  api/staff/photos        → unified box-scan rows for the staff Photos list (read-only; [] if DB down)
  layout.tsx, globals.css
components/
  patron/                 → landing (DesktopLanding + map overlays), cleveland-map (Leaflet,
                            dynamic/ssr:false), panels (search · photo-detail+facets · story-trail),
                            browse-by-picture (convergence slice — facet filters → grid → detail),
                            data (curated seed + projection + harvest adapt), patron.css
  staff/                  → nav (NavContext), ui (shared primitives), shell, app (router),
                            home, photos-list, record-edit, story-author
  scan/                   → prep (Prep contact-sheet grid) + prep-editor + prep-flags,
                            pipeline (Ingest surface: worklist sheet + scan-inbox modal), review (B),
                            accuracy (C), ingest (Scan-inbox modal),
                            facet-review (Tier 1.5 Run 2 A/B review surface — local-only, staging),
                            finalize (Finalize stage — normalize+unify the 99: batch + geocode-miss pin tray)
lib/                      → db, scan-store, accuracy, vlm-extract, storage, scan-api,
                            scan-ingest (shared derive→store→VLM→DB core),
                            vlm-facet (Tier 1.5 Run 1 discovery — 3-way sibling to vlm-extract),
                            vlm-run2 (Tier 1.5 Run 2 — Gemini enforced-enum extraction) +
                            facet-review-store (Run 2 review staging + Stage 0 graduation → photo_enrichment),
                            patron-facets (convergence slice — live read-only read of the 99),
                            finalize-store (Tier-1 normalize+unify: confirmed Tier-1 → unified photo_enrichment) +
                            geocode (address→coords seam — OSM Nominatim, GEOCODER=none to disable),
                            staff-photos (box-scan rows for the staff Photos list — /api/staff/photos),
                            prep-engine (drives crop_engine.py) + prep-store + prep-api,
                            tokens, types, normalize-address
drizzle/                  → schema.ts (source of truth for the DB), migrations/
scan/                     → run.ts / derive.ts / accuracy.ts (tsx CLI) + env.mjs +
                            facet-discovery.ts (Tier 1.5 Run 1 discovery CLI, offline) +
                            facet-run2.ts (Tier 1.5 Run 2 enforced extraction CLI, offline) +
                            crop_engine.py (OpenCV crop/deskew, subprocess)
harvest/                  → ContentDM harvest pipeline (Tier 1→2→3, unchanged)
data/ , public/data/      → harvested ContentDM JSON (read-only; patron + staff read this)
docs/                     → reference docs (current truth — this file's siblings)
                            (design specs live OUTSIDE the repo — in the Obsidian build/ vault)
scans/                    → local-only inputs (gitignored, never web-served):
  raw/                    →   raw flatbed scans, Prep input
  masters/                →   box-scan TIFFs: Prep output + Run input
public/derivatives/       → derived JPEGs, local storage backend (gitignored; served at /derivatives/*)
public/prep/              → Prep preview JPEGs (gitignored; served at /prep/*)
```

## Conventions

- **TypeScript strict.** No implicit any. Inline style objects that trip literal-union checks get `as React.CSSProperties`.
- **Styling is inline CSS-in-JS** via `STAFF_TOKENS` (`lib/tokens.ts`). No stylesheets except `app/globals.css` (reset + fonts + one keyframe).
- **Staff app is a client SPA** at `/staff` — navigation is React state via `NavContext`/`useNav` (`components/staff/nav.tsx`), **not** file-based routes. (Adopting file routing/RSC is a possible later refactor.)
- **Shared UI primitives** (`pillBtn`, `Kbd`, `Field`, `FieldGroup`, `FieldFoot`, `inputStyle`, `textareaStyle`, `selectStyle`, `ChipInput`) live in `components/staff/ui.tsx` — import, don't redefine.
- **`scanApi`** (client fetch wrapper) lives in `lib/scan-api.ts`; the old `window`-global pattern is retired.
- **Derivation is a local job.** `sharp` reads local TIFFs; serverless never derives. Both ingest doors — the `scan:run` CLI and the in-app **Scan inbox** (`/api/scan/masters` + `/api/scan/ingest`) — share one core (`lib/scan-ingest.ts`) and are **local-only** (the routes 403 on `VERCEL`). Per-photo serverless `retry` only re-runs the VLM against the JPEG already in the store. **Un-ingest** (`DELETE /api/scan/records/[chcId]`) drops the row + derivative (master TIFF stays) and *is* serverless-safe. The store writes the JPEG **once** — `lib/storage.ts` owns the file (local disk or Supabase).
- **Prep (crop/deskew) is a local job too**, same shape: `lib/prep-engine.ts` spawns `python3 scan/crop_engine.py` against a local TIFF; its routes (`/api/scan/prep`, `/api/scan/prep/[chcId]`) gate on `prepEnabled()` and 403 on `VERCEL`. The engine is **texture-based, not brightness** (grainy emulsion vs. smooth paper) — see `build/digitization/tooling/crop-deskew-spec.md` (Obsidian design vault). Prep's **only** handoff to the Ingest stage is the `scans/masters/<CHC>.tif` it writes; don't make Ingest/Review depend on `scan_prep`. State lives in the `scan_prep` table (`pending|auto_ok|flagged|fixed|approved`).
- **One source of truth per fact**: DB shape = `drizzle/schema.ts`; shared types = `lib/types.ts`. Docs link to these, don't duplicate them.

## Gotchas

- Gemini model id is **`gemini-3-flash-preview`** — bare `gemini-3-flash` 404s on v1beta. Override with `GEMINI_MODEL`. Without `GEMINI_API_KEY`, `vlmExtract` returns a **stub** so the pipeline runs keyless.
- DB backend is **`DATABASE_URL`-only**: local Postgres (Postgres.app, `postgresql://<you>@localhost:5432/cpl_neighborhoods`) in dev; Supabase **transaction pooler** string (port 6543) when deployed. `lib/db.ts` sets `prepare: false` (required by the pooler, harmless locally) and is **lazy** (no connection at import/build). Postgres.app must be running for the local DB to be reachable.
- Storage backend is auto-selected in `lib/storage.ts`: **local disk** (`public/derivatives/`) unless `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; force either way with `STORAGE_BACKEND=local|supabase`. `fetchDerivativeBytes` reads relative `/derivatives/...` paths off disk and absolute URLs over HTTP.
- The patron map uses **Leaflet** (npm dep) imperatively inside `components/patron/cleveland-map.tsx`, loaded via `next/dynamic({ssr:false})` so Leaflet never runs on the server. Its CSS (`leaflet/dist/leaflet.css` + `components/patron/patron.css`) is imported there. The `.cm-*` / `.leaflet-*` styles are global (Leaflet injects DOM outside React) but namespaced, so they don't touch the staff UI.
- **Prep needs `python3` with `cv2` + `numpy`** on PATH (override the interpreter with `PREP_PYTHON`, the input folder with `SCAN_RAW_DIR`). `tifffile` is **not** required and is in fact binary-incompatible with NumPy 2.x here — the engine uses cv2's libtiff + Pillow for 16-bit/grayscale/LZW masters. `minAreaRect` returns angles in `[0,90)` on OpenCV ≥4.5, so the engine folds them into `(-45,45]`. The crop box is in **raw full-res pixels** `{cx,cy,w,h,angle}`; the editor maps to screen with one uniform scale.

## Documentation map

- **References (current truth — keep synced; in-repo):** this file · [`docs/architecture.md`](docs/architecture.md) · [`docs/data-model.md`](docs/data-model.md) · [`docs/api.md`](docs/api.md) · co-located [`scan/README.md`](scan/README.md), [`harvest/README.md`](harvest/README.md)
- **Design specs (the why/what — in the Obsidian vault, *not* the repo):** entry point `build/BUILD-SPEC.md` — e.g. `build/enrichment-app/scan-pipeline-ux.md`, `build/enrichment-app/vlm-description-spec.md`, `build/data-backend/enrichment-schema.md`, `build/data-backend/data-architecture.md`, `build/digitization/tooling/crop-deskew-spec.md`. Intent changes route back via `build/_FROM-BUILD.md`.
