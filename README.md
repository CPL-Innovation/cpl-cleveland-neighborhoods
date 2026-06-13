# Old Cleveland

Interactive landing for a Cleveland Public Library historical-photo map. Mocked-up with React + Babel-in-browser; no build step.

## Run locally

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Entry points

- `index.html` — patron site. Desktop landing with the interactive map, loads real ContentDM records from `data/tier3-all/records.json` on boot. Mock data (Millionaire's Row, original curated dots) is layered on top.
- `enrichment-app.html` — staff enrichment tool. Sidebar nav (Home / Photos / Stories / Contributions / Vocabularies) with a working Photos list + record-edit screen, both fed by the same `data/tier3-all/records.json`.
- `mockup.html`, `enrichment.html` — original design-canvas views from the Claude Design handoff. Artboards laid out on a draggable canvas. Useful for comparing visual states side-by-side.

## File map

| File | What it is |
| --- | --- |
| `cleveland-map.jsx` | Patron SVG map + `CLEVELAND_PHOTOS` (curated mock) + `MILLIONAIRES_ROW` (featured corridor) + `loadHarvestedPhotos()` adapter that maps harvested lat/lng → viewBox coords. |
| `desktop-landing.jsx` | Patron desktop UI: header, time-range slider, geolocation pill, zoom, Story of the Week card, photo detail panel (renders live IIIF thumbnails when present). |
| `mobile-landing.jsx`, `mobile-photo-detail.jsx` | Mobile artboards (used by `mockup.html`; not wired into the real site yet). |
| `staff-app.jsx` | Enrichment app router + NavContext. Fetches `data/tier3-all/records.json` on mount and adapts each record into the staff-screen schema. |
| `staff-shell.jsx`, `staff-home.jsx`, `staff-photos-list.jsx`, `staff-record-edit.jsx`, `staff-story-author.jsx` | Enrichment screens. Photos list + record edit render real IIIF thumbnails + ContentDM metadata; Home / Stories / Contributions still use mock copy. |
| `harvest/` | Node harvest pipeline — paged `dmQuery` enumeration → per-record `dmGetItemInfo` → Tier 2 JSONL → Tier 3 lean projection → merge across subsets. See [harvest/README.md](harvest/README.md). |
| `data/tier2-<slug>/` | Per-subset full-fidelity harvest (one neighborhood/facet per dir). |
| `data/tier3-<slug>/` | Per-subset lean projection (the patron site can target one subset directly if you want). |
| `data/tier3-all/` | Merged union of all `tier3-*/` subsets. Both `index.html` and `enrichment-app.html` load `records.json` from here. |
| `technical/` | Spec docs — ContentDM API research, data architecture, enrichment schema. The source of truth for what to build next. |

## What's wired to real data

- Patron map dots, hover tooltips, click-to-detail, IIIF thumbnails in the photo panel.
- Enrichment Photos list rows (id, title, year, neighborhood, themes, geo status, IIIF thumb).
- Enrichment Record edit (image, title, creator, year, address, rights, accession, "You might enrich next" sibling suggestions, "Open in ContentDM ↗" link).

## What's still mocked

- **Home dashboard counts** (`Tremont · 22 missing geo` etc.) — hardcoded copy. Real worklists will need harvests across more neighborhoods.
- **Stories / Contributions / Vocabularies / Comments / AI assist drawer** — UI shells with mock content.
- **Geolocation** ("Photos near you") drops the marker at Public Square as a demo.
- **Cite / Share / Request a scan / Add a memory** — stub buttons.
- **Search** is the existing client-side substring matcher; the harvested `data/tier3-all/search-index.json` isn't wired into the patron search box yet.
- **Mobile breakpoint** isn't wired up — real site renders the desktop layout at any width. Mobile lives in `mockup.html` only.
- **Story of the Week** is hard-coded to Millionaire's Row.

## Adding more harvested data

```
node harvest/harvest.mjs --search '<field>^<term>^exact^and' --out data/tier2-<slug>
node harvest/project.mjs --in data/tier2-<slug> --out data/tier3-<slug>
node harvest/merge.mjs                # rebuilds data/tier3-all/
```

No frontend changes needed for additional neighborhoods. See [harvest/README.md](harvest/README.md) for knobs (throttle, page size, retries) and the full-collection cold-run instructions.
