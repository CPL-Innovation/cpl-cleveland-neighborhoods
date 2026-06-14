# CLAUDE.md

Project spine for both humans and Claude Code. This is a **reference** doc — present-tense
"how it works now," kept in sync with the code. For the *why* behind decisions, read the
dated design logs in [`technical/`](technical/).

## What this is

Cleveland Neighborhoods — an archival map of historic CPL photographs, plus a **library-facing
enrichment interface** (staff app) and a **scan-and-interpret pipeline** that ingests box-scan
TIFFs, runs one VLM read per photo (address · year · description), and lets a librarian review
the output. The eval (accuracy of the VLM vs. the handwriting on the prints) is a by-product of
that review. Upstream of all that, a **Prep** stage crops & deskews raw flatbed scans (`scans/raw/`)
into the clean `scans/masters/` the rest of the pipeline assumes: `Ingest → Prep → Scan pipeline →
Run → Review`.

## Status (read this first)

- **Staff + scan surfaces: migrated** to Next.js 14 (App Router) + TypeScript. Live at `/staff`.
- **Patron site (Leaflet map, landing): NOT migrated** — still the static prototype: root `index.html` + `cleveland-map.jsx` + `desktop-landing.jsx` (CDN React/Babel, no build step; `index.html` loads the two `.jsx` with `?v=` cache-busts). A later pass. These three are the **only** non-Next frontend files left at root.
- **Legacy prototype files removed.** The superseded staff/scan `*.jsx` and their host HTMLs (`enrichment-app.html`, `enrichment.html`, `mockup.html`) were deleted once the Next tree replaced them (recoverable from git history); a few `lib/`/`components/` files still carry `// Ported from <name>.jsx` provenance comments. The legacy `scan/*.mjs` were likewise deleted; only `scan/env.mjs` remains, still loaded by the `.ts` CLIs.
- **Local-by-default in dev:** the DB is **local Postgres** (Postgres.app) and derived JPEGs live on **local disk** (`public/derivatives/`, served at `/derivatives/<chc>.jpg`). Both swap to Supabase (Postgres + Storage) by env vars alone — no code change. Supabase is the deploy target, not a dev dependency.
- **DB round-trip verified end-to-end** against local Postgres (`scan:run` → on-disk JPEG store → DB → `/staff` → `/api/scan/*`). `npm run build` (full typecheck) passes.
- **Prep (crop & deskew): built** — `/staff → Ingest → Prep`. A contact-sheet grid driving an OpenCV engine (`scan/crop_engine.py`, run as a local subprocess) that turns `scans/raw/<CHC>.tif` → `scans/masters/<CHC>.tif`. Local-only like the ingest doors. Verified end-to-end on real CPL scans. Needs `python3` + `cv2`/`numpy` (see Gotchas).
- **Auth: deferred** (clean seam left).

## Stack

- Next.js 14 App Router · React 18 · TypeScript (strict) · Node 22
- Drizzle ORM + `postgres` driver → **Postgres** (local in dev · Supabase when deployed; switched by `DATABASE_URL`)
- Derived JPEG store: **local disk** (`public/derivatives/`) in dev · **Supabase Storage** when deployed — pluggable in `lib/storage.ts`
- `sharp` for TIFF→JPEG derivation (**local CLI only**, never serverless)
- Gemini (`gemini-3-flash-preview`) for the VLM read, behind `lib/vlm-extract.ts`
- **OpenCV** (`python3` + `cv2`/`numpy`) for the Prep crop/deskew engine, run as a **local subprocess** (`scan/crop_engine.py`), behind `lib/prep-engine.ts`

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
drop raw flatbed scans in `scans/raw/<CHC>.tif`, then `/staff → Ingest → Prep → Auto-crop`. Approve
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
  staff/page.tsx          → renders <StaffApp/> (client SPA)
  api/scan/...            → records, records/[chcId], accuracy, retry/[chcId],
                            masters (list scans/masters/), ingest/[chcId] (UI-driven, local-only),
                            prep + prep/[chcId] (crop/deskew engine, local-only)
  layout.tsx, page.tsx, globals.css
components/
  staff/                  → nav (NavContext), ui (shared primitives), shell, app (router),
                            home, photos-list, record-edit, story-author
  scan/                   → prep (Prep contact-sheet grid) + prep-editor + prep-flags,
                            pipeline (Surface A: worklist sheet + ingest modal), review (B),
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
technical/                → design LOGS (the why; append-only journal)
docs/                     → reference docs (current truth — this file's siblings)
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
- **Prep (crop/deskew) is a local job too**, same shape: `lib/prep-engine.ts` spawns `python3 scan/crop_engine.py` against a local TIFF; its routes (`/api/scan/prep`, `/api/scan/prep/[chcId]`) gate on `prepEnabled()` and 403 on `VERCEL`. The engine is **texture-based, not brightness** (grainy emulsion vs. smooth paper) — see [`technical/prep-surface.md`](technical/prep-surface.md). Prep's **only** handoff to Run is the `scans/masters/<CHC>.tif` it writes; don't make Run/Review depend on `scan_prep`. State lives in the `scan_prep` table (`pending|auto_ok|flagged|fixed|approved`).
- **One source of truth per fact**: DB shape = `drizzle/schema.ts`; shared types = `lib/types.ts`. Docs link to these, don't duplicate them.

## Gotchas

- Gemini model id is **`gemini-3-flash-preview`** — bare `gemini-3-flash` 404s on v1beta. Override with `GEMINI_MODEL`. Without `GEMINI_API_KEY`, `vlmExtract` returns a **stub** so the pipeline runs keyless.
- DB backend is **`DATABASE_URL`-only**: local Postgres (Postgres.app, `postgresql://<you>@localhost:5432/cpl_neighborhoods`) in dev; Supabase **transaction pooler** string (port 6543) when deployed. `lib/db.ts` sets `prepare: false` (required by the pooler, harmless locally) and is **lazy** (no connection at import/build). Postgres.app must be running for the local DB to be reachable.
- Storage backend is auto-selected in `lib/storage.ts`: **local disk** (`public/derivatives/`) unless `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; force either way with `STORAGE_BACKEND=local|supabase`. `fetchDerivativeBytes` reads relative `/derivatives/...` paths off disk and absolute URLs over HTTP.
- The patron static site and the Next app currently **coexist**; don't assume a file is dead just because it's a root `*.jsx` — confirm against the Next import tree first.
- **Prep needs `python3` with `cv2` + `numpy`** on PATH (override the interpreter with `PREP_PYTHON`, the input folder with `SCAN_RAW_DIR`). `tifffile` is **not** required and is in fact binary-incompatible with NumPy 2.x here — the engine uses cv2's libtiff + Pillow for 16-bit/grayscale/LZW masters. `minAreaRect` returns angles in `[0,90)` on OpenCV ≥4.5, so the engine folds them into `(-45,45]`. The crop box is in **raw full-res pixels** `{cx,cy,w,h,angle}`; the editor maps to screen with one uniform scale.

## Documentation map

- **References (current truth — keep synced):** this file · [`docs/architecture.md`](docs/architecture.md) · [`docs/data-model.md`](docs/data-model.md) · [`docs/api.md`](docs/api.md) · co-located [`scan/README.md`](scan/README.md), [`harvest/README.md`](harvest/README.md)
- **Logs (the why — append-only journal):** [`technical/`](technical/) — e.g. `prep-surface.md`, `scan-pipeline-ux.md`, `vlm-description-spec.md`, `enrichment-schema.md`, `data-architecture.md`
