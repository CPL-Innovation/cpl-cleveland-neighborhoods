# Data Architecture — v0 Hypothesis

> **Status:** v0 working hypothesis, hardening. Drafted 2026-05-23; updated 2026-05-24 after the harvest pipeline and both frontends shipped against real data ([[contentdm-api]] research landed, then [[harvest-pipeline]] was promoted). Three-tier model still holds; most of the original "Open technical questions" are now answered. Tier 2 enrichment store is still hypothetical — no schema has been pressure-tested against ~30 real records in a spreadsheet yet.
>
> **Audience:** internal (Jungu first, future collaborators/vendors second). Not patron-facing.

---

## Why this doc exists

The MVP (Direction A in [[../strategy/STRATEGY.md|STRATEGY]]) is API-shaped: ContentDM is the source of truth, the discovery interface reads from it. But ContentDM is a *catalog* system, not an *experience* system. Its metadata is built for cataloger workflows — title, creator, subject heading, rights — not for place-based discovery, interpretive overlay, story curation, or community contribution.

This means the architecture almost certainly needs a **middle, library-facing enrichment layer** sitting between ContentDM and the public interface. This doc captures that hypothesis before it ossifies into a build.

---

## The three-tier model

```
┌──────────────────────────────────────────────────────────┐
│  TIER 1 — Source of Truth                                │
│  ContentDM (OCLC-hosted, CPL-managed)                    │
│  Owner: Photograph Collection Librarian (Brian Meggitt), │
│         Local & Global History, ultimately John Skrtic   │
│  Authority: cataloging standards, rights, accession      │
└─────────────────────────────┬────────────────────────────┘
                              │  one-way pull (read-only)
                              │  joined by stable ContentDM ID
                              ▼
┌──────────────────────────────────────────────────────────┐
│  TIER 2 — Enrichment Store (the middle layer)            │
│  Where extra fields, interpretive content, curation,     │
│  community contributions, and quality flags live.        │
│  Owner: TBD — open stakeholder question (see below)      │
│  Authority: experience design, public surfacing          │
└─────────────────────────────┬────────────────────────────┘
                              │  API
                              ▼
┌──────────────────────────────────────────────────────────┐
│  TIER 3 — Public Discovery Interface                     │
│  The patron-facing web experience (Direction A).         │
│  Map-led, with story trails, time-slider, annotation     │
│  layers. See design/mvp-interface-sketch.                │
└──────────────────────────────────────────────────────────┘
```

---

## Core principles

1. **ContentDM is read-only from our side.** Catalogers keep their authority over their system of record. The enrichment store joins by stable ContentDM record ID; if a catalog record changes, the sync notices and flags it — we never fight over who owns the title field.

2. **Tier 2 is two decisions, not one.**
   - The **enrichment data store** (the schema, the database) — could be Postgres, Airtable, a headless CMS (Directus / Strapi / Sanity), or — for v0 — a spreadsheet.
   - The **library-facing interface** (the thing humans actually use to add enrichment) — could be custom admin, a CMS's built-in UI, or just the spreadsheet itself.
   These get decided separately.

3. **Schema is a hypothesis, not a spec.** Test the enrichment shape in a spreadsheet against ~30 records from one block before building any tooling around it. If the fields are wrong, discover that cheap.

4. **Who does enrichment is a stakeholder question, not a tooling question.** Workflow for one full-time cataloger looks nothing like workflow for crowdsourced branch contributions. Answer this *before* picking the interface.

5. **Tier 2 must not duplicate ContentDM's job.** No re-storing canonical metadata. Only fields ContentDM cannot or should not hold.

---

## Enrichment fields — drafted

**v0 schema draft lives in [[enrichment-schema]]** (drafted 2026-05-23 by walking the MVP interface sketch feature by feature).

Field families it covers, across five entities:

- **`photo_enrichment`** (1:1 with ContentDM records): geo, time, interpretive (patron caption + librarian's note), curation/routing, then-and-now metadata, quality flags, normalized rights display, physical-archive footprint.
- **`stories`** + **`story_photos`** join: curated exhibits in article or map-trail format.
- **Controlled vocabularies**: neighborhoods, branches, themes, staff, physical locations.
- **`places` / `people`** (optional v0): named-entity cross-linking.
- **`memory_contributions`**: Direction D + memory threads, shaped for MVP placeholder.

**Next move on the schema:** the spreadsheet test described in `enrichment-schema` §"How to test this schema cheap." 30 photos, one quiet afternoon. Bring to the Wed 5/27 meeting as a discussion object, not a fait accompli.

---

## Open technical questions

### Resolved (by [[contentdm-api]] + [[harvest-pipeline]], 2026-05-23 → 2026-05-24)

- ~~**IIIF posture.**~~ **Yes — IIIF Image API 2.1 Level 2, CORS-enabled, no auth.** In use today via flat thumbnail URLs in both frontends. Deep-zoom (OpenSeadragon/Clover) is a downstream prototype.
- ~~**Image delivery.**~~ **Hot-link via IIIF.** No binaries pulled. Rights enforcement lives in `rights_display` metadata, not in image hosting.
- ~~**ID strategy.**~~ **ContentDM `pointer` is the stable join key**, used as `contentdm_id` everywhere. Working in production. Stability across re-ingest still TBD on long horizon, but the API treats it as canonical.
- ~~**Sync mechanism shape.**~~ **Build-time harvest → static snapshot, dual output** (Tier 2 full / Tier 3 lean projection), with `source_record_hash` per record ready for a future diff layer. See [[harvest-pipeline]].
- ~~**Tile / map layer.**~~ **Leaflet + CARTO Positron tiles** (warm-toned via CSS filter for paper-map aesthetic). Chosen 2026-05-24 when the patron map upgraded from the stylized SVG to a real geographic base. Historical map overlays remain a downstream feature.

### Still open

- **Sync cadence.** Weekly for v0; nightly when staff trust it. **Open sub-question:** does OCLC expose any change-feed or webhook, or do we always diff against the previous full pull?
- **Storage choice for v0.** Spreadsheet → Airtable → headless CMS → custom Postgres. Climb the ladder only when current rung breaks. Spreadsheet test (per [[enrichment-schema]] §"How to test this schema cheap") will pressure-test the bottom rung.
- **Hosting.** CPL IT constraints unknown. Patron frontend is genuinely static (snapshot + live IIIF), so hosting is only a question for the enrichment store and the librarian-facing interface — *not* the patron map.
- **Harvest job ownership.** Cold full-collection run is ~40 min, ~12k API calls. Should not run from a browser. Where does the harvest cron live? (Tied to "Hosting" above.) v0 is "Jungu runs it manually."
- **Sync inbox diff implementation.** Hashes are in place; the diff layer isn't built yet. Needs a stable prior snapshot to diff against.

---

## Open stakeholder/political questions

These do not belong in a technical doc as decisions, but flagging them here because they constrain technical choices. They live in [[../strategy/STRATEGY.md]] as project-level open questions.

- **Who owns enrichment labor at CPL?** Librarians with what time? Branch staff? Interns? Moderated community contribution?
- **Does CPL have appetite for a library-facing enrichment interface as part of this project's institutional footprint?** This implies ongoing labor, governance, and ownership — not a "figure it out later" detail.

---

## What this doc is not

- Not a build spec. No tech stack committed.
- Not a vendor brief. Could become input to one later.
- Not strategy. Strategic implications get surfaced in `strategy/`; this doc focuses on the technical shape.

---

## Provenance

Drafted 2026-05-23 during a Claude conversation about whether a behind-the-scenes enrichment layer is needed alongside the ContentDM-fed discovery interface. The instinct ("we'll probably need a middle layer") was the user's; this doc captures and sharpens it. See journal entry of the same date.
