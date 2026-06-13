// vlmExtract — the single VLM adapter, ported from scan/vlm-extract.mjs to TS.
// Takes image BYTES (so the CLI passes a local file's buffer and the serverless retry
// path passes bytes fetched from Storage). Engine = Gemini 3 Flash behind this boundary;
// the prompt + era-honesty rules load from technical/vlm-description-spec.md.
//
// Stub mode when GEMINI_API_KEY is unset → canned JSON, so the pipeline runs keyless.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { VlmResult } from "@/lib/types";

// Spec front-runner "Gemini 3 Flash" → published id `gemini-3-flash-preview`.
export const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;

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

let _promptCache: string | null = null;

export async function loadPrompt(): Promise<string> {
  if (_promptCache) return _promptCache;
  const md = await readFile(resolve(process.cwd(), "technical/vlm-description-spec.md"), "utf8");
  const head = md.indexOf("## The prompt");
  const region = head === -1 ? md : md.slice(head);
  const fence = region.match(/```[a-z]*\n([\s\S]*?)```/);
  if (!fence) throw new Error("Could not find the prompt code-fence in vlm-description-spec.md");
  _promptCache = fence[1].trim();
  return _promptCache;
}

function isTransient(err: unknown): boolean {
  const m = String((err as Error)?.message ?? err);
  return (
    (err as Error)?.name === "AbortError" ||
    /\b(408|429|500|502|503|504)\b/.test(m) ||
    /timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch failed/i.test(m)
  );
}

function normalizeResult(parsed: unknown): VlmResult {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("schema violation: response was not a JSON object");
  }
  const p = parsed as Record<string, unknown>;
  return {
    address: typeof p.address === "string" ? p.address.trim() : "",
    year: typeof p.year === "string" ? p.year.trim() : "",
    description: typeof p.description === "string" ? p.description.trim() : "",
    objects: Array.isArray(p.objects) ? p.objects.map(String) : [],
  };
}

async function callGemini(base64: string, prompt: string, apiKey: string): Promise<VlmResult> {
  const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      { parts: [{ inline_data: { mime_type: "image/jpeg", data: base64 } }, { text: prompt }] },
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
  try {
    return normalizeResult(JSON.parse(text));
  } catch {
    throw new Error(`schema violation: response was not valid JSON: ${text.slice(0, 200)}`);
  }
}

function stubResult(chcId: string): VlmResult {
  return {
    address: "",
    year: "",
    description: `[stub] Visual description placeholder for ${chcId}. Set GEMINI_API_KEY for a real VLM read.`,
    objects: [],
    _stub: true,
  };
}

export function hasLiveKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Extract {address, year, description, objects} from JPEG bytes. */
export async function vlmExtract(jpeg: Buffer | Uint8Array, chcId = "image"): Promise<VlmResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return stubResult(chcId);

  const [prompt] = await Promise.all([loadPrompt()]);
  const base64 = Buffer.from(jpeg).toString("base64");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGemini(base64, prompt, apiKey);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err;
      if (attempt < MAX_ATTEMPTS) await sleep(800 * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}
