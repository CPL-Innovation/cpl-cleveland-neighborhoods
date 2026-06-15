// vlmFacet — the Tier 1.5 visible-faceting adapter, a SIBLING to vlmExtract (lib/vlm-extract.ts),
// not a replacement. Canonical intent: build/enrichment-app/vlm-facet-spec.md (design vault).
//
// v0.3 — THREE-WAY cross-check. The discovery pass runs the same v0.3 prompt independently across
// three strong frontier VLMs (vlm-facet-spec §"Build brief — v0.3"):
//   • gemini → Gemini 3.1 Pro  (raw v1beta REST — the shipped wire format; likely production family)
//   • opus   → Claude Opus 4.8 (official @anthropic-ai/sdk)
//   • gpt5   → GPT-5           (official openai SDK)
// One prompt, one schema, one normalizer — three model-string/endpoint configs, not three pipelines.
// All three return ONLY `visible_inventory`; the per-axis 3-way agreement signal (lock / soft /
// cut) is what turns "present" into "reliable" downstream. This call is run STANDALONE per image
// (image + v0.3 prompt only — no prior description, which would bias the read). Stub when no key.
//
// Structured output: enforce the CONTAINER (visible_inventory object; the category keys; array
// values), free the VALUES (discovery vocabulary surfaces). Each provider's native JSON-schema
// mode is used so the parent pipeline's "never free-parse" rule holds. Empty/absent categories are
// dropped in normalize → all three files share the identical shape and are diffable key-by-key.
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { FacetProvider, FacetResult, VisibleInventory } from "@/lib/types";

// One strong model per arm. Each is overridable; defaults are the spec's picks.
export const FACET_MODELS: Record<FacetProvider, string> = {
  gemini: process.env.FACET_MODEL_GEMINI || "gemini-3.1-pro-preview",
  opus: process.env.FACET_MODEL_OPUS || "claude-opus-4-8",
  gpt5: process.env.FACET_MODEL_GPT5 || "gpt-5",
};

export const PROVIDER_LABELS: Record<FacetProvider, string> = {
  gemini: "Gemini 3.1 Pro",
  opus: "Claude Opus 4.8",
  gpt5: "GPT-5",
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 90_000;

// The v0.3 discovery prompt — vendored verbatim from vlm-facet-spec.md §"The discovery prompt".
export const FACET_PROMPT = `You are examining a single scanned historical photograph from a Cleveland
public-library archive. Return a JSON object with one key, "visible_inventory",
whose value is an object. Each key below is a category; its value is an array
of short noun phrases naming what is visibly present in that category. List
only what you can actually see. Omit any category with nothing visible (do not
pad). Mark uncertain items with "appears to be". Honesty to the era is
mandatory: visible-only, period-neutral, no inference beyond the frame, no
modernizing, no romanticizing, no invented detail.

CRITICAL — separate the depicted world from the physical print:
  - Things that exist in the photographed SCENE (buildings, signage on a
    storefront, a street sign) → the scene categories below.
  - Marks ADDED to the print by an archivist (drawn X over a building, arrows,
    date-stamps, catalog codes, handwritten addresses in ink) → archival_markup.
  - Physical defects OF the print itself (blemishes, tears, creases,
    perforated borders, ink smears) → print_condition.
  Never list a date-stamp, catalog code, or drawn mark under text_in_scene or
  any scene category — those belong to the print, not the world.

Scene categories:
  - structures: building type(s), number of stories, roof/porch form
  - materials: wall cladding, construction material (e.g. frame, brick, stone)
  - street_and_ground: road surface, sidewalks, curbs, streetcar tracks
  - transport: vehicles, utility/light poles, wires, transit infrastructure
  - people_and_activity: people present and what they are doing
  - text_in_scene: readable text that is PART OF THE SCENE only — storefront
    names, business signage, street signs, posters, ghost signs — transcribed
    exactly. NOT archival stamps, codes, or handwriting on the print.
  - vegetation: trees, lawns, lots
  - condition_and_change: visible state of the BUILT ENVIRONMENT — intact,
    deteriorating, vacant lot, under construction, boarded, demolition in
    progress (not the condition of the print — that is print_condition)

Print-object categories:
  - archival_markup: intentional marks added to the print by a librarian or
    archivist — drawn X marks, arrows, circles, date-stamps, catalog/accession
    codes, addresses or notes handwritten in ink. Transcribe text exactly.
  - print_condition: physical state of the photograph/print itself — blemishes,
    tears, creases, perforated or torn borders, fading, ink smears, scratches.

Catch-all:
  - other: anything visibly present that does not fit any category above —
    ESPECIALLY anything unusual, unexpected, or hard to categorize. When in
    doubt, put it here rather than forcing it into a category or dropping it.

Return only the JSON.`;

const CATEGORIES: (keyof VisibleInventory)[] = [
  "structures",
  "materials",
  "street_and_ground",
  "transport",
  "people_and_activity",
  "text_in_scene",
  "vegetation",
  "condition_and_change",
  "archival_markup",
  "print_condition",
  "other",
];

// ── JSON Schema (OpenAI / Anthropic flavor): standard types, additionalProperties:false ──
// Container enforced; string array values free. OpenAI strict mode requires every property in
// `required` + additionalProperties:false, so all categories are present-but-maybe-empty there;
// normalize() drops the empties so every provider's output ends up the same shape.
function stringArray() {
  return { type: "array", items: { type: "string" } } as const;
}
const INVENTORY_PROPS = Object.fromEntries(CATEGORIES.map((c) => [c, stringArray()]));
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    visible_inventory: {
      type: "object",
      additionalProperties: false,
      properties: INVENTORY_PROPS,
      required: CATEGORIES,
    },
  },
  required: ["visible_inventory"],
};

// ── Gemini schema (uppercase enum types, propertyOrdering) — the shipped wire format ──
const GEMINI_STRINGS = { type: "ARRAY", items: { type: "STRING" } };
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    visible_inventory: {
      type: "OBJECT",
      properties: Object.fromEntries(CATEGORIES.map((c) => [c, GEMINI_STRINGS])),
    },
  },
  required: ["visible_inventory"],
};

function isTransient(err: unknown): boolean {
  const m = String((err as Error)?.message ?? err);
  return (
    (err as Error)?.name === "AbortError" ||
    /\b(408|429|500|502|503|504|529)\b/.test(m) ||
    /timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch failed/i.test(m)
  );
}

// Container-enforce / value-free: keep only the known category keys, drop empties (absence = signal).
function normalizeResult(parsed: unknown): FacetResult {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("schema violation: response was not a JSON object");
  }
  const inv = (parsed as Record<string, unknown>).visible_inventory;
  if (!inv || typeof inv !== "object") {
    throw new Error("schema violation: missing visible_inventory object");
  }
  const src = inv as Record<string, unknown>;
  const out: VisibleInventory = {};
  for (const cat of CATEGORIES) {
    const v = src[cat];
    if (Array.isArray(v)) {
      const items = v.map(String).map((s) => s.trim()).filter(Boolean);
      if (items.length) out[cat] = items;
    }
  }
  return { visible_inventory: out };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── gemini: raw v1beta REST (the shipped wire format; manual retry/backoff) ──
async function callGemini(base64: string, apiKey: string): Promise<FacetResult> {
  const url = `${GEMINI_API_BASE}/${FACET_MODELS.gemini}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      { parts: [{ inline_data: { mime_type: "image/jpeg", data: base64 } }, { text: FACET_PROMPT }] },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_SCHEMA,
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

// ── opus: official @anthropic-ai/sdk, structured output via output_config.format ──
// Opus 4.8: adaptive-thinking surface; we omit thinking (runs without) — this is deterministic
// structured extraction, not open-ended reasoning. SDK handles retry/backoff (maxRetries).
let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ maxRetries: MAX_ATTEMPTS });
  return _anthropic;
}
async function callOpus(base64: string): Promise<FacetResult> {
  const res = await anthropic().messages.create({
    model: FACET_MODELS.opus,
    max_tokens: 4096,
    output_config: { format: { type: "json_schema", schema: JSON_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          { type: "text", text: FACET_PROMPT },
        ],
      },
    ],
  });
  const block = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block?.text) throw new Error("empty VLM response (no text block)");
  return normalizeResult(JSON.parse(block.text));
}

// ── gpt5: official openai SDK, structured output via strict json_schema ──
// Strict mode requires all properties required + additionalProperties:false → every category is
// present-but-maybe-empty; normalize() drops empties so the shape matches the other two arms.
let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI({ maxRetries: MAX_ATTEMPTS });
  return _openai;
}
async function callGpt5(base64: string): Promise<FacetResult> {
  const res = await openai().chat.completions.create({
    model: FACET_MODELS.gpt5,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: FACET_PROMPT },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "visible_inventory", strict: true, schema: JSON_SCHEMA },
    },
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("empty VLM response (no message content)");
  return normalizeResult(JSON.parse(text));
}

function stubResult(provider: FacetProvider): FacetResult {
  return {
    visible_inventory: {
      structures: ["[stub] two-story house"],
      other: [`[stub] set the ${provider} API key for a real facet read`],
    },
    _stub: true,
  };
}

const ENV_KEY: Record<FacetProvider, string> = {
  gemini: "GEMINI_API_KEY",
  opus: "ANTHROPIC_API_KEY",
  gpt5: "OPENAI_API_KEY",
};

export function hasLiveKey(provider: FacetProvider): boolean {
  return Boolean(process.env[ENV_KEY[provider]]);
}

/** Discovery-only visible inventory from JPEG bytes, via one of the three arms. Never persisted. */
export async function vlmFacet(jpeg: Buffer | Uint8Array, provider: FacetProvider): Promise<FacetResult> {
  if (!hasLiveKey(provider)) return stubResult(provider);
  const base64 = Buffer.from(jpeg).toString("base64");

  // The SDK arms (opus/gpt5) retry internally; the raw-fetch gemini arm retries here.
  if (provider === "opus") return callOpus(base64);
  if (provider === "gpt5") return callGpt5(base64);

  const apiKey = process.env.GEMINI_API_KEY as string;
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
