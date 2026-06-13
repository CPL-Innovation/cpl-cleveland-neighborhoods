# Harvest Pipeline — Implementation Spec

> **Status:** v0 implementation, working code in `harvest/`. Promoted to a standalone doc 2026-05-24 per [[contentdm-api]] §"Promotion path" — trigger was real code existing for two neighborhood subsets (Central, Clark-Fulton), both wired into the patron site and the enrichment app.
>
> **What this is:** the implementation-level spec for the ContentDM harvest. Pipeline shape, schemas, throttle policy, file layout, failure modes. The *conceptual* frame ("what role does the harvest play, who consumes its outputs") lives in [[contentdm-api]] §"Integration with the enrichment interface."
>
> **What this is not:** a vendor brief, a CI/cron spec, or a backfill plan for the full 11,700-record collection. Those are TODO when v0 graduates.

---

## Pipeline shape

```
ContentDM live (Tier 1)
   │
   │  harvest.mjs:
   │    Phase 1 — paged dmQuery → list of pointers
   │    Phase 2 — dmGetItemInfo per pointer → full record
   │    Phase 3 — sha256(record) → source_record_hash
   │
   ▼
data/tier2-<slug>/records.jsonl   one JSON per line, append-only, resumable
data/tier2-<slug>/pointers.json   cached Phase 1 enumeration
data/tier2-<slug>/manifest.json   counts + missing pointers from this run
   │
   │  project.mjs (Tier 2 → Tier 3 lean projection)
   │    + Cleveland-bbox geo validation (rejects bad cataloged coords)
   │
   ▼
data/tier3-<slug>/records.json        slim: id, title, date, lat/lng, neighborhood, IIIF thumb
data/tier3-<slug>/search-index.json   flat {id, blob} for client-side substring search
data/tier3-<slug>/coverage.json       answers the "Caveats" questions in contentdm-api.md
data/tier3-<slug>/neighborhoods.json  counts per neighborhood derived from `place`
   │
   │  merge.mjs (subset union)
   │
   ▼
data/tier3-all/                  deduped union of every tier3-<slug>/ subdir
                                 (the file the patron site + enrichment app actually load)
```

Three scripts, three responsibilities. Each is rerunnable in isolation. No state outside the `data/` directory.

---

## Why subsets, not a single full pull

The collection has ~11,700 records. A cold full harvest is ~40 minutes against a shared public OCLC service. Working neighborhood-by-neighborhood means:

- Each new subset is ~30–60s, fast enough to iterate on
- We get *real* coverage numbers per neighborhood instead of waiting for a single big number
- Cataloging-error surface (see §"Real data quality findings") gets discovered incrementally
- Frontends consume the merged union; no frontend change required per new subset

The single full pull is still on the menu — it just isn't the v0 default. When the staff workflow stabilizes, a nightly full harvest (with the same throttle) is the natural production posture.

---

## File-level schemas

### Tier 2: `records.jsonl` (one record per line)

```json
{
  "contentdm_id": "9989",
  "contentdm_alias": "p4014coll18",
  "contentdm_url": "https://cplorg.contentdm.oclc.org/digital/collection/p4014coll18/id/9989",
  "iiif_info_url": "https://cplorg.contentdm.oclc.org/iiif/2/p4014coll18:9989/info.json",
  "last_synced_at": "2026-05-24T...",
  "source_record_hash": "a3f1b2…",
  "source": { /* full dmGetItemInfo response, every field as ContentDM returned it */ }
}
```

`source` preserves cataloger-side fields verbatim — including the `{}` sentinel ContentDM uses for empty values. Normalization happens at the Tier 3 step, not here.

### Tier 3: `records.json` (array)

```json
{
  "id": "9989",
  "title": "2175 Ashland Road, 2022",
  "date_display": "February 7, 2022",
  "sort_date": "2022-02-07",
  "lat": 41.50018,
  "lng": -81.64741,
  "neighborhood": "Central",
  "place_raw": "Central neighborhood (Cleveland, Ohio)",
  "subject": "Buildings--Ohio--Cleveland; Graffiti; Central neighborhood (Cleveland, Ohio)",
  "creator": "Jaenke, Adam",
  "rights": "This work is governed by a Creative Commons license. …",
  "rights_uri": "http://rightsstatements.org/vocab/InC/1.0/",
  "physical_location": "Cleveland Public Library. Photograph Collection.",
  "thumb": "https://cplorg.contentdm.oclc.org/iiif/2/p4014coll18:9989/full/400,/0/default.jpg",
  "iiif_info": "…/info.json",
  "contentdm_url": "…/id/9989"
}
```

Mapping from `source.<nick>` to Tier 3 follows the verified field schema in [[contentdm-api]] §"Collection field schema":

| Tier 3 field | ContentDM nick | Notes |
|---|---|---|
| `title` | `title` | as-is; titles are address-shaped |
| `date_display` | `date` | cataloger's human-readable string |
| `sort_date` | `sortda` | ISO date; coverage 96–97% in sampled subsets |
| `lat`, `lng` | `latitu`, `longit` | rejected if outside Cleveland bbox (see §"Real data quality findings") |
| `neighborhood` | `place` | extracted via regex (`/^([^()]+?)\s+neighborhood/i`); falls back to whole string |
| `place_raw` | `place` | original freetext kept for audit |
| `subject` | `subjec` | LCSH freetext, semicolon-separated |
| `creator` | `creato` | falls back to `contri` if empty |
| `rights` / `rights_uri` | `rights` / `standa` | URI is rightsstatements.org-shaped |
| `physical_location` | `locati` | unstructured, "Cleveland Public Library. Photograph Collection." common |
| `thumb` / `iiif_info` | derived | `/iiif/2/<alias>:<pointer>/full/400,/0/default.jpg` and `…/info.json` |

Empty ContentDM fields (`{}`) become `null`, never `"[object Object]"` — guard is in `project.mjs`'s `isEmpty` helper.

### Tier 3: `coverage.json`

Real coverage on the two sampled subsets (2026-05-24):

| Subset | total | `sortda` | `lat+lng` | `place` | `subject` | `rights_uri` |
|---|---|---|---|---|---|---|
| Central | 165 | 97.0% | 96.4% | 100% | 100% | 100% |
| Clark-Fulton | 99 | 96.0% | 78.8% | 100% | 100% | 100% |
| Merged (264) | 264 | 96.6% | 89.8% | 100% | 100% | 100% |

This is the answer to the "Caveats & open questions" item in [[contentdm-api]] that said `sortda` coverage was "patchy" and `latitu`/`longit` coverage was "unknown." Empirically: `sortda` is solid, geo coverage is neighborhood-dependent and high where Brian has been working.

---

## Throttle & retry policy

`harvest.mjs` constants near the top:

| Knob | Default | Rationale |
|---|---|---|
| `REQ_INTERVAL_MS` | 200 (5 req/s) | OCLC has no documented limit; this is "polite" against a shared public service |
| `PAGE_SIZE` | 1024 | `dmQuery` cap per [[contentdm-api]] §"API surfaces" |
| `MAX_RETRIES` | 4 | exponential backoff (500 ms × 2ⁿ) per failed call |

Throttle is enforced via a single `lastReq` timestamp — every call awaits a 200ms gap regardless of which function it's calling. No request bursts.

Failure modes:
- **Transient HTTP/network failure** → retry with backoff up to 4 attempts, then log and skip the pointer (Phase 1 records this as a missing pointer in `manifest.json`; Phase 2 logs to stderr).
- **OCLC `code: "-2"` response** → treated as an error, same retry path. Most often means a malformed search string or an alias that doesn't exist.
- **Crash mid-Phase-2** → rerun. JSONL append + pointer-set deduplication means the next run picks up exactly where the previous one stopped.

---

## Resumability

- Phase 1 enumeration is cached in `pointers.json`. Delete that file to re-enumerate; otherwise the second run skips Phase 1 entirely.
- Phase 2 is keyed by `contentdm_id` against existing JSONL lines. The script computes "remaining" as `pointers - already_harvested` at the start of each run.
- `manifest.json` is recomputed at the end of every run and lists any pointers that the harvester knew about but didn't successfully fetch. This is the audit log.

---

## Real data quality findings (surfaced by the pipeline)

These are bugs in the source data that the pipeline discovered. Each one is upstream — they should be fixed in ContentDM, not patched in the harvest. The pipeline's job is to surface them, not silently correct them.

- **lng = lat copy-paste error** (Clark-Fulton, 5 records, Iglesia Voz Que Clama en el Desierto cluster): both lat and lng fields hold the same value (~41.46). Pre-fix, these records projected to viewBox x ≈ 308,000 (off-screen by orders of magnitude). The Cleveland bounding-box guard in `project.mjs` (`latMin: 41.30, latMax: 41.70, lngMin: -82.00, lngMax: -81.40`) rejects them. They appear as `lat: null, lng: null` in Tier 3 and will surface in the enrichment tool's "missing geo" worklist — which is exactly the right place to fix them.
- **Geo coverage is neighborhood-dependent.** Random 10-record sample across the collection showed 0% lat/lng. Central showed 96.4%. Clark-Fulton showed 78.8%. Brian has been working geo on specific neighborhoods; the coverage map is uneven and that's an artifact worth knowing about before promising "map view" for the full collection.

---

## Sync inbox (deferred)

Per [[contentdm-api]] §"Integration with the enrichment interface" item #4: `source_record_hash` is computed and stored on every record so a future run can diff against the prior snapshot to produce a sync inbox. This is implemented at the *hashing* layer (sha256 of sorted-keys JSON, 16-char prefix) but the *diffing* layer is not yet built — it needs a stable prior snapshot to diff against, which means at least one re-harvest after some upstream change.

When the diff layer ships, it lives in this repo as `harvest/diff.mjs`, reads two `records.jsonl` files, and emits a manifest of `{added, changed, removed}` pointers.

---

## What's not in scope for v0

- **Bulk full-collection harvest.** Scripts support it (`node harvest/harvest.mjs` with no `--search` flag harvests everything), but it hasn't been run. ~40 min cold, single-run.
- **Cron / scheduled job.** Manual `node harvest/harvest.mjs && node harvest/project.mjs && node harvest/merge.mjs` for now.
- **Server-side hosting.** The scripts run locally; output JSON gets committed (or in production, would get uploaded to object storage + CDN).
- **Webhook from OCLC.** Existence not yet confirmed; until then, polling diff is the model.
- **Compound objects.** Collection `p4014coll18` is flat single-image records throughout (per [[contentdm-api]] §"API surfaces"). When/if a compound collection is harvested, `GetParent` / `GetCompoundObjectInfo` calls need to be added.

---

## Reference

- [`harvest/README.md`](../harvest/README.md) — operator-level run instructions, the *how*
- [[contentdm-api]] — API research + integration shape, the *what and why*
- [[enrichment-schema]] — Tier 3 fields are what the enrichment tool consumes; this doc's mapping table is the inverse view
