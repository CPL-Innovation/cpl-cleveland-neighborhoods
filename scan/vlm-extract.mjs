#!/usr/bin/env node
// vlmExtract(jpeg) — the single VLM adapter the rest of the pipeline talks to.
//
// Spec: scan-pipeline-ux.md §"VLM call — the vlmExtract adapter".
//   - One cloud VLM call per photo → { address, year, description, objects }.
//   - Engine is a config swap (front-runner: Gemini 3 Flash). The provider's wire
//     format never leaks past this file.
//   - Use the provider's structured-output / JSON-schema mode — never parse free text.
//   - Retry-with-backoff (3) for transient errors (timeout / 429 / 5xx).
//   - Auth from the environment (GEMINI_API_KEY) — never hardcoded.
//   - The exact prompt + era-honesty rules live in technical/vlm-description-spec.md;
//     load it from there, don't hardcode the prose here.
//
// Stub mode: when GEMINI_API_KEY is unset, returns canned JSON so the whole pipeline
// runs keyless during development. Set GEMINI_API_KEY to go live.

import "./env.mjs"; // load .env → process.env before reading GEMINI_API_KEY
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve, basename, extname } from "node:path";
import { REPO_ROOT } from "./store.mjs";

// Spec front-runner "Gemini 3 Flash" → published id `gemini-3-flash-preview`.
// Override with GEMINI_MODEL (e.g. gemini-flash-latest, gemini-2.5-flash) for the bake-off.
const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const SPEC_PATH = resolve(REPO_ROOT, "technical/vlm-description-spec.md");
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;

// Gemini responseSchema (OpenAPI subset) — guarantees the four fields come back typed.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    address: { type: "STRING" },
    year: { type: "STRING" },
    description: { type: "STRING" },
    objects: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["address", "year", "description"],
  propertyOrdering: ["address", "year", "description", "objects"],
};

let _promptCache = null;

/** Load the v0 prompt by extracting the fenced block under "## The prompt" in the spec. */
export async function loadPrompt() {
  if (_promptCache) return _promptCache;
  const md = await readFile(SPEC_PATH, "utf8");
  const head = md.indexOf("## The prompt");
  const region = head === -1 ? md : md.slice(head);
  const fence = region.match(/```[a-z]*\n([\s\S]*?)```/);
  if (!fence) {
    throw new Error(`Could not find the prompt code-fence in ${SPEC_PATH}`);
  }
  _promptCache = fence[1].trim();
  return _promptCache;
}

function isTransient(err) {
  const m = String(err?.message || err);
  return (
    err?.name === "AbortError" ||
    /\b(408|429|500|502|503|504)\b/.test(m) ||
    /timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch failed/i.test(m)
  );
}

async function callGemini(base64, prompt, apiKey) {
  const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: "image/jpeg", data: base64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
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

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty VLM response (no candidate text)");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`schema violation: response was not valid JSON: ${text.slice(0, 200)}`);
  }
  return normalizeResult(parsed);
}

function normalizeResult(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("schema violation: response was not a JSON object");
  }
  return {
    address: typeof parsed.address === "string" ? parsed.address.trim() : "",
    year: typeof parsed.year === "string" ? parsed.year.trim() : "",
    description: typeof parsed.description === "string" ? parsed.description.trim() : "",
    objects: Array.isArray(parsed.objects) ? parsed.objects.map(String) : [],
  };
}

// Deterministic stub so keyless runs still exercise the whole pipeline.
function stubResult(jpegPath) {
  const id = basename(jpegPath, extname(jpegPath));
  return {
    address: "",
    year: "",
    description: `[stub] Visual description placeholder for ${id}. Set GEMINI_API_KEY for a real VLM read.`,
    objects: [],
    _stub: true,
  };
}

/** True when a real provider key is present. */
export function hasLiveKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Extract { address, year, description, objects } from a derived JPEG.
 * @param {string} jpegPath absolute or repo-relative path to the JPEG
 * @returns {Promise<{address,year,description,objects}>}
 * @throws after MAX_ATTEMPTS on a still-failing transient error, or immediately on a
 *   non-transient error (bad key, schema violation). The caller marks the photo `failed`.
 */
export async function vlmExtract(jpegPath) {
  const abs = resolve(REPO_ROOT, jpegPath);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return stubResult(jpegPath);

  const [prompt, buf] = await Promise.all([loadPrompt(), readFile(abs)]);
  const base64 = buf.toString("base64");

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGemini(base64, prompt, apiKey);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err; // bad key / schema violation → don't retry
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 800 * 2 ** (attempt - 1);
        console.warn(`  ! VLM attempt ${attempt} failed (${err.message}); retrying in ${backoff}ms`);
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}

// CLI: `node scan/vlm-extract.mjs derivatives/CHC016776.jpg` — one-off probe.
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node scan/vlm-extract.mjs <jpeg-path>");
    process.exit(1);
  }
  console.log(`Model: ${MODEL} · live key: ${hasLiveKey()}`);
  vlmExtract(arg)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((err) => {
      console.error("VLM failed:", err.message);
      process.exit(1);
    });
}

export { MODEL };
