---
type: log
status: active
created: 2026-06-13
---

# VLM Description Spec — what "honest" description means, and the prompt that produces it

> **Last updated:** 2026-06-13 · v0.1 · status: evolving

> The living spec for the **visual description** the VLM writes for each scanned photo: the editorial stance (honesty to the era), the failure modes we score against, the **exact prompt** the pipeline runs, and the rubric the bake-off uses. Ongoing — expect the prompt to change as bake-off results come in.
>
> **Companion:** [[01 Develop/CPL Cleveland Neighborhoods/design/scan-pipeline-ux.md|scan-pipeline-ux]] (the pipeline that calls this prompt) · [[enrichment-schema]] (the fields description feeds).
> **This doc's job:** hold the prompt that actually gets run + the rubric that scores it. Not a philosophy essay — a working artifact.

---

## Why this is its own doc

Reading handwriting is a bounded, objective task. **Writing a description that's honest to the moment the photo was taken is not** — it's an editorial discipline with real failure modes, no leaderboard scores it, and the right prompt will only be found by iterating against real prints. It's also the Tier-1 seed of the discipline [[01 Develop/CPL Cleveland Neighborhoods/design/scan-pipeline-ux.md|Tier-2 interpretation]] will live or die on. So it gets a home where the prompt and the rubric evolve together.

---

## Editorial stance (the one principle)

**Describe only what is visibly, verifiably present — and be honest to the era.** To the people in a 1931 photograph, 1931 was the *present*: a new car, a working storefront, an ordinary street. The description must not view the scene through our vantage point, must not invent what it cannot see, and must not romanticize. Neutral, literal, period-true. When in doubt, say less.

This is also the trust contract: a fabricated or anachronistic description attached to a real archival photo, under CPL's name, launders fiction into institutional fact — the one thing an archive cannot do.

---

## Failure modes (what we score against)

1. **Anachronistic framing** — "a vintage automobile," "an old-fashioned storefront," "a bygone era." It wasn't old then; it was now.
2. **Modernizing vocabulary** — "retail space," "parking lot," "pedestrians commuting" — contemporary terms smuggled onto a historical scene.
3. **Hallucinated period detail** — inventing plausible-sounding texture it can't actually see, to sound knowledgeable.
4. **Romanticization / editorializing** — "a charming, sepia-toned glimpse," sensory or emotional color not in the frame.
5. **Era contradiction** — describing a scene that visually reads as one decade while the handwritten year says another, without noting the tension.
6. **Over-assertion under uncertainty** — stating a guess as fact instead of "appears to be."

The handwritten **year** is the partial objective anchor: a description can be checked for consistency against the known date.

---

## The prompt — v0 (run this in the bake-off)

> Drives all three fields so one call serves the whole extraction. Tune from bake-off results; bump the version here when it changes.

```
You are examining a single scanned historical photograph from a Cleveland
public-library archive. Return a JSON object with exactly these fields:

- "address": the handwritten street address on the front, lower-left.
  Transcribe exactly as written. If you cannot read it confidently, return "".
- "year": the handwritten year or date on the front, lower-right.
  Transcribe as written. If you cannot read it confidently, return "".
- "description": one or two plain sentences describing only what is visibly
  present in the photograph.

Rules for "description" — honesty to the era is mandatory:
- Describe only what is visibly present. Do not infer history, identities,
  events, or context beyond the frame.
- Use plain, period-neutral language. Do not modernize ("retail space",
  "parking lot", "commuters") and do not historicize from a present-day
  vantage point ("vintage car", "old-fashioned", "bygone era") — to the
  people in the photo, this was the present.
- Do not romanticize, editorialize, or add sensory or emotional color you
  cannot see.
- If the scene's apparent period seems inconsistent with the written year,
  describe what you see and note the tension rather than resolving it.
- If you are unsure about an object, write "appears to be" rather than
  asserting it.

Return only the JSON.
```

---

## Scoring rubric (the bake-off's qualitative axis)

Per photo, score `description` **1–3** by eyeball (the handwritten year anchors the judgment):

| Score | Meaning |
|---|---|
| **3 — Faithful** | Visible-only, period-neutral, no fabrication, consistent with the year. |
| **2 — Minor slips** | One anachronistic word or a touch of editorializing; substance accurate. |
| **1 — Dishonest** | Anachronistic framing, hallucinated detail, romanticization, or era contradiction. |

For every 1 or 2, **note the specific failure** — that log is what tunes the prompt and reveals which model is disciplined vs. which one performs.

Pair this with the objective handwriting axis (address/year correct?) for the full two-axis bake-off in [[01 Develop/CPL Cleveland Neighborhoods/design/scan-pipeline-ux.md|scan-pipeline-ux]].

---

## Open questions (the ongoing thinking)

1. **Length / granularity** — one sentence, two, or a richer paragraph? Downstream pull is split: `patron_caption` wants short; `accessibility_alt_text` wants complete. Maybe two outputs, not one.
2. **Landmark naming** — if a recognizable building is visible (Terminal Tower, West Side Market), should the description *name* it, or stay strictly literal? Naming adds value but invites hallucination — possibly Tier-2 territory, not Tier-1.
3. **Voice / register** — flat catalog voice vs. a slightly warmer patron-facing voice? (Connects to the [[enrichment-schema]] `patron_caption` vs. cataloger-title distinction.)
4. **Surfacing uncertainty** — how should "appears to be" travel into the structured record so it's visible to patrons, not silently dropped?
5. **Alt-text vs. caption** — same description for both, or two variants with different requirements (alt-text = accessibility completeness; caption = readability)?
6. **Per-model prompt drift** — does each model need its own tuned prompt, or does one prompt hold across Gemini / Claude / GPT? The bake-off will tell.
7. **Where the era-honesty rules go at scale** — prompt-only, or also a post-hoc check (a second pass that flags anachronistic vocabulary)?

---

## Changelog

- **2026-06-13 · v0.1** — Initial spec. Editorial stance (honesty to the era), six failure modes, v0 prompt (all three fields), 1–3 era-faithfulness rubric, open questions. Extracted from the scan-pipeline design thread so the prompt + rubric evolve in one place.
