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
- Gemini (`gemini-3-flash-preview`) for the VLM read, behind `lib/vlm-extract.ts`
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

## Layout

```
app/
  page.tsx                → renders <PatronLanding/> (patron site, root route `/`)
  staff/page.tsx          → renders <StaffApp/> (client SPA)
  api/scan/...            → records, records/[chcId], accuracy, retry/[chcId],
                            masters (list scans/masters/), ingest/[chcId] (UI-driven, local-only),
                            prep + prep/[chcId] (crop/deskew engine, local-only)
  layout.tsx, globals.css
components/
  patron/                 → landing (DesktopLanding + map overlays), cleveland-map (Leaflet,
                            dynamic/ssr:false), panels (search · photo-detail · story-trail),
                            data (curated seed + projection + harvest adapt), patron.css
  staff/                  → nav (NavContext), ui (shared primitives), shell, app (router),
                            home, photos-list, record-edit, story-author
  scan/                   → prep (Prep contact-sheet grid) + prep-editor + prep-flags,
                            pipeline (Ingest surface: worklist sheet + scan-inbox modal), review (B),
                            accuracy (C), ingest (Scan-inbox modal)
lib/                      → db, scan-store, accuracy, vlm-extract, storage, scan-api,
                            scan-ingest (shared derive→store→VLM→DB core),
                            prep-engine (drives crop_engine.py) + prep-store + prep-api,
                            tokens, types, normalize-address
drizzle/                  → schema.ts (source of truth for the DB), migrations/
scan/                     → run.ts / derive.ts / accuracy.ts (tsx CLI) + env.mjs +
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
