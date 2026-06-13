# ContentDM API — Technical Log

Running log for the technical implementation aspect of the MVP discovery interface. Source-of-truth doc for what we know about the ContentDM API, what we've verified, what's open, and what we've decided.

**Collection:** A Gallery of Cleveland Photographs (`p4014coll18`)
**Host:** `https://cplorg.contentdm.oclc.org`
**Total items (as of 2026-05-24):** 11,700 (was 11,685 on 2026-05-23 — collection grows incrementally)

---

## Verdict (2026-05-23)

**Green light.** Both API surfaces are public, unauthenticated, CORS-enabled, and return live data. The MVP can be built as a pure frontend with no backend, no API key, no IT ticket.

---

## API surfaces

### 1. dmwebservices — metadata & search

Read-only JSON/XML API. Path-style URLs.

- **Base:** `/digital/bl/dmwebservices/index.php?q=<function>/<args>/json`
- **Format toggle:** trailing `/json` or `/xml`
- **Auth:** none
- **Key functions:**
  - `dmGetCollectionList` — all collections on the server
  - `dmGetCollectionFieldInfo/<alias>` — field schema for a collection
  - `dmGetItemInfo/<alias>/<pointer>` — full record for one item
  - `dmQuery/<alias>/<searchstring>/<fields>/<sort>/<maxrecs>/<start>/<suppress>/<docptr>/<suggest>/<facets>/<showunpub>/<denormalize>` — paged search
  - `GetParent`, `GetCompoundObjectInfo` — for compound objects (not relevant for this collection; it's flat single-image records)
- **Pagination:** max 1024 records per `dmQuery` call
- **Returns:** `{ pager: { start, maxrecs, total }, records: [...] }`

### 2. IIIF Image API v2 (Level 2) — images

- **Base:** `/iiif/2/<alias>:<pointer>/`
- **info.json:** `/iiif/2/<alias>:<pointer>/info.json`
- **Image URL pattern:** `/iiif/2/<alias>:<pointer>/<region>/<size>/<rotation>/<quality>.<format>`
- **Pre-rendered sizes (item 2049):** 174, 348, 697, 1393, 2786 px wide
- **Tile pyramid:** 1024×1024 tiles, scale factors 1, 2, 4, 8, 16
- **Formats:** JPG, PNG, TIF, GIF
- **Qualities:** default, color, gray, bitonal
- **CORS:** enabled
- **Auth:** none

**Implications:** drop-in compatible with OpenSeadragon, Mirador, Universal Viewer, Clover. Deep zoom is free.

---

## Collection field schema (verified)

Fields confirmed via `dmGetCollectionFieldInfo/p4014coll18/json`. Subset relevant to MVP:

| Field nick | Name | Type | Searchable | Use for |
|---|---|---|---|---|
| `title` | Title | TEXT | yes | Address-shaped titles; search input |
| `creato` | Creator | TEXT | yes | Attribution |
| `contri` | Contributors | TEXT | yes | Attribution |
| `subjec` | Subject | TEXT (LCSH) | yes | **Primary neighborhood facet** |
| `descri` | Description | TEXT | yes | Story chrome / detail view |
| `date` | Date (Alpha) | TEXT | yes | Display date string |
| `sortda` | Date | DATE | yes | **Sortable ISO date for timeline** |
| `place` | Location Note | TEXT | yes | Neighborhood facet (cleaner than `subjec`) |
| `latitu` | Latitude | TEXT | no | **Map view** |
| `longit` | Longitude | TEXT | no | **Map view** |
| `locata` | Location | TEXT | no | City/county/state context |
| `collec` | Original Collection | TEXT | yes | Sub-grouping (e.g. "Cleveland City Hall Collection") |
| `locati` | Location of Original | TEXT | yes | Physical provenance |
| `donor` | Donor | TEXT | — | Attribution |
| `rights` / `standa` | Rights / rightsstatements.org URI | TEXT | — | Reuse logic |

---

## Verified live calls

### Item-level metadata (item 2049)

`dmGetItemInfo/p4014coll18/2049/json` returned a fully populated record including:
- `title`: "10000 Euclid Avenue, 1943"
- `sortda`: "1943-07-07"
- `place`: "Fairfax neighborhood (Cleveland, Ohio)"
- `latitu`: "41.503301", `longit`: "-81.618059"
- Real description paragraph (Board of Zoning Appeals provenance)

### Field-scoped search

`dmQuery/p4014coll18/subjec^Hough^all^and/...` returned **655 records** for Hough neighborhood. Confirms neighborhood faceting via `subjec` works.

### IIIF info.json

`/iiif/2/p4014coll18:2049/info.json` → HTTP 200, full Level 2 profile.

### IIIF thumbnail

`/iiif/2/p4014coll18:2049/full/200,/0/default.jpg` → 5.8KB JPEG, HTTP 200.

---

## Caveats & open questions

- ~~**`sortda` coverage is patchy.**~~ **Updated 2026-05-24:** empirically 96–97% in the two sampled neighborhoods (Central, Clark-Fulton). Timeline UI is honest. Full-collection coverage TBD until the cold full harvest runs.
- ~~**`latitu`/`longit` coverage is unknown.**~~ **Updated 2026-05-24:** neighborhood-dependent. 96.4% in Central, 78.8% in Clark-Fulton; random 10-record sample across the whole collection was 0%. Brian's geo work is concentrated. Implication: "map of what we have" is the v0 posture; geocoding from titles / crowdsourcing pinning are downstream features, not first-day requirements.
- **No documented rate limits.** Public OCLC service shared across thousands of institutions — be polite, cache aggressively. Prefer build-time harvesting over runtime hammering. (Pipeline uses 5 req/s; see [[harvest-pipeline]] §"Throttle & retry policy.")
- **OCLC's own API reference page returned 404 on deep links.** Live API is more reliable than the docs. Verify by hitting endpoints, not by reading.
- **No GraphQL, no bulk export.** Full collection pull = ~12 paged `dmQuery` calls (1024 records each) + per-record `dmGetItemInfo`.
- **Flat collection.** No compound objects in this collection; single-image records throughout.
- **Empty fields return `{}`, not `""` or `null`.** Cataloger-side absence is encoded as an empty JSON object. The pipeline's `isEmpty` helper normalizes this; downstream code should not assume scalars.
- **Real cataloging errors exist in geo data.** Five Clark-Fulton records have `lng == lat` (copy-paste error). The harvest's bbox guard rejects them at projection time. See [[harvest-pipeline]] §"Real data quality findings."

---

## Recommended architecture (patron-side view)

> This section covers the patron interface only. The harvest also serves the enrichment tool — see [§Integration with the enrichment interface](#integration-with-the-enrichment-interface) below for the dual-output picture.

**Build-time harvest → static frontend → IIIF live.**

1. Harvest script pages through `dmQuery`, writes all 11,685 records' metadata to a single JSON/SQLite snapshot committed to the repo (or to object storage with a CDN).
2. Frontend reads the snapshot for search, faceting, sorting, map state — instant, no API dependency at runtime.
3. Images load live from IIIF as the user scrolls / zooms.

**Why:** sidesteps rate-limit risk, sub-100ms search, OCLC outage degrades to "images don't load" not "site is down." Harvest cadence can be weekly or nightly depending on how often L&GH adds items.

---

## MVP capabilities unlocked

- Neighborhood facets (via `subjec` or `place`)
- Map view (lat/lon already in records — pending coverage audit)
- Timeline / date filter (via `sortda` — pending coverage audit)
- Address search (titles are address-shaped)
- Image zoom / deep zoom (IIIF tiles + OpenSeadragon)
- Story chrome (Millionaire's Row vertical = curated list of pointers rendered via same primitives)

---

## Integration with the enrichment interface

The harvest is not a patron-side concern only — it's the mechanism behind half of what [[../design/enrichment-interface-ux|enrichment-interface-ux]] already gestures at. Same pipeline, two outputs, three consumers.

**Implementation status (2026-05-24):** v0 pipeline shipped. Code lives in `harvest/`; pipeline-level spec promoted to [[harvest-pipeline]] per the §"Promotion path" trigger below. The rest of this section is the conceptual frame — what role the harvest plays and who consumes its outputs.

**Architectural frame:** [[data-architecture]] §"three-tier model." ContentDM (Tier 1) → enrichment store (Tier 2) → patron site (Tier 3). The harvest is the one-way arrow from Tier 1 into Tier 2.

### The harvest's seven jobs inside the enrichment tool

1. **Seeds the tool.** First run = bootstrap. All 11,685 records become rows in `photo_enrichment` with `contentdm_id` populated; every other field nullable. Without the harvest, the tool has nothing to enrich.
2. **Powers worklists** (Flow A, Home screen). *"Tremont — 22 photos missing geo"* is a left-join of harvested neighborhood tags against the enrichment store's `lat` column. Every Home worklist has this shape. **Harvest coverage of `subjec`/`place` directly bounds which worklists are honest.**
3. **Feeds the embedded ContentDM card** (Flow A, Principle 4). Pre-harvested card data, refreshed at sync time. Faster and more resilient than live iframe; the live ContentDM link is the escape hatch for stale records.
4. **Becomes the sync inbox** (Flow A.6, open question 7). Each run computes a `source_record_hash` per record (already in [[enrichment-schema]]). Hash changed since last run → inbox item. Three actions: accept / flag / ignore.
5. **Computes coverage for honest empty states** (Principle 7). *"12 enriched, 8 missing geo. Start →"* is the same join as worklists, cached at harvest time.
6. **Enables drive-by fix** (Flow B). `contentdm_id` is the universal join key between the public site's "edit this" button and the enrichment row.
7. **Backstops the Photos list search** (IA §Photos). Live `dmQuery` per keystroke is unworkable. Searching the harvest is sub-100ms. Same search-index emit as the patron snapshot, different consumer.

### Dual-output pipeline shape

One harvest run, two outputs, three downstream consumers:

```
ContentDM live
    ↓ paged dmQuery + per-record dmGetItemInfo
Tier 2 raw harvest (full fidelity — every field on every record)
    ↓ diff against last harvest (source_record_hash)
Sync inbox manifest (changes since last run)
    ↓ join with enrichment store
Worklists + coverage stats (cached)
    ↓ projection (subset of fields)
Tier 3 patron snapshot (lean: geo + date + title + thumbnail)
```

| Consumer | Needs from harvest |
|---|---|
| Enrichment tool (Tier 2) | Full ContentDM records · `source_record_hash` per record · change manifest · per-neighborhood gap counts |
| Patron landing (Tier 3) | `records.json` (lean subset) · `search-index.json` · `coverage.json` · `neighborhoods.json` |
| Both | `contentdm_id` as universal join key |

The patron output is a **projection** of the enrichment output — write the full version first, derive the lean version from it.

### Implications for the enrichment UX

- **Sync inbox is a Home-screen first-class citizen**, not an afterthought. The UX doc treats it as an open question (#7); the integration shape says it must be present from v0.
- **Worklist quality = harvest quality.** If a neighborhood is mis-tagged in ContentDM `subjec`/`place`, it doesn't appear as a worklist. This is an audit task for the harvest, not a UX problem.
- **The "ContentDM is one click away" affordance** stays exactly as Principle 4 specifies — but the *cached card* it shows is harvested, not live. Live link is the escape hatch.
- **Bulk actions** (IA §Photos) operate on the local enrichment store, not on ContentDM. Bulk *never* writes back upstream. The catalogers keep their authority over their system of record.

### Open questions this raises

- **Sync cadence.** Weekly probably fine for v0 (matches L&GH's pace of new digitizations). Nightly when staff start trusting it. Real-time webhook from OCLC — does it exist? (Already in [[data-architecture]] §"Open technical questions.")
- **Change-manifest UX shape.** Side-by-side diff? Inline strikethrough? Already an open question in [[../design/enrichment-interface-ux|enrichment-interface-ux]] §7.
- **First-run cost.** 11,685 records × per-record `dmGetItemInfo` call = ~12k API calls. Be polite — throttle, persist incrementally, resumable on failure. Should not run from a librarian's browser; needs a server-side job.

### Promotion path

This section pins the *integration shape* — what the harvest does and where its outputs land. It deliberately does not spec the pipeline implementation (throttle rates, retry logic, storage choice, change-detection algorithm).

**Status (2026-05-24): promoted.** Pipeline spec lives at [[harvest-pipeline]]. This section remains as the conceptual frame.

---

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-05-23 | Use ContentDM dmwebservices + IIIF directly from frontend, no proxy backend | Both APIs are open, CORS-enabled, no auth — proxy would be pure overhead |
| 2026-05-23 | Build-time harvest → static snapshot pattern | Faster runtime, no rate-limit risk, resilient to OCLC outage |
| 2026-05-23 | No escalation to John Skrtic yet | Docs (live API) answered the feasibility question; save the ask for when there's a specific blocker |
| 2026-05-23 | One harvest pipeline, two outputs (full for Tier 2, projected lean for Tier 3) | Patron snapshot is a subset of what the enrichment tool needs; building two pipelines duplicates ContentDM-pulling logic and risks drift |
| 2026-05-23 | Pipeline spec stays embedded in this doc until harvest code exists; then promote to standalone | Avoid over-formalizing before the spreadsheet test pressure-tests the schema |
| 2026-05-24 | Subset-first harvesting (one neighborhood at a time) instead of full cold pull | Faster iteration; per-neighborhood coverage numbers; real data quality issues surface early. Full pull still on menu when staff workflow stabilizes. |
| 2026-05-24 | Pipeline spec promoted to [[harvest-pipeline]] | Trigger fired — real code exists for two neighborhood subsets, both wired into both frontends |
| 2026-05-24 | Bbox-validate geo at projection time, reject coords outside Cleveland metro | Real cataloging errors (lng=lat) would otherwise project to off-canvas garbage. Bad coords surface as "missing geo" in the enrichment tool, which is where they should be fixed. |

---

## Next moves

- [x] ~~Write harvest script — paged `dmQuery` + per-record `dmGetItemInfo` → full-fidelity snapshot~~ (`harvest/harvest.mjs`)
- [x] ~~Derive lean patron projection (Tier 3 output) from the full snapshot~~ (`harvest/project.mjs`)
- [x] ~~Coverage audit: % of records with non-empty `sortda`, `latitu`, `longit`, `place`~~ (per [[harvest-pipeline]] §"Tier 3: `coverage.json`")
- [x] ~~Decide map-view strategy based on lat/lon coverage~~ ("map of what we have" — see §Caveats above)
- [x] ~~Sketch frontend data model~~ (`cleveland-map.jsx` `adaptHarvestedRecord` / `staff-app.jsx` `adaptHarvestedToStaff`)
- [x] ~~When harvest code exists → promote pipeline spec to `technical/harvest-pipeline.md`~~ (2026-05-24)
- [ ] Prototype IIIF deep-zoom integration (OpenSeadragon or Clover) — current patron detail panel uses a flat IIIF thumbnail
- [ ] Cold full-collection harvest (~40 min) when staff workflow stabilizes
- [ ] Build sync-inbox diff layer (`harvest/diff.mjs`) — hashes are stored but diffing not yet implemented
- [ ] Audit `subjec` / `place` quality across more neighborhoods so worklist counts in the enrichment Home dashboard can stop being hardcoded

---

## Reference

- ContentDM API index: https://help.oclc.org/Metadata_Services/CONTENTdm/Advanced_website_customization/API_Reference
- Live collection: https://cplorg.contentdm.oclc.org/digital/collection/p4014coll18
- IIIF Image API 2.1 spec: https://iiif.io/api/image/2.1/
