# CLAUDE.md

Project spine for both humans and Claude Code. This is a **reference** doc — present-tense
"how it works now," kept in sync with the code. For the *why* behind decisions, read the
dated design logs in [`technical/`](technical/).

## What this is

Cleveland Neighborhoods — an archival map of historic CPL photographs, plus a **library-facing
enrichment interface** (staff app) and a **scan-and-interpret pipeline** that ingests box-scan
TIFFs, runs one VLM read per photo (address · year · description), and lets a librarian review
the output. The eval (accuracy of the VLM vs. the handwriting on the prints) is a by-product of
that review.

## Status (read this first)

- **Staff + scan surfaces: migrated** to Next.js 14 (App Router) + TypeScript + Supabase. Live at `/staff`.
- **Patron site (Leaflet map, landing): NOT migrated** — still the static prototype (`index.html` + root `*.jsx` via CDN React/Babel). A later pass.
- **Superseded but still on disk** (inert, cleanup pending): root `*.jsx`, `enrichment-app.html`, `scan/server.mjs`, `scan/store.mjs`, the old `scan/*.mjs`. The Next tree does not import them.
- **DB round-trip not yet verified end-to-end** — needs Supabase creds in `.env.local` (see Setup). `npm run build` (full typecheck) and the `/staff` dev render both pass.
- **Auth: deferred** (clean seam left).

## Stack

- Next.js 14 App Router · React 18 · TypeScript (strict) · Node 22
- Drizzle ORM + `postgres` driver → **Supabase Postgres**
- Supabase **Storage** for derived JPEGs
- `sharp` for TIFF→JPEG derivation (**local CLI only**, never serverless)
- Gemini (`gemini-3-flash-preview`) for the VLM read, behind `lib/vlm-extract.ts`

## Setup

```bash
npm install
cp .env.local.example .env.local     # fill DATABASE_URL (Supabase pooled/6543), SUPABASE_URL,
                                      # SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
npm run db:push                       # create scan_review + photo_enrichment tables
npm run scan:run                      # derive masters/ → upload JPEGs → VLM → rows
npm run dev                           # → http://localhost:3000/staff
```

`.env.local`, `.env`, `masters/`, `derivatives/`, `data/scan/`, `node_modules/` are gitignored.
The scan CLI + drizzle-kit load env via `scan/env.mjs`; Next loads `.env.local` itself.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Next dev server (`/staff` is the app) |
| `npm run build` | Production build + **full TypeScript typecheck** (the gate) |
| `npm run db:generate` / `db:migrate` / `db:push` | Drizzle migrations / push schema |
| `npm run scan:run [-- --only CHC123] [-- --force]` | Local batch: derive → Storage → VLM → DB |
| `npm run scan:accuracy` | Print the accuracy rollup + write `data/scan/accuracy.csv` |

## Layout

```
app/
  staff/page.tsx          → renders <StaffApp/> (client SPA)
  api/scan/...            → records, records/[chcId], accuracy, retry/[chcId]
  layout.tsx, page.tsx, globals.css
components/
  staff/                  → nav (NavContext), ui (shared primitives), shell, app (router),
                            home, photos-list, record-edit, story-author
  scan/                   → pipeline (Surface A + scanApi consumers), review (B), accuracy (C)
lib/                      → db, scan-store, accuracy, vlm-extract, storage, scan-api,
                            tokens, types, normalize-address
drizzle/                  → schema.ts (source of truth for the DB), migrations/
scan/                     → run.ts / derive.ts / accuracy.ts (tsx CLI) + env.mjs
                            (legacy *.mjs superseded)
harvest/                  → ContentDM harvest pipeline (Tier 1→2→3, unchanged)
data/ , public/data/      → harvested ContentDM JSON (read-only; patron + staff read this)
technical/                → design LOGS (the why; append-only journal)
docs/                     → reference docs (current truth — this file's siblings)
masters/ , derivatives/   → local box-scan TIFFs + derived JPEGs (gitignored)
```

## Conventions

- **TypeScript strict.** No implicit any. Inline style objects that trip literal-union checks get `as React.CSSProperties`.
- **Styling is inline CSS-in-JS** via `STAFF_TOKENS` (`lib/tokens.ts`). No stylesheets except `app/globals.css` (reset + fonts + one keyframe).
- **Staff app is a client SPA** at `/staff` — navigation is React state via `NavContext`/`useNav` (`components/staff/nav.tsx`), **not** file-based routes. (Adopting file routing/RSC is a possible later refactor.)
- **Shared UI primitives** (`pillBtn`, `Kbd`, `Field`, `FieldGroup`, `FieldFoot`, `inputStyle`, `textareaStyle`, `selectStyle`, `ChipInput`) live in `components/staff/ui.tsx` — import, don't redefine.
- **`scanApi`** (client fetch wrapper) lives in `lib/scan-api.ts`; the old `window`-global pattern is retired.
- **Derivation is a local job.** `sharp` reads local TIFFs; serverless never derives. Per-photo serverless `retry` only re-runs the VLM against the JPEG already in Storage.
- **One source of truth per fact**: DB shape = `drizzle/schema.ts`; shared types = `lib/types.ts`. Docs link to these, don't duplicate them.

## Gotchas

- Gemini model id is **`gemini-3-flash-preview`** — bare `gemini-3-flash` 404s on v1beta. Override with `GEMINI_MODEL`. Without `GEMINI_API_KEY`, `vlmExtract` returns a **stub** so the pipeline runs keyless.
- Supabase serverless connections: use the **transaction pooler** string (port 6543); `lib/db.ts` sets `prepare: false` accordingly. The Drizzle client is **lazy** (no connection at import/build).
- The patron static site and the Next app currently **coexist**; don't assume a file is dead just because it's a root `*.jsx` — confirm against the Next import tree first.

## Documentation map

- **References (current truth — keep synced):** this file · [`docs/architecture.md`](docs/architecture.md) · [`docs/data-model.md`](docs/data-model.md) · [`docs/api.md`](docs/api.md) · co-located [`scan/README.md`](scan/README.md), [`harvest/README.md`](harvest/README.md)
- **Logs (the why — append-only journal):** [`technical/`](technical/) — e.g. `scan-pipeline-ux.md`, `vlm-description-spec.md`, `enrichment-schema.md`, `data-architecture.md`
