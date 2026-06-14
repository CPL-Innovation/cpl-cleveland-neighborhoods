---
type: log
status: active
created: 2026-06-12
---

# Scan & Interpret Pipeline — UX Sketch

> **Last updated:** 2026-06-13 · v1.0 · status: built (Tier 1)

> **Implementation note (v1.0):** the pipeline is now built and live at `/staff → Ingest → Scan
> pipeline`. Where the build diverged from this design sketch, the **current truth is the
> reference docs** ([`docs/architecture.md`](../docs/architecture.md), [`docs/api.md`](../docs/api.md),
> [`docs/data-model.md`](../docs/data-model.md), [`scan/README.md`](../scan/README.md)) and the code
> (`lib/types.ts`, `drizzle/schema.ts`). Two sections below are **superseded** — see the v1.0
> changelog entry: the verdict model collapsed `flag` away (§"Verdict & edit behavior"), and
> Surface A grew from a "deliberately thin" status panel into a worklist sheet with in-app
> ingest/un-ingest (§"Surface A").

> Modes, flows, and operating principles for the **scan-and-interpret pipeline** as a page inside the library-facing enrichment interface. The surface where freshly digitized box-scan photos get derived, machine-interpreted by a single VLM pass, and human-reviewed photo-by-photo. Visual style out of scope.
>
> **Parent interface:** [[enrichment-interface-ux]] · [[enrichment-interface-features]] — this is a new page *inside* that tool, not a new tool.
> **Schema it writes into:** [[enrichment-schema]].
> **The handling protocol upstream of it:** [[01 Develop/CPL Cleveland Neighborhoods/technical/box-scan/scan-sop.md]].
> **Filename = CHC ID.** The only datum captured by hand at scan time: the operator reads the CHC ID off the verso and names the file `<CHC_ID>.tif`. No manifest, no condition notes for this pilot — the master TIFF *is* the condition record. The answer key for address/year is the handwriting in the photo itself.
> **The AI-metadata ambition it serves:** [[john-ai-metadata-plan]] (ceiling) scoped to PoC (floor).

---

## Build handoff context (self-contained — read this first)

> Orientation for a coding agent implementing this as a new component inside the enrichment interface it already built. This section de-references the vault links and jargon used elsewhere in the doc so the file stands alone. The rest of the doc is the UX intent; this section is the contract.

### What you're building

One new top-level area — **Ingest → Scan Pipeline** — added to the existing **library-facing enrichment interface** (the staff app you already built). Two views inside it:

1. **Pipeline Run** — a thin, read-only job-status panel. Not a workspace. (See §"Surface A.")
2. **Review & Interpret** — the per-photo screen where a human verifies the machine's output. The heart of the feature; build it by reusing the patterns of your existing record-edit view. (See §"Surface B.")

Match the existing interface's stack, component conventions, auth/roles, and data store. This is a page *inside* that app, not a new app.

### Glossary (terms used throughout this doc)

- **CHC ID** — the canonical identifier for a photo, e.g. `CHC019059`. Used verbatim as the master filename (`CHC019059.tif`). It is the record key for these photos.
- **TIFF master** — the archival 600dpi scan. Never mutate it. **JPEG derivative** — a web-friendly copy generated from the master; this is what the VLM and the UI use.
- **VLM** — vision-language model (an AI that takes an image and returns text/structured data). This pipeline calls one **cloud VLM API per photo**, behind a small `vlmExtract(jpeg)` adapter so the model/provider is a config swap, not a code change. **Engine is chosen by a bake-off, not pre-committed** (see §"VLM call" — front-runner: Gemini 3 Flash; Opus is overkill). (NEOBA — a separate broadcast-footage project — is *not* the engine here; ignore any lingering mention of it.)
- **ContentDM** — CPL's catalog system of record. The box-scan photos are **not** in it (they're net-new digitizations). Mentioned elsewhere only for context; you don't integrate with it for this feature.
- **`photo_enrichment`** — the photo record/table your enrichment interface already reads and writes. Scan-pipeline output lands here. Relevant fields listed under "On accept" below.
- **Manifest** — a deliberately-killed idea. There is **no** sidecar metadata file. Ignore any lingering mention.

### Input

- A folder of **TIFF masters**, each named `<CHC_ID>.tif`. The filename is the only provided metadata — it *is* the record key.
- That's all. No manifest, no CSV, no per-photo sidecar.

### Pipeline stages (what Surface A executes)

1. **Discover** all `*.tif` in the input folder.
2. **Derive** a JPEG per master into a separate `derivatives/` folder (never write back into `masters/`). **Spec: resample the master from 600→300dpi, JPEG quality 85, sRGB, bake in rotation, strip EXIF.** Resample by *DPI*, not by pixel long-edge, so heterogeneous print sizes/ratios all keep the same physical detail density (handwriting stays equally legible on a wallet print and an 8×10). Read the TIFF's stored density to compute the scale factor rather than assuming 600. 300dpi is plenty for both the VLM (it downsamples anyway) and the reviewer's zoom; don't over-spec — JPEG quality is not the bottleneck, the model's handwriting ability is. **Normalize on derive:** force **8-bit**, **RGB** (grayscale→RGB), **single-page** (flatten if multi-page), **ICC→sRGB** — archival TIFFs are often 16-bit / grayscale / LZW-compressed and will otherwise crash the encoder or silently mis-derive on a subset of the box.
3. **Call the VLM** once per JPEG → structured metadata (below).
4. Mark each photo **ready to review**. Surface A only reports progress and itemizes failures; it does no editing.

### VLM call — the `vlmExtract(jpeg)` adapter

One cloud VLM call per photo, wrapped in a `vlmExtract` adapter so the rest of the pipeline never sees the provider's wire format. **Which model is a bake-off decision, not a default** — see below.

- **Model — chosen empirically (cost is noise for 250 images: ~$0.26–$3.50 for the whole run on any model).** Run ~20 prints through **Gemini 3 Flash**, **Claude Sonnet 4.6**, and **GPT-5 mini**, score on the two axes below, pick the winner for the full 250. **Opus is overkill** — not even the OCR leader, top of the price chart. If you want a single default without the bake-off, use **Gemini 3 Flash** (current OCR-Arena #1, cheap, fast). Keep the model a config constant.
- **Mechanics:** all three providers take a **base64 image + text instruction** and return JSON. Send one image block + the prompt; **use the provider's structured-output / JSON-schema mode** (Claude `output_config.format` / `messages.parse`; OpenAI structured outputs; Gemini `responseSchema`) so the response is schema-guaranteed — never parse free text.
- **Prompt:** the exact instruction (and the era-honesty constraints that govern the description) live in the evolving **[[01 Develop/CPL Cleveland Neighborhoods/design/vlm-description-spec.md|VLM description spec]]** — load it from there, don't hardcode prose here. In brief: read the handwritten **address** (lower-left) and **year** (lower-right); write a short **visual description** that is *honest to the era* (visible-only, period-neutral, no inference/modernizing/romanticizing). Return `""` for any field it can't read confidently — don't guess.
- **Cost/throughput:** 250 photos aren't latency-sensitive → run the full batch through the provider's **batch API** (Gemini and Claude both ~50% cheaper async). Single calls while developing.
- **Auth:** provider API key from the environment — never hardcode it.
- **Failure handling:** wrap each call in **retry-with-backoff (3 attempts)** for *transient* errors (timeout, 429, 5xx). After retries, a still-failing call — or a schema violation / empty return — marks that photo `failed` with the error reason and **does not block the batch**. Surface A itemizes the failures (CHC ID + reason); a failed photo can be **re-attempted individually**. (That per-photo retry is error recovery, *not* the killed "re-run the whole pass" feature.)

### The two evaluation axes (what the bake-off and the review surface score)

| Axis | Type | Scored against |
|---|---|---|
| **Handwriting** (address, year) | objective | the writing on the print itself — `correct` / `edited` / `illegible` |
| **Description** (holistic) | qualitative, multi-dimensional | accept / edit / reject **+ free-text review notes** — era-faithfulness, overall accuracy, tone, omissions; *not* a single 1–3 score |

Description quality is **holistic, not one-dimensional** — captured by the verdict (accept/edit/reject) plus free-text review notes, not a single number. Era-faithfulness is *one* dimension among several (overall accuracy, tone, omissions): a fluent description can still be *dishonest to the moment* — calling a 1931 car "vintage," modernizing vocabulary, hallucinating period detail, romanticizing, or contradicting the written year. The handwritten year is the partial objective anchor for judging that dimension. Full failure-mode list and editorial stance: [[01 Develop/CPL Cleveland Neighborhoods/design/vlm-description-spec.md|VLM description spec]]. (This discipline also doubles as a **Tier-2-readiness signal** — a model honest in description is one to trust further into interpretation.)

The adapter returns, at minimum:

```jsonc
{
  "address":     "2079 E 9th St",   // handwriting, lower-left; "" if unreadable
  "year":        "1931",             // handwriting, lower-right; "" if unreadable
  "description": "A multi-story Beaux-Arts municipal building seen from the street, automobiles along the curb…",
  "objects":     ["automobile", "streetlamp", "pedestrian"]   // optional
}
```

The three required outputs are **address, year, description**. The VLM reads address/year off the handwriting on the photo face; expect misses (that's what review catches).

### Per-photo working record (what Surface B reads and writes)

```jsonc
{
  "chc_id":      "CHC019059",
  "master_path": "masters/CHC019059.tif",
  "jpeg_path":   "derivatives/CHC019059.jpg",
  "vlm":   { "address": "…", "year": "…", "description": "…", "objects": ["…"] },
  "review": {
    "address":     { "verdict": "correct | edited | flag", "value": "…", "flag_reason": "wrong | illegible" },
    "year":        { "verdict": "correct | edited | flag", "value": "…", "flag_reason": "wrong | illegible" },
    "description": { "verdict": "accepted | edited | rejected", "value": "…" },
    "notes":       "free-text holistic evaluation of the description",
    "status":      "unreviewed | reviewed"
  }
}
```

The reviewer reads the handwriting straight off the (zoomable) image and marks each VLM field `correct`, `edited`, or `flag` (see §"Verdict & edit behavior" for the full model). **There is no pre-stored answer key** — the photo itself is the ground truth, and the verdicts *are* the accuracy data. The **`flag`** verdict is the escape hatch for wrong-but-unfixable reads, with an optional `flag_reason` of **`wrong`** vs **`illegible`** — so the reviewer never fakes a value, and a genuinely unreadable print (`illegible`) is excluded from the accuracy denominator instead of punishing the VLM's grade. For the **description**, the verdict captures the gross outcome (accepted/edited/rejected) and a free-text **`notes`** field captures the *holistic* evaluation — accuracy, era-faithfulness, tone, omissions — because description quality is multi-dimensional, not a single 1–3 score.

**State store:** the per-photo working record lives in a new **`scan_review`** table/collection in the app's existing store, one row keyed by CHC ID, **separate from `photo_enrichment` until accept** (on accept, confirmed fields copy across). A real table, not JSON-per-photo: the "auto-save / pick-up / survives a closed laptop" promise needs durable per-field writes, and the Accuracy rollup is just a query over it.

### On accept → write to `photo_enrichment` (fields your app already has)

- `description` → `patron_caption` and/or `accessibility_alt_text`
- `year` → `date_start` / `date_end` (+ `date_precision`)
- confirmed `address` → stored as the confirmed address string. **No geocoding in this pilot** — `lat`/`lng`/`neighborhood_tag` are deferred to the scale phase (see §"Out of scope"). Store the clean address; turn it into coordinates later.
- set `caption_quality = "auto_only"` and `public_status = "draft"` by default
- **record key:** for these box-scans use the **CHC ID** as the id; they have no `contentdm_id`

### The eval (the PoC's actual deliverable)

Aggregate the review verdicts into an **Accuracy** view: handwriting (address/year — % `correct` vs `edited`, with `illegible` reported separately so it doesn't distort the rate) plus the description outcomes (% accepted-as-is / edited / rejected) alongside the corpus of holistic review `notes`. The description axis is **qualitative, not a single score** — surface the notes, don't average them into a number. Include a list of the photos the VLM got wrong. Provide a **CSV export**. No separate scoring pass — it's a rollup of Surface B verdicts.

### Build now vs. out of scope

- **Build now:** the two surfaces, the `vlmExtract` adapter (model chosen by bake-off), JPEG derivation, the `scan_review` state store, per-call retry/failure handling, the Accuracy view + export.
- **Explicitly out of scope (do not build):** **geocoding** (confirmed address → `lat`/`lng`/`neighborhood_tag` — deferred to scale phase; store the clean address string for now); **re-runnable VLM pass** (the "tweak prompt, re-run all" feature — cut; per-photo retry on failure is *not* this); **Tier 2 interpretive enrichment** (the `vlmInterpret` historical-reasoning pass — see §"Two tiers of VLM work"); baseline-vs-Cleveland-context comparison runs; neighborhood-inference-from-scene as a *scored* field; person identification from faces; verso scanning; any ContentDM sync; bulk auto-publish. These are noted as future/scale-phase elsewhere in the doc — leave hooks, don't implement.

---

## Operating premise

This page does **two jobs that want very different amounts of UI**, and the whole design rests on not confusing them:

1. **A mechanical pipeline** — load the folder of TIFF masters, batch-derive JPEGs, run the VLM. This is a *job*, not an interaction. It runs once for the 250-photo box. It deserves a **status readout, not a designed screen.** Building a file-management UI in the browser for a one-shot batch is a cathedral for a goblin.

2. **A review-and-interpret surface** — the human looks at each photo beside what the machine claimed, and judges it. This is reusable, it outlives the PoC, and it's where every ounce of design effort goes. It is John's "human review layer" and the project's eval harness, collapsed into one screen.

**North star (inherited):** the median review action takes **under 20 seconds** and feels like *checking a colleague's work*, not data entry. The PoC has 250 photos; if reviewing one takes two minutes, the box never gets cleared.

---

## What the VLM extracts (one pass)

A single VLM call per photo, three outputs — no separate OCR stage:

1. **Address** — read from the handwriting on the print face (lower-left), assisted by any legible signage in the scene.
2. **Year** — read from the handwriting on the print face (lower-right).
3. **Visual description** — a plain-language account of what the photograph shows (the patron-facing caption / alt-text seed).

One model, one pass, three fields. Whatever Cleveland-specific reasoning we layer on later (neighborhood inference from the scene, baseline-vs-context comparison — John's bigger experiment) is a *future* extension, not part of this pass. Keep the PoC honest and small: read the writing, describe the picture.

---

## Two tiers of VLM work — and Tier 2 is *not* in the PoC

This pipeline's VLM call is **Tier 1: extraction** — literal, visible, self-verifying facts (address, year, what's in the frame). There is a second, more valuable tier the project is heading toward. Name it now so the architecture leaves room — but **do not build it for the PoC.**

**Tier 2 — interpretation.** Non-obvious, contextual meaning reasoned *across* the confirmed facts plus historical knowledge: what a corner later became, what an architectural style signals, what a cross-year comparison documents (a demolition, a vanished streetcar line), the social/cultural read of a streetscape. This is where digitization becomes *meaning-making* — the distinctive payoff, and the version of "AI doing real work" that actually serves the mission.

Why it's gated hard behind Tier 1:

- **Hallucination is lethal here.** Asked to "find something interesting," a VLM will confidently fabricate plausible-but-false history. In Tier 1 the handwriting is the firebreak; Tier 2 has none. A fabricated claim attached to a real archival photo *under CPL's name* launders fiction into institutional fact — the one thing an archive cannot do.
- **No cheap answer key.** Tier 1 scores against the handwriting. "Interesting *and correct*" is an expert human judgment (Brian's) — the exact staff time the PoC is built to avoid. Tier 2 needs a heavier, different evaluation.
- **Needs grounding, not vibes.** Generic Claude doesn't reliably know Cleveland micro-history. Real interpretive value requires retrieval over local sources (Cleveland Memory, historic maps, building records) — i.e. John's *Cleveland knowledge layer*, which is scale-phase.

**Firebreak architecture (for when Tier 2 is built):** Tier 2 runs on **human-confirmed** Tier 1 facts, never raw VLM output — a wrong address → wrong neighborhood → wrong history compounds into authoritative-sounding nonsense. The review step *is* the firebreak between tiers. Tier 2 is a separate call (a sibling `vlmInterpret` to `vlmExtract`), feeds the **interpretive** schema fields (`librarian_note`, `story_hook`) — never the factual ones — and every output ships AI-flagged, evidence-cited, uncertainty-preserved, and human-verified before public. Those are John's "never auto-assert / record evidence / preserve uncertainty" rules; Tier 2 is where they earn their keep.

**For the PoC: build Tier 1 only.** Prove the goblin walks before handing it the cathedral.

---

## The verification rule: the photo carries its own answer key

The load-bearing design fact: **the address and year are handwritten on the print, so they are visible in the scan.** The reviewer reads them straight off the image and checks the VLM against what they see. There is **no pre-transcribed manifest answer key** for these fields — a pre-filled "truth" column would be double-entry that buys nothing, because:

- The reviewer eyeballs every photo anyway to verify the visual description, so address/year verification rides along in the same glance — no added review cost.
- The only thing a pre-filled answer key would buy is auto-scoring so you could skip review — but you can't skip review (the descriptions need human eyes), so the saving is imaginary.

So the eval **falls out of the review verdicts themselves:** accept = the VLM was right, correct = the VLM missed. The accuracy table is a tally of what the reviewer accepted vs. corrected, not a comparison against a separate file.

> **Consequence: the manifest is gone for this pilot.** The CHC ID is captured as the **filename** at scan time (glance at verso → name the file `<CHC_ID>.tif`); no spreadsheet, no condition notes. The master TIFF *is* the condition record — a tear or stamp shows up in a 600dpi scan. The upstream [[01 Develop/CPL Cleveland Neighborhoods/technical/box-scan/scan-sop.md|scan SOP]] should be slimmed to match: **scan front → read CHC ID off back → name file.** That's the whole scan-time protocol.

This also **unifies eval and enrichment into one flow.** Box-scan photos happen to carry their own ground truth in-frame (the handwriting), so accuracy is measurable for free. ContentDM photos won't have handwriting, so the reviewer leans on expertise instead — but it's the *same screen, same gestures*. No mode flag, no bespoke eval app. That's what lets this surface outlast the PoC.

---

## Where it sits in the IA

The box-scan photos enter through a **different door** than everything else in the enrichment interface: they are **net-new digitizations, not yet in ContentDM.** The existing tool assumes its records arrive via the ContentDM harvest + Sync Inbox ([[enrichment-interface-features]] §"Sync inbox"). These 250 don't. They arrive from a scanner.

So the pipeline is a **second ingestion source**, sibling to the Sync Inbox — both are "new records entering the system, awaiting first-pass treatment." Proposed placement: a new top-level area, **Ingest**, that houses ingestion paths; the scan pipeline is its first inhabitant.

```
┌─────────────────────────────────────────────────────────────┐
│  Home / Worklists                                            │
├─────────────────────────────────────────────────────────────┤
│  Ingest                          ← NEW                       │
│  ── Scan pipeline (this doc): box-scan digitizations         │
│  ── Sync inbox: ContentDM upstream changes (existing)        │
├─────────────────────────────────────────────────────────────┤
│  Photos · Stories · Contributions · Vocabularies & Settings  │
└─────────────────────────────────────────────────────────────┘
```

Once a scanned photo clears review, it becomes an ordinary `photo_enrichment` record and lives under **Photos** like everything else. The pipeline is a *front porch*, not a separate house.

---

## Surface A — Pipeline run (deliberately thin)

A status panel, not a workspace. One column, honest numbers, no ceremony.

```
Box: City Hall Neighborhood (CHC) · loaded 2026-06-12
─────────────────────────────────────────────────────
Masters found ........... 250 TIFF
Derived to JPEG ......... 250 ✓   (0 errors)
VLM pass ................ 250 ✓   (address · year · description)
─────────────────────────────────────────────────────
Ready to review ......... 250        [ Start review → ]
```

- **Folder of masters in, derivatives out, never re-scan.** Mirrors the [[01 Develop/CPL Cleveland Neighborhoods/technical/box-scan/scan-sop.md|SOP]]: derive JPEGs from the TIFF masters; masters go cold and archival.
- **Failed photos can be re-attempted individually** — a transient VLM error (timeout, rate-limit) is retried per-photo, not by re-running the whole batch. (The "tweak the prompt and re-run all" feature is **cut** for the PoC; if a future baseline-vs-Cleveland-context comparison needs it, it returns as a second named run.)
- **Errors are loud and itemized** — "3 TIFFs failed to derive: CHC019059, …" — never a silent partial.
- **No editing happens here.** This panel hands off to Surface B. That's its whole job.

---

## Surface B — Review & interpret (the heart)

One photo at a time. Image left, claims right, verdict in the middle. This is the [[enrichment-interface-features]] record-edit view, specialized for first-pass machine review.

```
┌────────────────────────┬──────────────────────────────────────┐
│                        │  CHC019059          (from filename)   │
│                        │  ──────────────────────────────────── │
│     [ photo front ]    │  Address  (VLM read)                  │
│      pan / zoom        │   2079 E 9th St                       │
│                        │   [ ✓ correct ] [ edit ] [ ✗ flag ]   │
│   ↳ zoom the lower-    │  ──────────────────────────────────── │
│     left / lower-right │  Year  (VLM read)                     │
│     to read the hand-  │   1931                                │
│     writing yourself   │   [ ✓ correct ] [ edit ] [ ✗ flag ]   │
│                        │  ──────────────────────────────────── │
│                        │  Visual description  (VLM)            │
│                        │   "A multi-story Beaux-Arts municipal │
│                        │    building seen from the street,     │
│                        │    automobiles parked along the curb…"│
│                        │   [ ✓ accept ]  [ edit ]  [ reject ]  │
│                        │  ──────────────────────────────────── │
│                        │  Review notes (holistic, optional)    │
│                        │   [ accuracy · era-fit · tone · … ]   │
└────────────────────────┴──────────────────────────────────────┘
     [ ◀ prev ]   reviewed 47 / 250   [ confirm all & next ▶ ]
```

**How it behaves:**

- **The reviewer is the verifier, the photo is the source.** The VLM's address/year are shown as *proposals*; the reviewer reads the handwriting straight off the (zoomable) image and clicks `✓ correct`, `edit`, or `✗ flag`. No locked truth column, no separate answer key — the answer is in the picture.
- **Accept/correct verdicts *are* the accuracy data.** `✓ correct` = the VLM matched; `edit` / `✗ flag` = it missed (full verdict behavior below). These tallies become the eval table with no separate scoring pass. The eval is a by-product of normal review.
- **Visual description is a suggestion: accept / edit / reject** — honoring the parent tool's "AI suggests, never auto-fills." On accept it seeds `patron_caption` / `accessibility_alt_text` ([[enrichment-schema]]).
- **Keyboard-first, like Brian's geo flow.** `↵` confirm-and-advance, `e` edit, `x` reject. The 250-photo box clears in sessions, not a marathon.
- **Auto-save, no "are you sure."** Pick-up/put-down; the box survives being closed mid-stack.
- **The CHC ID is the record header, pulled from the filename** — no separate custody panel. Front-only scan; the verso was glanced at to name the file, not digitized.

### Verdict & edit behavior (structured fields)

Address and year each carry **three** verdicts, not two:

- **`✓ correct`** — VLM matched the handwriting. Confirmed value = VLM value. Scores as a hit.
- **`edit`** — VLM was wrong *and* I can read the right answer. Reveals an **inline field pre-filled with the VLM's guess** (you correct, you don't retype from blank). On commit it does double duty: writes the **human-confirmed truth** *and* logs the miss **with the before/after pair preserved** (`VLM: 2079 → human: 2709`). That pair is the risk evidence — Principle 4 made literal.
- **`✗ flag`** — wrong (or unreadable) and I'm *not* supplying a correction. No truth value is written; the field stays unconfirmed and the photo carries a flag for a later pass. Scores as a miss with **no before/after pair**.

**Keeping the denominator honest:** `✗ flag` optionally carries a one-tap reason — *wrong* vs *illegible*. "Wrong" is a true VLM miss; "illegible" isn't the VLM's fault (no human could read it either), so illegible flags are **excluded from the accuracy denominator** rather than punishing the score for bad handwriting. Without this split, a smudged print drags down the VLM's grade unfairly.

**Formatting isn't a miss.** Address strings vary in surface form — `2079 E 9th St` vs `2079 East 9th Street` is the *same read*, not a correction. Run both the VLM output and the confirmed value through a small **`normalizeAddress()`** (lowercase, expand `E→East`/`St→Street`-class abbreviations, collapse whitespace) so trivial formatting differences don't register as `edited`. The reviewer's rule follows the same logic: mark `correct` when only the formatting differs. This keeps the accuracy number measuring *reading*, not *punctuation* — otherwise a benign reformat tanks the score and the headline % becomes noise.

**`↵` precedence while editing:** a field mid-edit captures the keystroke. First `↵` **commits the edit and exits the field** (stays on the photo); second `↵` does the normal **confirm-and-advance**. `↵` never skips a photo with an open edit.

**Visual description stays binary-free.** Its `edit` is prose refinement, not a scored correction — description edits **sit outside the per-field accuracy table.** Only the description's accept / reject signal travels (as a soft "accepted-as-is" rate), never an address-style hit/miss. A free-text **review-notes** field rides alongside it to capture the *holistic* read — overall accuracy, era-faithfulness, tone, omissions — since description quality is multi-dimensional, not a single score. The notes are surfaced in the eval as a corpus, not averaged into a number.

> **Downstream loose thread:** a `✗ flag` produces an *unconfirmed* record — no confirmed address means the photo can't fully graduate to a `photo_enrichment` row. It needs a "needs another look" worklist somewhere downstream (out of scope for this surface, but flagged here so it isn't lost).

---

## Key flows

### Flow P — Run the pipeline (Jungu, once per box)
1. Point the pipeline at the `masters/` folder. It finds 250 TIFFs.
2. Derive JPEGs. Run the single VLM pass (address · year · description).
3. Watch the status panel fill. Resolve any itemized errors.
4. Click **Start review.** Done with the machine half.

### Flow R — Review session (Jungu now; Brian later, ~20s/photo)
1. Land on first unreviewed photo. VLM proposals shown beside the image.
2. Glance: zoom the lower-left/lower-right, read the handwriting, check the VLM's address and year against it. Read the visual description against the picture.
3. `✓ correct` the matches, `edit` the misses, `✗ flag` the wrong-but-unfixable (tagging *illegible* where no one could read it), accept/edit the description.
4. `↵` to advance. Repeat. Tally climbs.
5. End session → summary: *"112 reviewed. Address correct 79% · year correct 88% · descriptions accepted-as-is 64%."* (Accuracy % is over confirmable fields — illegible flags drop out of the denominator, so the rate measures the VLM, not the handwriting.)

### Flow E — Eval readout (Jungu → John)
1. Open the run's **Accuracy** tab — auto-aggregated from Flow R verdicts.
2. Per-field accuracy (address, year, description) and a list of the photos the VLM got wrong (the risk evidence).
3. Export the table. *That* is the PoC deliverable John asked for — provable AI doing real work, measured photo-by-photo against the handwriting on 250 prints.

---

## What feeds what

- **In:** TIFF masters (`masters/`), each filename = its CHC ID; one VLM prompt. No manifest, no answer key.
- **Out (the eval):** an accuracy table per field (address · year · description), built from review verdicts; the list of photos the VLM got wrong.
- **Out (the enrichment):** populated `photo_enrichment` rows — `patron_caption` / `accessibility_alt_text` from the description, `date_start`/`date_end` from the year, and candidate `lat`/`lng` + `neighborhood_tag` by **geocoding the confirmed address** (deterministic, not a scored VLM guess). `caption_quality = auto_only` until a human upgrades it.
- **Provenance discipline:** every machine-written field carries `geo_source = inferred` / equivalent until a human accepts it, so the schema never lies about what was AI-guessed vs. human-confirmed.

---

## Cross-cutting principles (pipeline-specific; parent principles still bind)

1. **Machine output is never truth until a human says so.** The VLM proposes; the human, reading the photo, decides. The VLM is never truth.
2. **The answer key is in the picture, not in a file.** The handwriting on the print is the ground truth. The reviewer reads it directly; no pre-transcribed truth column.
3. **The eval is a by-product of review, not a second task.** If scoring accuracy requires a separate spreadsheet pass, the design failed.
4. **The misses are the most valuable signal.** Surface where the VLM was wrong — that's the risk evidence John needs, worth more than the headline accuracy percentage.
5. **Handle-once respect carries into software.** Derive from masters, never re-scan. The pipeline honors the physical SOP's discipline.
6. **Thin where it's plumbing, rich where it's judgment.** Surface A stays a status panel forever. All design budget goes to Surface B.
7. **One flow, not two modes.** Box-scan (answer in-frame) and ContentDM (no answer) review on the same screen with the same gestures. No bespoke eval app.

---

## What this surface refuses to do

- **No auto-publish.** Nothing the VLM writes reaches a public-facing field without a human accept. (Parent: `public_status` gate is absolute.)
- **No silent partials.** A failed derive or VLM call is itemized and loud, never swallowed.
- **No person identification from face similarity.** Per [[john-ai-metadata-plan]] §Automation rules — never auto-assert identity; not in scope for this surface.
- **No bespoke eval app.** If it can't double as the enrichment review screen, it's the wrong build.

---

## Open questions

1. **Which VLM model?** Engine = a cloud VLM API behind the `vlmExtract` adapter; **decide by bake-off, not pre-commitment.** Run ~20 prints through **Gemini 3 Flash / Claude Sonnet 4.6 / GPT-5 mini**, score the two axes (handwriting accuracy + era-faithful description), pick the winner. Front-runner: **Gemini 3 Flash** (OCR-Arena #1, cheap, fast). **Opus is overkill** (priciest, not the OCR leader). Cost is noise for 250 images (~$0.26–$3.50 total). Full research — pricing, benchmarks, sources — in [[01 Develop/CPL Cleveland Neighborhoods/research/2026-06-13-vlm-model-comparison.md|VLM model comparison (research)]]; the era-faithfulness axis in [[01 Develop/CPL Cleveland Neighborhoods/design/vlm-description-spec.md|VLM description spec]]. Two unknowns the bake-off *measures*: (a) handwriting accuracy — the box-scan handwriting reads as **mostly legible and good-condition** by eye, so this is likely an *easy* read for all three models, not the feared bottleneck (the older "~11–14% WER, weak for archives" worry applies to *degraded historical cursive*, which these prints largely aren't); the bake-off confirms rather than rescues; (b) the holistic quality of the description (accuracy, era-faithfulness, tone) — likely the *real* differentiator between models. **Scale-phase flag (contingency, not expectation):** *if* handwriting turns out to be the bottleneck on some subset, the scale answer is a *split* — dedicated handwriting OCR (<1% WER) for address/year + a cheap VLM for description/Tier-2; the adapter supports it.
2. **CHC ID at scale.** Decided for the pilot: front-only scan, operator reads the verso CHC ID by eye and types it as the filename. Fine for 250. At scale (thousands), a verso scan + machine-read of the CHC ID may be worth it to remove the manual filename step — flag for the scale phase, not now.
3. ~~**Geocoding step**~~ — **Decided: out of the PoC.** Confirmed address → lat/lng → neighborhood is deferred to the scale phase (1931 addresses against modern geocoders is a systematic-error trap worth solving deliberately, not bolting on now). The pilot stores the clean confirmed address string; coordinates come later.
4. **The bigger Cleveland experiment, later** — John's baseline-vs-Cleveland-context comparison and neighborhood-inference-from-scene are deliberately *out* of this one-pass PoC. When (if) we add them, they slot in as a second VLM run + extra scored fields. Flag for the scale phase, not now.
5. **Confidence display** — should the VLM emit a per-field confidence so the reviewer can triage low-confidence reads first? Useful for speed; risk of false precision. Decide.
6. **Does this page ship in PoC, or is the PoC a script + a spreadsheet?** Honest question per the parent doc's "don't build the CMS before the spreadsheet" warning. The *design* should exist now; the *build* may be a notebook + a Google Sheet for the 250, with this UX as the eventual shape.
7. **Where do the 250 live afterward** — do these box-scans get pushed *into* ContentDM (becoming canonical), or held in the enrichment store pending CPL's cataloging decision? Architectural; needs Brian.

---

## What this doc is *not* yet

- Not a wireframe or visual design — ASCII sketches are placeholders for arrangement, not layout.
- Not a technical spec for the pipeline — that's a future `technical/scan-pipeline.md`.
- Not a committed IA change — the "Ingest" area is a proposal to pressure-test against the parent [[enrichment-interface-ux]], not a done deal.
- Not validated with Brian — like its sibling docs, bring it as a discussion object, not a fait accompli.

---

## Next move

Engine is now a **bake-off, not a fixed pick** (Open Q1: front-runner Gemini 3 Flash; Opus dropped). The remaining decision is **PoC build shape** (Open Q6: this review page now, or a script + a Google Sheet first) — honest move is the latter. Pair with [[enrichment-schema]] §"How to test this schema cheap" — the 250-photo box is a bigger, realer version of that same 30-photo spreadsheet test.

**Next concrete step:** finalize the description prompt in the [[01 Develop/CPL Cleveland Neighborhoods/design/vlm-description-spec.md|VLM description spec]], then run the **two-axis bake-off** — ~20 derived JPEGs through Gemini 3 Flash / Sonnet 4.6 / GPT-5 mini, structured-output JSON (address + year + era-faithful description), scored by eyeball on both axes. The result picks the engine and tells us whether handwriting is good enough to bother.

---

## Changelog

- **2026-06-13 · v1.0 — built (Tier 1), with deviations from this sketch.** Migrated to Next.js 14 + TypeScript + Postgres (Drizzle) + Supabase-or-local storage; the per-photo working record is the real **`scan_review`** table, not `scan_review.json`. **Verdict model collapsed 4→3** (supersedes §"Verdict & edit behavior"): `address`/`year` are now flat `correct | edited | illegible` — `flag` and its `wrong | illegible` `flag_reason` are gone. `edited` is the sole "miss" (carries the before/after pair); `illegible` is excluded from the denominator. Rationale: `edit` already means "VLM was wrong," so a separate `flag` button was redundant friction; `illegible` survives only because it's scored differently. **Surface A grew past "deliberately thin"** (supersedes §"Surface A"): it's now a **worklist sheet** (every ingested photo at a glance — thumbnail · stage · VLM read · verdict dots), mirroring the Photos sheet, so a reviewer sees the box before drilling in. **UI-driven ingest added** — the **Scan inbox** (`components/scan/ingest.tsx`) browses `masters/`, flags new vs. ingested, and ingests selected photos one-by-one with live progress; the per-master core (`lib/scan-ingest.ts`) is shared with the `scan:run` CLI. **Un-ingest added** — select rows → remove the `scan_review` row + derived JPEG (master TIFF untouched → re-ingestable). Both ingest routes are **local-only** (`sharp` never derives in serverless); delete is serverless-safe. Legacy `scan/*.mjs` removed. (Open Q6 — "page now, or script + spreadsheet?" — answered: the page shipped.)
- **2026-06-13 · v0.9** — Implementation-detail pass (build-handoff contract). **Derive spec finalized:** resample 600→300dpi by *DPI not long-edge* (handles heterogeneous print sizes), q85/sRGB, plus a **TIFF-normalization step** (force 8-bit/RGB/single-page/ICC→sRGB) to stop 16-bit/grayscale/LZW masters from crashing or silently mis-deriving. **State store decided:** a `scan_review` table keyed by CHC ID, separate from `photo_enrichment` until accept. **VLM failure handling:** per-call retry-with-backoff; failed photos itemized + individually re-attemptable. **`illegible` reconciled** into the existing `flag` model (excluded from the accuracy denominator). **Description eval de-numbered:** dropped the 1–3 score for accept/edit/reject **+ a free-text holistic review-notes field** (era-faithfulness is one dimension among accuracy/tone/omissions). **Address normalization** (`normalizeAddress()`) so formatting variants don't count as misses. **Geocoding cut from the PoC** (deferred to scale phase; store the clean address). **Re-runnable VLM pass cut** (per-photo retry ≠ re-run-all). Updated the two-axes table, Surface A/B, On-accept, eval rollup, build-now/out-of-scope, Open Q3.
- **2026-06-13 · v0.8** — Engine reconsidered after model research (captured in [[01 Develop/CPL Cleveland Neighborhoods/research/2026-06-13-vlm-model-comparison.md|VLM model comparison]]): **Opus dropped** (overkill, not the OCR leader, priciest). Engine is now a **bake-off** across Gemini 3 Flash / Claude Sonnet 4.6 / GPT-5 mini (front-runner Gemini 3 Flash); cost is noise for 250 images. Added a **second eval axis — description era-faithfulness** (co-equal with handwriting), with its failure modes and scoring deferred to the new [[01 Develop/CPL Cleveland Neighborhoods/design/vlm-description-spec.md|VLM description spec]]. Made the adapter section provider-agnostic; updated eval rollup, Open Q1, Next move. Institutional politics dropped per Jungu.
- **2026-06-13 · v0.7** — Added "Two tiers of VLM work" section: Tier 1 = extraction (this PoC), Tier 2 = interpretive historical reasoning (`vlmInterpret`) — named, valued, and explicitly gated out of the PoC with its three risks (hallucination, no answer key, needs grounding) and the firebreak architecture (Tier 2 consumes human-confirmed Tier 1 facts; feeds `librarian_note`/`story_hook`; ships AI-flagged + human-verified). Added Tier 2 to the build-handoff out-of-scope list.
- **2026-06-12 · v0.6** — Engine corrected: NEOBA was a parallel reference project, **not** this pipeline's engine. Engine is now a **cloud VLM API — Claude (`claude-opus-4-8`)** via the Anthropic SDK: Messages API, base64 image block, structured-output JSON, Batches API for the 250-photo run, behind a `vlmExtract` adapter. Updated glossary, pipeline stages, the adapter-contract section, Open Q1, and Next move.
- **2026-06-12 · v0.5** — Added "Build handoff context (self-contained)" section up top: glossary, input spec, pipeline stages, NEOBA adapter contract (target shape, flagged to confirm), per-photo working record, `photo_enrichment` write-mapping, eval rollup, and build-now-vs-out-of-scope — so the doc can be handed to a coding agent as a standalone build brief.
- **2026-06-12 · v0.4** — Engine fork resolved: **NEOBA** (Jungu's broadcast-footage VLM pipeline), not Azure. Adaptation = video→still + handwriting-read prompt. Azure demoted to scale-phase footnote. Handwriting reliability + Cleveland neighborhood accuracy reframed as PoC *measurements*, not pre-solved.
- **2026-06-12 · v0.3** — Manifest dropped entirely. CHC ID captured as **filename** at scan time; condition notes cut (the master TIFF is the condition record). Scan-time protocol collapses to 3 steps; removed verso toggle + custody panel from Surface B.
- **2026-06-12 · v0.2** — VLM-only, one pass (OCR stage removed). Pre-filled answer key dropped — address/year verified at review against the handwriting visible in the scan. "Two modes" collapsed into one unified review flow.
- **2026-06-12 · v0.1** — Initial draft. Two surfaces (thin pipeline status / rich review-and-interpret), proposed "Ingest" IA area, schema mapping to [[enrichment-schema]], cross-cutting principles.
