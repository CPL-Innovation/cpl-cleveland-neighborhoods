# Cleveland Neighborhoods

An archival map of historic Cleveland Public Library photographs, plus a library-facing
**enrichment interface** (staff app) and a **scan-and-interpret pipeline** that turns raw
box-scan TIFFs into reviewed, machine-interpreted records.

The **Scan pipeline** area at a glance: **Prep (crop & deskew) → Ingest (derive + VLM read) → Review.**

> **`CLAUDE.md` is the source of truth** for how this works now (stack, setup, layout,
> conventions, gotchas). This file is just the front door. Deeper references live in
> [`docs/`](docs/); design logs (the *why*) live in [`technical/`](technical/).

## What's here

- **Staff + scan app — Next.js 14 (App Router) + TypeScript**, live at `/staff`. The enrichment
  interface and the scan/prep pipeline. This is the active codebase (`app/`, `components/`,
  `lib/`, `drizzle/`, `scan/`).
- **Patron site — static prototype, not yet migrated.** `index.html` + `cleveland-map.jsx` +
  `desktop-landing.jsx`, a Leaflet map rendered with in-browser React/Babel (no build step).
  Migrating this into Next is a later pass.
- **Harvest pipeline** (`harvest/`) — the ContentDM mirror that feeds `data/`. Unchanged; see
  [`harvest/README.md`](harvest/README.md).

## Run

**Staff + scan app** (the main app) — see [`CLAUDE.md`](CLAUDE.md) §Setup for the full local-dev
bootstrap (local Postgres + migrations). In brief:

```bash
npm install
cp .env.local.example .env.local   # set DATABASE_URL (local Postgres); GEMINI_API_KEY optional
npm run db:migrate
npm run dev                         # → http://localhost:3000/staff
```

The **Prep** stage additionally needs `python3` with `cv2` + `numpy` (`pip install opencv-python
numpy`); drop raw scans in `scans/raw/`.

**Patron prototype** (static, standalone):

```bash
python3 -m http.server 8000        # then open http://localhost:8000/
```

## Adding harvested data

```bash
node harvest/harvest.mjs --search '<field>^<term>^exact^and' --out data/tier2-<slug>
node harvest/project.mjs --in data/tier2-<slug> --out data/tier3-<slug>
node harvest/merge.mjs              # rebuilds data/tier3-all/
```

No frontend changes needed for additional neighborhoods. See [`harvest/README.md`](harvest/README.md)
for knobs (throttle, page size, retries) and full-collection cold-run instructions.

## License

See [`LICENSE`](LICENSE).
