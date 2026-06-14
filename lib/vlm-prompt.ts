// Operational copy of the VLM extraction prompt — the string the pipeline actually runs.
// Imported (not read from disk) so it bundles into every target: the local CLI, the
// serverless retry route, and dev. No runtime file I/O, no path resolution.
//
// Canonical intent + rationale (the "why" behind every rule below) lives in the design vault:
//   build/enrichment-app/vlm-description-spec.md
// Keep this file in sync when that spec's prompt changes, and bump VLM_PROMPT_VERSION.

// Mirrors the spec's own prompt version tag. Stamp it onto eval runs so the Accuracy
// rollup can attribute results to the exact prompt that produced them.
export const VLM_PROMPT_VERSION = "v0";

export const VLM_PROMPT = `You are examining a single scanned historical photograph from a Cleveland
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

Return only the JSON.`;
