// vlmRun2 — Tier 1.5 Run 2 (the enforced-schema A/B), Piece A: extraction.
// Canonical intent: build/enrichment-app/vlm-facet-spec.md §"Run 2 — the enforced schema (v1
// LOCKED)" + §"Build brief — Run 2 extraction" (design vault).
//
// The discovery→Run-2 inversion: discovery (lib/vlm-facet.ts) froze the CONTAINER and freed the
// VALUES; Run 2 ALSO constrains the values to closed enums via the provider's JSON-schema mode.
// Single model — Gemini 3.1 Pro (the soft-committed production candidate). The 3-way cross-check
// is done; Run 2 evaluates the chosen candidate against the baseline caption, not models against
// each other. Reuses the shipped Gemini wire mechanics (base64 image + structured JSON + retry).
//
// Three in-prompt guards (the failure modes discovery exposed): change-only condition,
// no-fabrication, confidence-honesty. STANDALONE eval artifact — never writes the production
// store (photo_enrichment / scan_review). Stub when GEMINI_API_KEY is unset.
import type {
  AccessoryStructure,
  ArchivalMarkupKind,
  BuildingType,
  ConditionChange,
  FacetConfidence,
  Material,
  PersonPresent,
  RoofForm,
  Run2Facets,
  SceneTextKind,
  Stories,
  StreetGround,
  TransportFeature,
  Vegetation,
} from "@/lib/types";

export const RUN2_MODEL = process.env.FACET_MODEL_GEMINI || "gemini-3.1-pro-preview";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 90_000;

// ── Closed vocabularies (the v1 LOCKED enums; corpus-grounded — vlm-facet-spec §"Run 2") ──
const BUILDING_TYPE: BuildingType[] = ["single_family", "multi_family", "commercial", "civic", "accessory_only", "mixed"];
const STORIES: Stories[] = ["1", "1.5", "2", "2.5", "3plus", "unknown"];
const ROOF_FORM: RoofForm[] = ["gable", "hip", "flat", "gambrel", "mansard", "dormer"];
const CONFIDENCE: FacetConfidence[] = ["high", "medium", "low"];
const ACCESSORY: AccessoryStructure[] = ["detached_garage", "shed", "fence", "chimney", "outbuilding"];
const MATERIALS: Material[] = ["wood_frame", "brick", "stone", "concrete_block", "stucco", "metal", "glass"];
const STREET_GROUND: StreetGround[] = ["paved_street", "sidewalk", "curb", "driveway", "dirt_unpaved", "brick_street", "snow_cover", "open_lot", "cracked_pavement"];
const TRANSPORT: TransportFeature[] = ["utility_poles", "overhead_wires", "parked_cars", "street_lights", "street_signs", "streetcar_tracks"];
const VEGETATION: Vegetation[] = ["trees", "grass_lawn", "shrubs", "weeds_overgrown", "bare_trees"];
const SCENE_TEXT_KIND: SceneTextKind[] = ["business_name", "street_sign", "poster", "address", "other"];
const ARCHIVAL_KIND: ArchivalMarkupKind[] = ["date_stamp", "catalog_code", "ink_annotation", "drawn_mark"];
const CONDITION: ConditionChange[] = ["boarded_shuttered", "demolition_rubble", "under_construction", "fire_damage", "deteriorating"];
const PEOPLE: PersonPresent[] = ["people", "children", "workers", "vendors", "animals"];

// ── Run 2 prompt: enforced-enum extraction with the three guards + the print/scene firebreak ──
export const RUN2_PROMPT = `You are examining a single scanned historical photograph from a Cleveland
public-library archive. Extract a STRUCTURED FACET RECORD describing only what is
VISIBLY present, returned as a JSON object matching the provided schema. This is
metadata extraction, not captioning.

Mandatory rules:
- VISIBLE-ONLY. Report only what you can actually see in the frame. No inference
  beyond the frame, no period-typical guessing, no modernizing, no romanticizing.
- NO FABRICATION. If a field's value is not visible or not determinable, OMIT the
  field entirely. Never guess a value just to fill an enum — an omitted field is
  always acceptable and is the correct answer when the evidence isn't there. This
  matters most for building_type and roof_form.
- CONFIDENCE HONESTY. For building_type and roof_form, set the matching *_confidence
  to "low" when the value is inferred rather than plainly visible, "high" only when
  unmistakable. Omit the field (and its confidence) entirely if you cannot tell.
- CHANGE-ONLY for condition_and_change. Record ONLY visible evidence of TRANSITION:
  boarded/shuttered windows, demolition rubble, construction equipment or soil piles,
  fire damage, bare foundation, visible active deterioration. "Intact / occupied" is
  the default and must NEVER be logged. An empty or vacant LOT is a ground fact, not a
  change — code it as street_and_ground "open_lot", NEVER condition_and_change. Cracked
  or broken pavement is a ground STATE, not a transition — code it as street_and_ground
  "cracked_pavement", NEVER condition_and_change. Leave condition_and_change empty unless
  real transition evidence is visible.
- MATERIALS ARE WALL CLADDING ONLY. Record a material only where it appears as the wall
  surface of a building. A chimney, fence, or paving is NOT cladding — a brick chimney on
  a wood-clad house is "wood_frame" materials + "chimney" accessory_structures, not "brick".
- SEPARATE THE DEPICTED WORLD FROM THE PRINT. Text that is part of the scene
  (storefront signs, street signs, posters) → scene_text. Marks added by an archivist
  (date stamps, catalog codes, ink annotations, drawn X marks or arrows) →
  archival_markup. Physical defects OF the print itself (blemishes, tears, smears,
  fading) → set has_print_damage true; do NOT transcribe them anywhere.
- Transcribe scene_text and archival_markup text EXACTLY as written.

Return only the JSON object.`;

// ── Gemini responseSchema (uppercase TYPE enums; enum constrains the closed values) ──
const enumStr = (vals: readonly string[]) => ({ type: "STRING", enum: vals as string[] });
const enumArr = (vals: readonly string[]) => ({ type: "ARRAY", items: enumStr(vals) });
const transcriptionArr = (kinds: readonly string[]) => ({
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { text: { type: "STRING" }, kind: enumStr(kinds) },
    required: ["text", "kind"],
    propertyOrdering: ["text", "kind"],
  },
});

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    building_type: enumStr(BUILDING_TYPE),
    building_type_confidence: enumStr(CONFIDENCE),
    stories: enumStr(STORIES),
    roof_form: enumArr(ROOF_FORM),
    roof_form_confidence: enumStr(CONFIDENCE),
    has_porch: { type: "BOOLEAN" },
    accessory_structures: enumArr(ACCESSORY),
    materials: enumArr(MATERIALS),
    street_and_ground: enumArr(STREET_GROUND),
    transport: enumArr(TRANSPORT),
    vegetation: enumArr(VEGETATION),
    scene_text: transcriptionArr(SCENE_TEXT_KIND),
    archival_markup: transcriptionArr(ARCHIVAL_KIND),
    condition_and_change: enumArr(CONDITION),
    has_print_damage: { type: "BOOLEAN" },
    people_present: enumArr(PEOPLE),
  },
  // No `required` — every field is omittable. "Omit when not visible" (the no-fabrication guard)
  // depends on the model being free to leave fields out.
  propertyOrdering: [
    "building_type", "building_type_confidence", "stories", "roof_form", "roof_form_confidence",
    "has_porch", "accessory_structures", "materials", "street_and_ground", "transport",
    "vegetation", "scene_text", "archival_markup", "condition_and_change", "has_print_damage",
    "people_present",
  ],
};

const ENUM_FIELDS: Record<string, readonly string[]> = {
  building_type: BUILDING_TYPE,
  building_type_confidence: CONFIDENCE,
  stories: STORIES,
  roof_form_confidence: CONFIDENCE,
};
const ENUM_ARRAY_FIELDS: Record<string, readonly string[]> = {
  roof_form: ROOF_FORM,
  accessory_structures: ACCESSORY,
  materials: MATERIALS,
  street_and_ground: STREET_GROUND,
  transport: TRANSPORT,
  vegetation: VEGETATION,
  condition_and_change: CONDITION,
  people_present: PEOPLE,
};

function isTransient(err: unknown): boolean {
  const m = String((err as Error)?.message ?? err);
  return (
    (err as Error)?.name === "AbortError" ||
    /\b(408|429|500|502|503|504|529)\b/.test(m) ||
    /timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch failed/i.test(m)
  );
}

// Defensive normalize: keep only schema-valid values, drop empties/unknowns. The schema enforces
// the enums server-side; this is belt-and-suspenders so a stray value can never reach the eval.
function normalizeResult(parsed: unknown): Run2Facets {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("schema violation: response was not a JSON object");
  }
  const p = parsed as Record<string, unknown>;
  const out: Run2Facets = {};
  const inSet = (v: unknown, set: readonly string[]) => typeof v === "string" && set.includes(v);
  const filterSet = (v: unknown, set: readonly string[]) =>
    Array.isArray(v) ? Array.from(new Set(v.filter((x) => inSet(x, set)) as string[])) : [];

  for (const [field, set] of Object.entries(ENUM_FIELDS)) {
    if (inSet(p[field], set)) (out as Record<string, unknown>)[field] = p[field];
  }
  for (const [field, set] of Object.entries(ENUM_ARRAY_FIELDS)) {
    const items = filterSet(p[field], set);
    if (items.length) (out as Record<string, unknown>)[field] = items;
  }
  if (typeof p.has_porch === "boolean") out.has_porch = p.has_porch;
  if (typeof p.has_print_damage === "boolean") out.has_print_damage = p.has_print_damage;

  const transcriptions = (v: unknown, kinds: readonly string[]) =>
    Array.isArray(v)
      ? v
          .map((x) => x as Record<string, unknown>)
          .filter((x) => x && typeof x.text === "string" && x.text.trim() && inSet(x.kind, kinds))
          .map((x) => ({ text: (x.text as string).trim(), kind: x.kind as never }))
      : [];
  const st = transcriptions(p.scene_text, SCENE_TEXT_KIND);
  if (st.length) out.scene_text = st;
  const am = transcriptions(p.archival_markup, ARCHIVAL_KIND);
  if (am.length) out.archival_markup = am;

  // Confidence siblings only make sense alongside their parent — drop orphans.
  if (out.building_type === undefined) delete out.building_type_confidence;
  if (out.roof_form === undefined) delete out.roof_form_confidence;

  return out;
}

async function callGemini(base64: string, apiKey: string): Promise<Run2Facets> {
  const url = `${API_BASE}/${RUN2_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      { parts: [{ inline_data: { mime_type: "image/jpeg", data: base64 } }, { text: RUN2_PROMPT }] },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty VLM response (no candidate text)");
  return normalizeResult(JSON.parse(text));
}

function stubResult(): Run2Facets {
  return {
    building_type: "single_family",
    building_type_confidence: "low",
    stories: "2",
    has_porch: true,
    materials: ["wood_frame"],
    _stub: true,
  };
}

export function hasLiveKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Enforced-schema facet record from JPEG bytes (Gemini 3.1 Pro). Eval artifact only — never persisted. */
export async function vlmRun2(jpeg: Buffer | Uint8Array): Promise<Run2Facets> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return stubResult();
  const base64 = Buffer.from(jpeg).toString("base64");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGemini(base64, apiKey);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err;
      if (attempt < MAX_ATTEMPTS) await sleep(800 * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}
