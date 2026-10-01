# CLAUDE.md

Project spine for both humans and Claude Code. This is a **reference** doc — present-tense
"how it works now," kept in sync with the code. For the *why/what* behind decisions, read the
design specs in the **Obsidian design vault** — `…/iCloud~md~obsidian/Documents/Projects/01
Develop/CPL Cleveland Neighborhoods/build/`, entry point `build/BUILD-SPEC.md`. These moved out
of the repo's old `technical/` folder and are now read-only design intent (the repo stays the
source of truth for *implementation*; intent changes route back via `build/_FROM-BUILD.md`).

> ⚠️ **Four sibling vaults share that `01 Develop/` parent**, each with its own `BUILD-SPEC.md`
> and its own `_FROM-BUILD.md` valve: **CPL Cleveland Neighborhoods** (this app), **CPL Design
> System** (`@cpl/tokens` + `@cpl/ui`), **CPL Dateline Cleveland**, and **CPL Self-Guided Tour**.
> Write back to the vault that owns *the thing you changed*, not the one matching the repo you
> happen to be sitting in — a token or `HonestyBadge` change is Design System intent even though
> you reached it from this repo.

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
- **Convergence slice (Tier 1.5 → patron): built.** "Browse by what's in the picture" (masthead → WHAT'S IN THE PICTURE; now a full page with a description search — see below) — facet filters + 2 exemplar queries (signage · streets mid-change) over the validated 99, a result grid into the existing photo-detail panel (extended with the facets + caption + an "AI-extracted (staff-reviewable)" honesty label). **First LIVE enrichment→patron read** (`/api/patron/facets` → `lib/patron-facets.ts`, read-only on the patron side); the architecture's "patron frontend is genuinely static" is retired *for enrichment only* (catalog read stays a static harvest). Local-first; public-read hardening (read-only role / RLS / rate-limit) deferred to host-on-commit.
- **Tier-1 normalize + unify (box-scan 99 → first-class photos): built.** `photo_enrichment` gained a **thin identity model** — surrogate PK `id` + `source` discriminator (`contentdm | box_scan`) + `source_id` + nullable `contentdm_id` — so box-scans and ContentDM records share one **unified Photos table**. The 99's confirmed Tier-1 strings are **normalized onto the unified row** (additive, raw kept beside): `description → patron_caption` (`caption_source`), `address → address_raw + lat/lng` (geocode; `geo_source`), `year stamp → year_raw + date_start` (`date_source = archival_stamp`, the pilot honesty valve). A new **Finalize** pipeline stage (`Prep → Ingest → Facet review → Finalize`, `components/scan/finalize.tsx` + `lib/finalize-store.ts`) runs the batch (caption copy · stamp-date parse · geocode → unified write) and hosts the **geocode-miss pin tray** (staff type coordinates → `geo_source = staff_lookup`). Geocoder is OpenStreetMap Nominatim behind a seam (`lib/geocode.ts`, `GEOCODER=none` to disable). **A miss is three different things and the batch now says which** (`geo_miss_reason` = `"<kind>: <reason>"`): `ambiguous:` (refused pre-network — ranges, "Rear of…", intersections), `no_match:` (OSM answered; no such house number), `provider:` (HTTP/timeout/rate-limit — **transient**). Only `provider:` misses, and rows whose confirmed Tier-1 address changed in Review after normalization, are re-geocoded by the next Finalize run; the rest wait for a librarian's pin. ⚠ **The old rule was "already normalized → skip forever"**, which froze a two-second OSM outage into a permanent pin-tray entry and made the working API look broken. The query sent over the wire is also cleaned of archival apparatus (`(Year of)`, `A.K.A …`, trailing periods) while `address_raw` keeps the cataloger's string verbatim. The convergence read **collapsed to a single-table read** (`lib/patron-facets.ts` reads the normalized fields directly; scan_review join is fallback-only). Local-only; scope = the 99. **Both views now surface the unified table as one collection:** the staff **Photos list** merges the box-scans on top of the static ContentDM harvest (`/api/staff/photos` → `lib/staff-photos.ts`, adapted via `adaptBoxScanToStaff`) with a **functional Source segmented filter** (All / Box-scan / ContentDM, the first non-cosmetic filter in that bar — keys off `StaffRecord.source`), and the **patron map** plots the geocoded box-scans alongside ContentDM markers (`adaptFacetPhoto` in `components/patron/data.ts`, reading `/api/patron/facets`). Box-scans with no legible year stay in the pool but off the map (same rule as ungeocoded ContentDM).
- **Places (stacked map dots): built.** The patron map plots **one dot per coordinate**, not per photo. The archive is full of repeat visits — the city photographed 16133 Grovewood in 1978, 1981, 1982, 1983 plus four undated passes — so one-marker-per-photo stacked them and **86 of 300 mappable photographs were unreachable** under another pin (deepest stack: 9). Grouping lives in `lib/patron-places.ts` (`groupIntoPlaces` · `siblingsOf` · `yearSpan`), keyed on the coordinate to 5dp (~1m) because siblings geocode from the *same address string*. A stacked dot shows a count badge, and the photo-detail panel gains a **"This corner · N photographs · 1978–1983" filmstrip** — thumbnails by year, current highlighted, click to switch; a dot marks siblings that already have a then & now. The time slider filters *within* a place (count = in-range photos; the dot dims only when the whole corner is out of range), and the weaker proximity "neighbors in time" block is suppressed when a corner sequence exists. **⚠ Anything grouping photos by location must resolve coordinates through `photoLatLng`** — the map and panel disagreeing on that is exactly how the filmstrip first failed to appear for harvested records.

- **Then & now (Street View "now"): built.** The patron photo-detail panel's Then/Now toggle is real — the "now" is a **staff-framed Google Street View embed**, not a computed lookup. A librarian walks Street View to where the photographer stood, matches the framing, and pastes the *Share → Embed a map* URL into the **Finalize** stage's viewpoint tray (`RephotoTray` → `POST /api/scan/finalize/[chcId]` `{rephotoEmbedUrl}`). `lib/rephoto.ts` validates the URL and unpacks its camera geometry into the `rephoto_*` columns that already existed (`rephoto_modern_lat/lng`, `rephoto_bearing`, plus new `rephoto_embed_url` + `rephoto_pitch`) — so the framing survives as numbers we own if Street View is ever dropped. **No API key, no billing**: the `pb=` embed needs neither. The toggle only appears where a viewpoint was recorded — no placeholder "now". Attribution + a "Street View is photographed periodically" caveat ship with it, since we can't know the capture date. **Both sides of the unified table can carry one.** Box-scans record theirs in Finalize; a *cataloged ContentDM photograph* records its own on the staff **Record Edit** screen (`components/staff/rephoto-tray.tsx`, the shared tray → `POST /api/staff/photos/[id]/rephoto` → `lib/rephoto-store.ts`), which **upserts** the enrichment row — a harvested photo has none until someone enriches it. The patron read is the matching half: `/api/patron/enrichment` (`lib/patron-enrichment.ts`) is a live, read-only **overlay** the landing joins onto the static catalog **by ContentDM id** (`applyPatronEnrichment`). ⚠ **The catalog stays a static harvest** — the ContentDM row we write holds identity + `rephoto_*` and nothing else; copying title/date/coords into it would create a second writable home for a cataloged fact. **The patron panel has two shells** (`components/patron/panels.tsx`): the 480px **drawer** beside the map (reading — you keep your place in the city) and an **expanded centred dialog** (looking), sharing one `PhotoMedia` + `PhotoFacts` pair so nothing is written twice. The dialog adds a third view, **Side by side** — asking for it from the drawer expands automatically, since the comparison is the whole point of a then & now and 480px can't hold two images worth comparing. **The shell is sized from the pictures, not the other way round**: panes are 4:3 and centred, and the dialog's height is computed from the pane width (`fitH`) — stretching a pane to a tall dialog only grows the letterbox bars. Side-by-side widens the cap (2000px vs 1240px) and narrows the metadata rail. Esc peels one layer (expanded → drawer → closed) via a **capture-phase** listener that stops the landing's own Esc handler. In the comparison the pane captions sit *above* the frames — Google's embed parks its address card in the top-left corner, where an overlay chip used to land.

- **The unframed "now" (auto Street View from the address): built.** A staff-framed viewpoint exists for a few dozen photographs; every *other* photo with real coordinates now gets a default Street View synthesized from its point (`autoStreetViewUrl` in `lib/rephoto.ts`, keyless `output=svembed` — no API key, no billing, same as the `pb=` embeds staff paste). **It is not a then & now and is labelled as such everywhere it appears**: "viewpoint not matched — placed automatically from the address", the side-by-side caption reads "Now · Street View, near this address", no bearing is printed (we'd be guessing), and the filmstrip's then-&-now dot still marks only staff-framed siblings. `framedNow` is the flag the labels key off; nothing may treat the two as interchangeable. **Real coordinates only** — `photoLatLng` would happily unproject the curated demo photos' legacy viewBox x/y into a plausible Cleveland point, and dropping a patron on an inferred street is the false promise this avoids. Three things we can't do keylessly: check that coverage exists (the metadata endpoint is keyed), aim it (the geocode is the *subject*; the panorama is out on the street and we can't read where, so we set no heading and let Google use the panorama's own), or promise the building is in shot. Hence "drag to look around" rather than "this is the same view".
- ⚠ **Two ways the keyless Street View embed fails silently.** (1) **Omit `cbp` and it still returns a perfectly good embed — of a zoomed-out world map.** No error, no console warning, no failed request; `layer=c` alone degrades to map mode. (Also: `cbll` needs a literal comma, not `%2C`.) (2) **It rate-limits.** ~15 embed loads in a few minutes and it starts returning blank documents, recovering on its own after ~2 minutes. The iframe is cross-origin, so there is no `onError` and nothing to catch — the pane renders grey. A message sits *behind* the iframe saying so, revealed only when the embed is blank. **Real patron traffic will hit this far harder than local testing did; the durable fix before hosting is a Maps Embed API key** (free tier, server-side), which would also let a batch pre-check coverage. Third vendor in this project to fail by rendering — see the CARTO note below.
- ⚠ **`adaptHarvestedRecord` was throwing away `lat`/`lng`**, keeping only the projected legacy x/y, so ~230 harvested ContentDM photos carried no real coordinate on the `Photo` object at all. Fixed — anything needing the real point (place grouping, the address-derived Street View) now reads the cataloged coordinate instead of an inverse projection.

- **Geo from the address (staff suggest → accept): built.** The staff **Record Edit** screen's "Location & geo" panel was scaffolding — a CSS-gradient map, hardcoded pins, a fixed coordinate readout, and an uncontrolled address input that saved nowhere — beside an "AI assist" rail whose Geo card was a *permanently dismissed mockup of a suggestion*. Both are gone; the panel is now `components/staff/geo-tray.tsx`, a real **suggest → look → accept** loop over the existing geocoder (`lib/geocode.ts`, the one Finalize already uses for box-scans). ⚠ **Suggest and accept are two calls on purpose**: a geocoder that wrote on success turns review into undoing, and the asymmetry matters — a wrong coordinate files a photograph on the wrong street and nobody catches it, a missing one is visibly missing. The write is source-agnostic (`lib/geo-store.ts`, the sibling of `rephoto-store`): box-scan = UPDATE only, ContentDM = UPSERT of identity + geo columns. **The catalog still isn't writable** — a looked-up coordinate is *enrichment*, not a cataloged fact, so it lands in `photo_enrichment` and the harvest is untouched. Two supporting pieces: (a) `suggestGeocode` opens exactly one extra door over the batch policy — a string with **no house number** may be looked up as a named place, because a harvested record has **no address field at all** (its only locator is a title like "Scranton Elementary School, 1966"); such a hit can never claim `verified_address`, only `inferred`. (b) `/api/staff/photos` now also returns a **ContentDM geo overlay** which `applyStaffGeoOverlay` joins onto the static harvest by id — without it the librarian does the work and the GEO column still reads "missing", i.e. the button looks broken. ⚠ **`inferred` does not mean "named place"** — it means the match was coarser than a doorway, which happens *either* because we asked without a number *or* because OSM answered a numbered address with an area ("3395 Scranton Rd" → the hospital campus). The UI says "approximate" for exactly that reason.
- ⚠ **`ambiguityReason` used to read a year as a street number.** The guard tested "contains a digit", which is true of every box-scan address line *and* of every catalog title, since titles carry dates: "City Hospital, 1959, CH-35153" and "Walton School, 1939" both passed as addresses and went to the gazetteer. It now strips trailing four-digit years and accession ids before the test — but only a year that **isn't the first token**, because "1913 W 25th St" is a real address whose house number falls in the year range. Verified no-op against all 101 box-scan rows.

- **Patron look = the Dateline Cleveland design system.** The patron site (`components/patron/`) was re-skinned from the warm cream/teal prototype palette to Dateline's "flat civic" system: Spectral / Work Sans / JetBrains Mono, `navy` for brand + interaction, `marigold` as the single accent (fill or rule only, never text on white), 1px hairline division, **0 radius**, shadows only on floating layers, a glyph on every action (→ ⤢ ↗ ← ✕), no emoji. Values live once in `components/patron/theme.ts` (`C` colours · `F` families · `T` type styles); `patronCssVars` puts the same values on the landing root as CSS variables so `patron.css` (Leaflet DOM + the `dc-` hover/focus/pressed classes) reads them without a second copy. ⚠ One deliberate deviation: Dateline's `tertiary` (#8a94a3, 3.07:1) is darkened to `#646d7b` so mono meta clears AA on both `canvas` and `sunken`, as the system's own README asks adopters to do; honesty notes use the info ink `#2a6580`. The staff app is **not** on this system — it still draws from `@cpl/tokens` via `STAFF_TOKENS`.
- **Patron details added the same session:** at the map's deepest zoom (18) each place's dot becomes a **thumbnail** of one of its photographs (`cm-dot--thumb`; the one shown is the one a click opens), and the **+/−** buttons now step from the map's *real* zoom (`onZoomChange`) — before, wheel-zooming in then pressing **+** zoomed *out*, and **+** could never reach 18. Small images of **local** derivatives go through Next's resizer (`thumbUrl` in `data.ts`, ~8 KB instead of the ~400 KB full derivative) and lazy-load; catalog IIIF images are requested at the size shown (`largeUrl`). The featured card on the map is dismissible. WHAT'S IN THE PICTURE gained a **description search** over the AI-written captions + transcribed signs (every word must match; tiles show the matched passage highlighted); its suggested words are ones the 99 actually use — "gas station", "church", "streetcar" match nothing. **3D demo (one photograph):** 3410 Sackett Ave (ContentDM 8617) gets a *3D model* view (video, `public/demos/3410-sackett/model.mp4`) beside Then/Now and a **3D world** button that takes the whole panel (still image `world.jpg`), each linking out to the live Tripo model / World Labs Marble world; config in `components/patron/demos.ts`, missing files render a hatched placeholder naming the path.
- **Map ↔ Gallery: built.** A `Map | Gallery` switch (top centre of the map, `G` to flip) lays the photographs *currently in the map's view* out as a grid (`components/patron/gallery.tsx`). The gallery is a view of the map, not a second catalog: `ClevelandMap` reports its bounds (`onBoundsChange`, on every pan/zoom/resize), the map stays mounted underneath so switching back lands where you were, and `photosInBounds` resolves coordinates through `photoLatLng` exactly as the dots do. It shares the time range (the slider is re-hosted in the gallery's rail), adds neighbourhood facets drawn only from what's in view, and groups by decade, pooling thin decades ("1880s–1900s") so a gallery never holds a lone photograph. Undated photos are excluded by default (they're dimmed on the map too) and can be opted in. The slider's end is **2025**, not 2020 — the 2022 Clark-Fulton series was silently dropped by Reset and by dragging the handle.
- **Exhibits + full-page sections: built.** The masthead's sections are pages, not pop-ups: EXHIBITS (was STORIES) and WHAT'S IN THE PICTURE render full-bleed over the map under the masthead (one scroll container, `section` state in `landing.tsx`); the map stays mounted beneath — made `inert` + `aria-hidden` while covered — so THE MAP returns you where you were. `components/patron/exhibits.tsx` builds the exhibits from the pool (`buildExhibits`): **Millionaire's Row is the one CURATED exhibit** (curator notes at every stop); the rest are **DRAFTS gathered by rule** from real records — Grovewood Avenue (City Hall box scans by street), Signs of the times (every box scan with a transcribed storefront sign), Clark-Fulton then & now (earliest vs 2010s ContentDM) — each carrying a DRAFT tag and a HonestyNote saying no curator has written it. ⚠ A draft's words must stay counts and sources, never invented history. "See it on the map" flies the map to an exhibit's points (`ClevelandMap` `focus` prop). Box-scans now go through **one adapter, `boxScanPhoto`** (`data.ts`) — the old second copy in browse disagreed on id (`box-…` vs bare chc_id) and stamped every print "Public Domain (pre-1931)". The Millionaire's Row stops carry **placeholder lat/lng** set by hand along Euclid Avenue (US 20) at each stop's cross street, E. 12th → E. 86th (`MILLIONAIRES_ROW_SEED` in `data.ts`; x/y are derived from them) — approximate, not geocoded. The prototype's original viewBox x/y ran the trail out past Cleveland Heights.
- **Legacy prototype files removed.** The superseded staff/scan `*.jsx` and their host HTMLs (`enrichment-app.html`, `enrichment.html`, `mockup.html`), **and the patron prototype (`index.html` + `cleveland-map.jsx` + `desktop-landing.jsx`)**, were deleted once the Next tree replaced them (recoverable from git history); a few `lib/`/`components/` files still carry `// Ported from <name>.jsx` provenance comments. The legacy `scan/*.mjs` were likewise deleted; only `scan/env.mjs` remains, still loaded by the `.ts` CLIs.
- **Local-by-default in dev:** the DB is **local Postgres** (Postgres.app) and derived JPEGs live on **local disk** (`public/derivatives/`, served at `/derivatives/<chc>.jpg`). Both swap to Supabase (Postgres + Storage) by env vars alone — no code change. Supabase is the deploy target, not a dev dependency.
- **DB round-trip verified end-to-end** against local Postgres (`scan:run` → on-disk JPEG store → DB → `/staff` → `/api/scan/*`). `npm run build` (full typecheck) passes.
- **Prep (crop & deskew): built** — `/staff → Scan pipeline → Prep`. A contact-sheet grid driving an OpenCV engine (`scan/crop_engine.py`, run as a local subprocess) that turns `scans/raw/<CHC>.tif` → `scans/masters/<CHC>.tif`. Local-only like the ingest doors. Verified end-to-end on real CPL scans. Needs `python3` + `cv2`/`numpy` (see Gotchas).
- **Auth: deferred** (clean seam left).
- **⚠ Pre-deploy blocker — the shared packages aren't installable.** `@cpl/tokens` and `@cpl/ui` are bridged by **`npm link` and are not in `package.json`**, so a **clean clone of `main` cannot build** (`Cannot find module '@cpl/tokens'`). Four files import them: `lib/tokens.ts`, `components/scan/review.tsx`, `components/scan/facet-review.tsx`, `components/staff/ui.tsx`. Nothing announces this today — there is no CI and no `vercel.json` — so the first thing to notice will be a deploy. **Fix before hosting:** publish both to a registry (npm private / GitHub Packages) or split `packages/*` into their own repo, then declare them as real dependencies and demote `npm link` to a local-dev override. A git dependency won't work — npm can't install a subdirectory of a monorepo.


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
- **Leaflet** (npm) + a **keyless pale basemap** for the patron map (Esri World Light Gray Canvas by default — see `components/patron/basemap.ts`), used imperatively in `components/patron/cleveland-map.tsx` (client-only via `next/dynamic`)

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
middleware.ts             → keeps /staff + /api/scan/* + /api/staff/* local (404 to non-local requests)
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
  api/patron/enrichment   → LIVE read-only enrichment overlay for harvested ContentDM photos
                            (joined onto the static catalog by contentdm_id; the then & now viewpoint)
  api/patron/facets       → convergence slice: LIVE read-only read of the 99 graduated facets
                            (single-table read of the unified photo_enrichment), "browse by what's in
                            the picture" + the box-scan markers merged onto the patron map
  api/staff/photos        → the live half of the staff Photos list (read-only; empty if DB down):
                            box-scan rows + a ContentDM geo overlay joined onto the static harvest
                            + [id]/rephoto (GET/POST the then & now viewpoint — the first real write
                              on Record Edit; upserts the row for a ContentDM photo, local-only)
                            + [id]/geo (GET current · POST suggest = geocode only, nothing written ·
                              POST accept/clear = the write; local-only)
  layout.tsx, globals.css
components/
  patron/                 → landing (SiteHeader + sections + map overlays), cleveland-map (Leaflet,
                            dynamic/ssr:false; dots → thumbnails at max zoom, bounds/focus/zoom
                            reporting), panels (search · photo-detail: then/now/side-by-side/3D),
                            gallery (map ↔ gallery: the photos in the map's bounds),
                            exhibits (EXHIBITS section: curated + draft exhibits, SiteFooter),
                            browse-by-picture (WHAT'S IN THE PICTURE — facets + description search),
                            demos (the one-photo 3D demo config), theme (Dateline tokens: C·F·T),
                            data (curated seed + projection + harvest/box-scan adapters + thumbUrl),
                            patron.css (Leaflet DOM + dc- interaction classes)
  staff/                  → nav (NavContext), ui (shared primitives), shell, app (router),
                            home, photos-list, record-edit, story-author,
                            rephoto-tray (the shared then & now tray — Finalize + Record Edit),
                            geo-tray (Location & geo on Record Edit: suggest → look → accept)
  scan/                   → prep (Prep contact-sheet grid) + prep-editor + prep-flags,
                            pipeline (Ingest surface: worklist sheet + scan-inbox modal), review (B),
                            accuracy (C), ingest (Scan-inbox modal),
                            facet-review (Tier 1.5 Run 2 A/B review surface — local-only, staging),
                            finalize (Finalize stage — normalize+unify the 99: batch + geocode-miss pin tray)
lib/                      → db, scan-store, accuracy, vlm-extract, storage, scan-api, staff-api,
                            scan-ingest (shared derive→store→VLM→DB core),
                            vlm-facet (Tier 1.5 Run 1 discovery — 3-way sibling to vlm-extract),
                            vlm-run2 (Tier 1.5 Run 2 — Gemini enforced-enum extraction) +
                            facet-review-store (Run 2 review staging + Stage 0 graduation → photo_enrichment),
                            patron-facets (convergence slice — live read-only read of the 99),
                            patron-enrichment (live read-only overlay for harvested ContentDM photos) +
                            rephoto-store (the source-agnostic then & now write: box_scan updates,
                              contentdm upserts) + rephoto (embed-URL parser),
                            finalize-store (Tier-1 normalize+unify: confirmed Tier-1 → unified photo_enrichment) +
                            geocode (address→coords seam — OSM Nominatim, GEOCODER=none to disable;
                              geocodeAddress = batch policy · suggestGeocode = the interactive ask) +
                            geo-store (the source-agnostic coordinate write, sibling of rephoto-store),
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
- **Styling is inline CSS-in-JS** via `STAFF_TOKENS` (`lib/tokens.ts`). No stylesheets except `app/globals.css` (reset + fonts + one keyframe). **`STAFF_TOKENS` is a *definition over `@cpl/tokens`*, not hardcoded hex** (CPL Design System M2): the same 22 keys are rebuilt from the shared package's static `tokens` export — navy-cool, not warm/teal. Edit the *map* in `lib/tokens.ts`, never the ~900 `t.*` call sites. **On `@cpl/tokens` v0.3 the file contains no color literals at all** — the soft chip fills (`--color-*-soft`), the on-fill foreground (`onFill` → `--text-on-fill`) and the cool middle surface (`bgSurface` → `--surface-subtle`) are all package slots. **Status colors come in three forms** (base = dot/fill · soft = chip background · ink = anything with text on it): CN's bare `sage`/`ochre`/`draft` keys are the **inks** (the AA-legible values, which is what nearly every call site needs, including filled controls whose white `onFill` label must stay readable); `sageBase`/`ochreBase`/`draftBase` exist for bare dots and decorative rules only.
- **Staff app is a client SPA** at `/staff` — navigation is React state via `NavContext`/`useNav` (`components/staff/nav.tsx`), **not** file-based routes. (Adopting file routing/RSC is a possible later refactor.)
- **Shared UI primitives** (`pillBtn`, `Kbd`, `Field`, `FieldGroup`, `FieldFoot`, `inputStyle`, `textareaStyle`, `selectStyle`, `ChipInput`) live in `components/staff/ui.tsx` — import, don't redefine. **Provenance/honesty markers are no longer local**: `HonestyBadge` from **`@cpl/ui`** (CPL Design System M3) is the one component that carries the "machine-extracted · curator-reviewable" contract — it replaced the bespoke `VLM read`/`VLM`/`AI` chips. Compose it from slots (`provenance` · `review` · `edited`/`original` · `disclaimer`); never hand-write honesty copy again.
- **`scanApi`** (client fetch wrapper) lives in `lib/scan-api.ts`; the old `window`-global pattern is retired.
- **Derivation is a local job.** `sharp` reads local TIFFs; serverless never derives. Both ingest doors — the `scan:run` CLI and the in-app **Scan inbox** (`/api/scan/masters` + `/api/scan/ingest`) — share one core (`lib/scan-ingest.ts`) and are **local-only** (the routes 403 on `VERCEL`). Per-photo serverless `retry` only re-runs the VLM against the JPEG already in the store. **Un-ingest** (`DELETE /api/scan/records/[chcId]`) drops the row + derivative (master TIFF stays) and *is* serverless-safe. The store writes the JPEG **once** — `lib/storage.ts` owns the file (local disk or Supabase).
- **Prep (crop/deskew) is a local job too**, same shape: `lib/prep-engine.ts` spawns `python3 scan/crop_engine.py` against a local TIFF; its routes (`/api/scan/prep`, `/api/scan/prep/[chcId]`) gate on `prepEnabled()` and 403 on `VERCEL`. The engine is **texture-based, not brightness** (grainy emulsion vs. smooth paper) — see `build/digitization/tooling/crop-deskew-spec.md` (Obsidian design vault). Prep's **only** handoff to the Ingest stage is the `scans/masters/<CHC>.tif` it writes; don't make Ingest/Review depend on `scan_prep`. State lives in the `scan_prep` table (`pending|auto_ok|flagged|fixed|approved`).
- **One source of truth per fact**: DB shape = `drizzle/schema.ts`; shared types = `lib/types.ts`. Docs link to these, don't duplicate them.

## Gotchas

- **`@cpl/tokens` + `@cpl/ui` are bridged by `npm link`, not registry deps** — both live in **`../cpl-design-system/packages/*`**, a **git worktree** of the Dateline repo pinned to the `design-system/cpl-tokens-and-ui` branch. ⚠️ **Link against the worktree, never `../cpl-dateline-cleveland`** — that checkout tracks Dateline's own feature branches, where `packages/` doesn't exist, so the symlinks go dangling the moment someone switches branches there. Neither package is in `package.json`, so **`npm install` breaks the links**. ⚠️ **Link them together — `npm link` prunes the others**: linking `@cpl/ui` alone silently removes the `@cpl/tokens` symlink and the build fails with `Cannot find module '@cpl/tokens'`. Always: `npm link @cpl/tokens @cpl/ui` (run `npm link` once in each package dir first). Verify with `node -e "import('@cpl/tokens').then(m=>console.log(m.tokens.colorPrimary))"` → `#0057B7`.
- Gemini model id is **`gemini-3-flash-preview`** — bare `gemini-3-flash` 404s on v1beta. Override with `GEMINI_MODEL`. Without `GEMINI_API_KEY`, `vlmExtract` returns a **stub** so the pipeline runs keyless.
- DB backend is **`DATABASE_URL`-only**: local Postgres (Postgres.app, `postgresql://<you>@localhost:5432/cpl_neighborhoods`) in dev; Supabase **transaction pooler** string (port 6543) when deployed. `lib/db.ts` sets `prepare: false` (required by the pooler, harmless locally) and is **lazy** (no connection at import/build). Postgres.app must be running for the local DB to be reachable.
- Storage backend is auto-selected in `lib/storage.ts`: **local disk** (`public/derivatives/`) unless `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; force either way with `STORAGE_BACKEND=local|supabase`. `fetchDerivativeBytes` reads relative `/derivatives/...` paths off disk and absolute URLs over HTTP.
- ⚠ **CARTO gated their keyless basemap tiles — the map went blank-ish without a single error.** Every style (`light_all`, `voyager`, `light_nolabels`, …) still returns **HTTP 200 with a valid 256×256 PNG**, and that PNG reads *"API KEY REQUIRED"* across the tile: Leaflet marks it `leaflet-tile-loaded`, `naturalWidth` is 256, the console and network panel are clean. **A basemap can fail by rendering** — check it with your eyes, not a status code. The provider now lives behind a seam (`components/patron/basemap.ts`): default is keyless **Esri World Light Gray Canvas** (closest match to Positron; place names are a separate `…_Reference` layer, drawn in its own `basemapLabels` pane at z-index 350 with `pointer-events: none` so it can't swallow a click on a photo dot; `maxNativeZoom: 16` because z17+ returns blank tiles — Leaflet upscales instead). Set `NEXT_PUBLIC_CARTO_API_KEY` to restore Positron exactly, or `NEXT_PUBLIC_BASEMAP=osm|esri` to force one.
- ⚠ **`middleware.ts` is the only thing between a shared dev server and the staff writes** (auth is deferred; the `403`-on-`VERCEL` guards don't fire locally). Two traps it already hit: (1) `config.matcher` **must be a literal array** — a computed one is silently ignored and the middleware then matches *every* route, the patron site included (a dev-log warning is the only sign); (2) **Next's dev server adds `X-Forwarded-For: 127.0.0.1` to its own requests**, so "has a forwarding header" is not "came through a tunnel" — the check is non-loopback XFF, `CF-Connecting-IP`/ngrok headers, or a non-localhost Host. It is a sharing guard, not auth. To share the dev site: `cloudflared tunnel --url http://localhost:3000` (quick tunnel, random URL, dies with the process).
- `thumbUrl` only resizes **same-origin** paths (`/derivatives/…`). If box-scan derivatives move to Supabase Storage, their absolute URLs pass through at full size until `images.remotePatterns` is added to `next.config.mjs`.
- The patron map uses **Leaflet** (npm dep) imperatively inside `components/patron/cleveland-map.tsx`, loaded via `next/dynamic({ssr:false})` so Leaflet never runs on the server. Its CSS (`leaflet/dist/leaflet.css` + `components/patron/patron.css`) is imported there. The `.cm-*` / `.leaflet-*` styles are global (Leaflet injects DOM outside React) but namespaced, so they don't touch the staff UI.
- **Prep needs `python3` with `cv2` + `numpy`** on PATH (override the interpreter with `PREP_PYTHON`, the input folder with `SCAN_RAW_DIR`). `tifffile` is **not** required and is in fact binary-incompatible with NumPy 2.x here — the engine uses cv2's libtiff + Pillow for 16-bit/grayscale/LZW masters. `minAreaRect` returns angles in `[0,90)` on OpenCV ≥4.5, so the engine folds them into `(-45,45]`. The crop box is in **raw full-res pixels** `{cx,cy,w,h,angle}`; the editor maps to screen with one uniform scale.

## Documentation map

- **References (current truth — keep synced; in-repo):** this file · [`docs/architecture.md`](docs/architecture.md) · [`docs/data-model.md`](docs/data-model.md) · [`docs/api.md`](docs/api.md) · co-located [`scan/README.md`](scan/README.md), [`harvest/README.md`](harvest/README.md)
- **Design specs (the why/what — in the Obsidian vault, *not* the repo):** entry point `build/BUILD-SPEC.md` — e.g. `build/enrichment-app/scan-pipeline-ux.md`, `build/enrichment-app/vlm-description-spec.md`, `build/data-backend/enrichment-schema.md`, `build/data-backend/data-architecture.md`, `build/digitization/tooling/crop-deskew-spec.md`. Intent changes route back via `build/_FROM-BUILD.md`.
