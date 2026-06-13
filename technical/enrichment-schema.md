# Enrichment Schema — v0 Draft

> **Status:** v0 working draft. Drafted 2026-05-23 by walking each MVP feature in [[../design/mvp-interface-sketch]] and asking *"what data does this need that ContentDM almost certainly doesn't hold in a usable form?"*
>
> **What this is:** a flat field list with rationale per field, organized by entity. The shape, not the storage. Schema is a hypothesis — pressure-test against ~30 real records in a spreadsheet before any tooling gets built around it.
>
> **What this is not:** a database spec, a column-by-column DDL, or a vendor brief. No types committed beyond "string / number / date / bool / enum / array / FK." No indexes, no constraints.
>
> **Architectural frame:** [[data-architecture]]. ContentDM stays the source of truth for cataloger-owned fields (title, creator, accession, original rights statement). This schema only holds what ContentDM cannot or should not.

---

## Audit step that must happen first

Before any of these fields gets built, walk through the list and mark each:

- **C** — ContentDM already holds this in usable form → don't duplicate, just pull
- **C\*** — ContentDM holds something *close* but unusable (freetext where structured is needed, etc.) → pull + normalize into the enrichment store
- **E** — Enrichment-only; ContentDM does not hold this and shouldn't → lives in our store

The current draft assumes worst-case (everything is E) because we don't yet have the ContentDM API picture. Update once that research lands.

---

## Entity 1 — `photo_enrichment` (1:1 with ContentDM records)

The main table. One row per ContentDM photo record. Joins to ContentDM on stable record ID.

### Identity & sync

| Field | Type | Source | Rationale |
|---|---|---|---|
| `contentdm_id` | string (PK) | system | Stable join key to ContentDM. Primary key of this table. |
| `contentdm_url` | string | system | Direct link back to canonical catalog record. For audit & deep-link. |
| `last_synced_at` | datetime | system | When we last pulled this record from ContentDM. |
| `source_record_hash` | string | system | Hash of the catalog record fields we care about. Detects upstream changes; flags review. |
| `enrichment_version` | int | system | Bumped when a librarian edits an enrichment field. For diffs & rollback later. |

### Geo (powers map, "you are here", neighbors-in-time, neighborhood browse)

| Field | Type | Source | Rationale |
|---|---|---|---|
| `lat` | number | librarian / staff (Brian is already doing this) | Map placement. ContentDM may carry an address string but not structured coords. |
| `lng` | number | librarian / staff | Same. |
| `geo_confidence` | enum(`exact`, `block`, `intersection`, `neighborhood`, `unknown`) | librarian | Powers "exact dot" vs "fuzzy cluster" map rendering. Honest about uncertainty. |
| `geo_source` | enum(`caption`, `verified_address`, `staff_lookup`, `patron_contribution`, `inferred`) | librarian | Provenance for the coord. Matters when corrections come in. |
| `neighborhood_tag` | FK → `neighborhoods` | librarian | **Controlled vocab matching branch service areas.** Not derived from a freetext subject heading. Powers neighborhood browse + branch routing. |
| `secondary_neighborhood_tag` | FK → `neighborhoods` (nullable) | librarian | Edge photos (border streets) belong to two places. |
| `branch_service_area` | FK → `branches` | derived from `neighborhood_tag` | Cached for "Visit [Branch] to see more" + future branch portals. Derivation, not a separate truth. |

### Time (powers year filter, time-slider, "neighbors in time", decade browse)

| Field | Type | Source | Rationale |
|---|---|---|---|
| `date_start` | date | librarian / normalized from ContentDM | The earliest plausible year. Catalogers write "circa 1920s" — we need numbers for sliders. |
| `date_end` | date | librarian / normalized | Latest plausible year. For "circa 1920s" → 1920–1929. |
| `date_precision` | enum(`exact`, `year`, `decade`, `era`, `unknown`) | librarian | UI label honesty ("1922" vs "1920s" vs "early 20th century"). |
| `date_display` | string | librarian | Human-readable label for the photo detail view (preserves cataloger phrasing if needed). |

### Interpretive (powers photo detail view, patron-facing captions)

| Field | Type | Source | Rationale |
|---|---|---|---|
| `patron_caption` | text (short) | librarian | One-sentence "what you're looking at." Distinct from cataloger title, which is often technical ("View NE from intersection of..."). |
| `librarian_note` | text (long, markdown) | librarian | The "Librarian's Note" feature from sketch §3. Optional. The thing no peer institution has on this collection. |
| `librarian_note_author` | FK → `staff` | librarian | Surfaces "Curated by Brian Meggitt" / "Note by Lisa Sanchez." Staff visible, not invisible. |
| `librarian_note_updated_at` | datetime | system | For review cadence and audit. |
| `story_hook` | text (short, nullable) | librarian | Why this photo is interesting in 1–2 sentences. Used for Story of the Week selection, share-card text, social. |

### Curation & routing

| Field | Type | Source | Rationale |
|---|---|---|---|
| `public_status` | enum(`draft`, `ready`, `featured`, `hidden`) | librarian | Whether the photo surfaces in the public interface. `hidden` lets us pull from ContentDM without surfacing problematic items without round-tripping to catalog. |
| `featured_weight` | int (nullable) | librarian | For Story of the Week rotation, hero placements. Higher = more likely to surface. |
| `themes` | array<FK → `themes`> | librarian | Controlled vocab — powers theme browse (lost buildings, streetcars, markets, schools, residential, commercial, civic, transit, people-at-work, etc.). |

### Then-and-now (powers the sketch's highest-impact micro-interaction)

| Field | Type | Source | Rationale |
|---|---|---|---|
| `rephoto_eligible` | bool | librarian | Has the location been verified as reproducible from modern Street View / standing position? |
| `rephoto_bearing` | number (degrees, nullable) | librarian | Direction the original photographer was facing. Lets the modern overlay align without guessing. |
| `rephoto_modern_lat` / `_lng` | number (nullable) | librarian | Where to *stand* to reproduce the shot, if different from the geocoded subject location. |
| `rephoto_notes` | text (nullable) | librarian | "Original sidewalk is gone; closest standing position is across the street." |

### Quality / readiness

| Field | Type | Source | Rationale |
|---|---|---|---|
| `caption_quality` | enum(`good`, `needs_rewrite`, `auto_only`) | librarian | Flags for batch caption-rewrite workflows. |
| `metadata_gap_flags` | array<enum(`location`, `date`, `building`, `person`, `caption`)> | librarian or system | Drives the "Help Us Identify" feature (Direction D). Each flag = a specific gap patrons or staff could fill. **System should auto-populate from harvest** — e.g. empty `latitu` → `location` flag, and `latitu == longit` (real cataloging error pattern, see [[harvest-pipeline]] §"Real data quality findings") → `location` flag with a "suspicious geo" sub-reason. |
| `accessibility_alt_text` | text | librarian or generated | Mandatory for screen readers; library mandate. Distinct from caption. |

### Rights display

| Field            | Type                                                                     | Source                                             | Rationale                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `rights_display` | enum(`public_domain`, `display_only`, `contact_for_reuse`, `restricted`) | derived from ContentDM rights + librarian override | The pill shown in the UI. Normalizes the long-form rights statement into something a patron understands in one glance.         |
| `rights_notes`   | text (nullable)                                                          | librarian                                          | Anything legal/Brian-Meggitt-flagged that should travel with the photo.                                                        |
| `reuse_cleared`  | bool                                                                     | librarian / Legal Brian                            | Specifically "yes, we have cleared this for creative remix / AI manipulation." Most will be false; pre-1931 will default true. |

### Physical-archive footprint (powers "Where in CPL" — sketch §6)

| Field | Type | Source | Rationale |
|---|---|---|---|
| `physical_location` | FK → `physical_locations` (nullable) | cataloger / librarian | Which branch, collection, box, shelf the print lives in. May or may not be in ContentDM — confirm. Powers "discovery interface as finding aid" feature. |
| `request_scan_eligible` | bool | librarian | Whether "Request a scan" CTA should surface. |

---

## Entity 2 — `stories` (curated exhibits — blog or map-trail format)

One row per curated story (Millionaire's Row, Public Square, West Side Market, etc.). Stories are the second pillar of the MVP after the map itself.

| Field | Type | Source | Rationale |
|---|---|---|---|
| `id` | string (PK) | system | |
| `slug` | string | librarian | URL-friendly identifier. |
| `title` | string | librarian | |
| `subtitle` | string (nullable) | librarian | |
| `format` | enum(`article`, `map_trail`, `hybrid`) | librarian | Sketch §4 distinction. Drives the rendering shape. |
| `author` | FK → `staff` | librarian | "Curated by Brian Meggitt." Required, not optional — staff visible. |
| `co_authors` | array<FK → `staff`> | librarian | Lisa-and-Brian collaborations etc. |
| `body_markdown` | text | librarian | For article-format. Map-trail format may be empty or used for intro/outro only. |
| `hero_photo_id` | FK → `photo_enrichment` (nullable) | librarian | Card image for story listings, social shares. |
| `status` | enum(`draft`, `published`, `featured`, `archived`) | librarian | |
| `featured_weight` | int (nullable) | librarian | For Story of the Week rotation. |
| `themes` | array<FK → `themes`> | librarian | For "more stories like this." |
| `neighborhoods` | array<FK → `neighborhoods`> | librarian | For neighborhood-page surfacing. |
| `published_at` | datetime | librarian | |
| `updated_at` | datetime | system | |

### Join table — `story_photos`

The map-trail format is *photos in sequence*. This is its own entity because the per-photo, in-story librarian note (which differs from the photo's general `librarian_note`) needs to live somewhere.

| Field | Type | Source | Rationale |
|---|---|---|---|
| `story_id` | FK → `stories` | system | |
| `photo_id` | FK → `photo_enrichment` | system | |
| `sequence` | int | librarian | Order within the story / trail. |
| `note_in_story` | text (markdown) | librarian | Per-story commentary on this photo. Different from `librarian_note`; story-specific framing. |
| `trail_transition` | text (nullable) | librarian | "Walk one block north to the next stop." For map-trail format only. |

---

## Entity 3 — `controlled_vocabularies`

Small lookup tables. Cheap, but they're what makes filters honest.

### `neighborhoods`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `name` | string | "Tremont," "Hough," "Glenville." |
| `aliases` | array<string> | "Central" includes historic alternative names. |
| `boundary_geojson` | text (nullable) | For drawing on the map. Use Cleveland's official Statistical Planning Areas as the base. |
| `primary_branch` | FK → `branches` (nullable) | The branch whose service area covers most of this neighborhood. |

### `branches`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `name` | string | "Tremont Branch," "Hough Branch." |
| `address` | string | |
| `lat` / `lng` | number | For map placement. |
| `service_area_neighborhoods` | array<FK → `neighborhoods`> | Many-to-many. |

### `themes`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `name` | string | "Lost buildings," "Streetcars," "Markets," etc. |
| `description` | string | What qualifies a photo for this tag — keeps the vocab disciplined. |

### `staff`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `display_name` | string | "Brian Meggitt." |
| `title` | string | "Photograph Collection Librarian." |
| `bio_short` | text | One-paragraph bio for "Curated by" surfaces. |
| `headshot` | string (nullable) | Optional. |

### `physical_locations`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `branch` | FK → `branches` | |
| `collection_name` | string | |
| `box` / `shelf` | string (nullable) | |
| `access_notes` | string (nullable) | "Appointment required," etc. |

---

## Entity 4 — `places` and `people` (optional v0; high-leverage if we build them)

Not strictly required for MVP, but cheap to scaffold and they make cross-linking actually work. Decide whether to defer.

### `places` (named entities like "Statler Hotel," "League Park")

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `name` | string | |
| `aliases` | array<string> | |
| `lat` / `lng` | number | |
| `era_start` / `era_end` | date (nullable) | When the place existed. Powers "this corner had a different building before / after." |
| `description` | text | |
| `neighborhood` | FK → `neighborhoods` | |

### `people` (only if needed for collection — likely thin in MVP)

Defer unless a curated story requires it.

### Join tables

- `photo_places` (M:M between photo and named place)
- `photo_people` (M:M)

---

## Entity 5 — `memory_contributions` (Direction D + memory threads — MVP placeholder)

Per sketch §8 + sketch §10: invitation UI ships in MVP; full moderation backend may be later. The shape, so we can stub the form:

| Field | Type | Source | Rationale |
|---|---|---|---|
| `id` | string (PK) | system | |
| `photo_id` | FK → `photo_enrichment` (nullable) | system | Some contributions attach to a photo; some attach to a place or general thread. |
| `place_id` | FK → `places` (nullable) | system | |
| `contributor_name` | string (nullable) | patron | Anonymous allowed. |
| `contributor_email` | string (nullable) | patron | For follow-up, not display. |
| `contribution_type` | enum(`memory`, `identification`, `correction`, `additional_photo`) | system | Different review flows. |
| `body` | text | patron | |
| `submitted_at` | datetime | system | |
| `moderation_status` | enum(`pending`, `approved`, `rejected`, `flagged`) | librarian | |
| `moderated_by` | FK → `staff` (nullable) | librarian | |
| `moderation_notes` | text (nullable) | librarian | |
| `public_display` | bool | librarian | Approved ≠ surfaced — separate decision. |

---

## What gets derived (not stored)

To prevent schema sprawl, these are computed from the above, not stored as fields:

- **"Other photos of this address"** — query on `lat` / `lng` proximity.
- **"Photos from this year nearby"** — query on `lat` / `lng` + `date_start` / `date_end` overlap.
- **"Neighbors in time" sidebar** — same query, different framing.
- **Density heatmap / sparse neighborhood empty states** — aggregate counts on `neighborhood_tag`.
- **Decade browse** — group on `date_start` / 10.
- **Branch portal feeds** — filter on `branch_service_area`.

---

## Open schema questions

1. ~~**Does ContentDM already hold geo coords in any usable form?**~~ **Answered 2026-05-24.** Yes — `latitu` and `longit` are TEXT fields populated where Brian has done the work. Coverage is **neighborhood-dependent**: 96.4% in Central, 78.8% in Clark-Fulton, ~0% in randomly sampled records elsewhere. Workflow implication: our `lat`/`lng` is *seeded* from ContentDM where present and *authored* in our enrichment store where absent. The geo cataloging is not a clean one-source-of-truth situation; both ContentDM and the enrichment store will hold coords for different records. (See [[harvest-pipeline]] §"Tier 3: `coverage.json`" for numbers, §"Real data quality findings" for the lng=lat error pattern uncovered in 5 Clark-Fulton records.)
2. **Where do controlled vocabularies live?** In the enrichment store, or do we mirror ContentDM's subject headings? If catalogers maintain a neighborhood subject term, do we override or accept?
3. **Themes vocabulary — who defines it?** Catalogers, librarians, or me as a designer? This is a small political question with big downstream UX consequences.
4. **Rights normalization — is the `rights_display` mapping algorithmic or manually curated?** Most likely manually curated for v0 (low volume), algorithmic later.
5. **Do we need a `photo_relations` table for *non-spatial, non-thematic, manually curated* "see also" links?** ("These two photos document the same demolition five years apart.") Probably yes, but defer until a librarian asks for it.
6. **Versioning depth.** `enrichment_version` is a counter. Do we need full historical diffs, or just the current state + an audit log of who-edited-when? Almost certainly the latter for v0.
7. **Story format `hybrid`** — do we actually need three formats, or is the article-vs-trail binary enough?

---

## How to test this schema cheap (the actual next move)

Per [[data-architecture]] §3: build a spreadsheet, not a CMS.

1. Pick 30 photos. Suggested: a single block of Euclid Avenue from the Millionaire's Row corridor (rights-clean, well-documented, and aligned with the planned MVP launch story).
2. Create a Google Sheet with one row per photo, one column per field in Entity 1 (`photo_enrichment`).
3. Hand-fill it. Time it. Note which fields are easy, which are guesswork, which require Brian to weigh in.
4. Build a throwaway map prototype (React + Mapbox or similar) that reads the sheet via CSV export. See what it feels like.
5. If a field is never used by the prototype, kill it from the schema. If a field is missing, add it.
6. Bring the sheet + prototype to the Wed 2026-05-27 meeting with Brian + Lisa + Olivia as a discussion object — *"is this the right shape?"* — not as a fait accompli.

**Time budget for steps 1–4: one quiet afternoon.** No more. If it slips past that, the schema is wrong or the prototype is wrong; figure out which.

---

## Provenance

Drafted 2026-05-23 by walking each feature in [[../design/mvp-interface-sketch]] and asking what data it requires beyond ContentDM. v0 — expect roughly half these fields to change after the spreadsheet test.
