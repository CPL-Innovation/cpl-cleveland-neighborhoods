# Harvest

Implements the harvest pipeline specified in [`../technical/contentdm-api.md`](../technical/contentdm-api.md) §"Recommended architecture" and §"Integration with the enrichment interface."

Two-phase, single-output-per-tier:

```
ContentDM (Tier 1, live)
   │
   │  harvest.mjs:
   │    1. paged dmQuery → list of pointers
   │    2. dmGetItemInfo per pointer → full record
   │    3. sha256(record) → source_record_hash
   │
   ▼
data/tier2/records.jsonl  (Tier 2 — full fidelity, one JSON per line, resumable)
data/tier2/pointers.json  (cached enumeration so re-runs skip phase 1)
data/tier2/manifest.json  (counts + any missing pointers from this run)
   │
   │  project.mjs (Tier 2 → Tier 3 lean projection)
   │
   ▼
data/tier3/records.json        (id, title, date, lat/lng, neighborhood, IIIF thumb URL)
data/tier3/search-index.json   (flat {id, blob} for client-side substring search)
data/tier3/coverage.json       (answers the open "Caveats" questions in contentdm-api.md)
data/tier3/neighborhoods.json  (counts per neighborhood derived from `place`)
```

## Run

### Full collection

```
node harvest/harvest.mjs   # ~40 min cold run for ~11,685 records at 5 req/s
node harvest/project.mjs   # seconds — pure local transformation
```

Re-running `harvest.mjs` resumes — it skips any pointer already in `records.jsonl`.

### Subset (one neighborhood / facet)

Build the ContentDM search string as `field^term^mode^conn` (see [contentdm-api.md](../technical/contentdm-api.md) §"Live calls"), then:

```
node harvest/harvest.mjs --search 'subjec^Central neighborhood (Cleveland, Ohio)^exact^and' --out data/tier2-central
node harvest/project.mjs --in data/tier2-central --out data/tier3-central

node harvest/harvest.mjs --search 'place^Clark-Fulton neighborhood (Cleveland, Ohio)^exact^and' --out data/tier2-clark-fulton
node harvest/project.mjs --in data/tier2-clark-fulton --out data/tier3-clark-fulton
```

### Merge subsets for the frontends

The patron site and enrichment app both load `data/tier3-all/records.json`. After harvesting any new subset:

```
node harvest/merge.mjs
```

This walks every `data/tier3-*/` subdir and writes the deduped union to `data/tier3-all/`.

## Knobs

`harvest/harvest.mjs` constants near the top:

- `REQ_INTERVAL_MS` — throttle (default 200ms = 5 req/s; OCLC has no documented limit but it's a shared public service, be polite)
- `PAGE_SIZE` — dmQuery cap (1024, per docs)
- `MAX_RETRIES` — exponential backoff per failed call (default 4)

## What this implements vs. doesn't

- ✅ Phase 1 enumeration + Phase 2 per-record fetch + `source_record_hash`
- ✅ Resumable (append-only JSONL keyed by `contentdm_id`)
- ✅ Dual output: Tier 2 full + Tier 3 lean projection
- ✅ Coverage report (the spec's pending audit item)
- ❌ Sync inbox diff against previous run (next run computes new hashes; comparing them to last run is a future pass — needs a stable prior snapshot first)
- ❌ Cron / scheduled run (run manually for now)
- ❌ Tier 2 enrichment store schema (this writes only the harvested side; the enrichment store is a separate piece per `enrichment-schema.md`)
