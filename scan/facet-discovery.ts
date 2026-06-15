// Facet discovery (local CLI) — Tier 1.5 Run 1, the DISCOVERY pass, v0.3 THREE-WAY cross-check.
// Canonical intent: build/enrichment-app/vlm-facet-spec.md §"Build brief — v0.3".
//
// A standalone one-off script (NOT an app/UI component — "nothing in the UI changes"). It reads
// the existing JPEG derivatives the shipped pipeline already produced (public/derivatives/<CHC>.jpg)
// and runs the SAME v0.3 inventory-only prompt independently across three strong frontier VLMs —
// Gemini 3.1 Pro, Claude Opus 4.8, GPT-5 — writing ONE JSON file per model, all keyed by CHC ID,
// identical shape, diffable key-by-key for the per-axis 3-way agreement pass. It does NOT re-run
// Tier-1, writes NOTHING to the production store, and does no review: raw output, mistakes and all.
// The v0.2 single-model file (data/scan/facets-discovery.json) is left in place as a stale-prompt
// reference — this script does not touch it.
//
//   npx tsx scan/facet-discovery.ts                       all arms with a key, all derivatives
//   npx tsx scan/facet-discovery.ts --provider opus        one arm only
//   npx tsx scan/facet-discovery.ts --only CHC019059       one photo (smoke test)
//   npx tsx scan/facet-discovery.ts --limit 5              first N (cheap dry run)
import "./env.mjs"; // GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY (+ FACET_MODEL_* overrides)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { REPO_ROOT } from "./derive";
import { vlmFacet, hasLiveKey, FACET_MODELS, PROVIDER_LABELS } from "@/lib/vlm-facet";
import type { FacetProvider, FacetResult } from "@/lib/types";

const ALL_PROVIDERS: FacetProvider[] = ["gemini", "opus", "gpt5"];

const { values: ARGV } = parseArgs({
  options: {
    in: { type: "string", default: "public/derivatives" },
    outDir: { type: "string", default: "data/scan" },
    provider: { type: "string" }, // gemini | opus | gpt5 — default: all with a key
    only: { type: "string" },
    limit: { type: "string" },
  },
});

interface Deriv {
  chcId: string;
  path: string;
}

function discoverDerivatives(dir: string): Deriv[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.jpe?g$/i.test(f))
    .sort()
    .map((f) => ({ chcId: basename(f, extname(f)), path: resolve(dir, f) }));
}

async function runProvider(provider: FacetProvider, derivs: Deriv[], outDir: string) {
  const live = hasLiveKey(provider);
  console.log(
    `\n── ${PROVIDER_LABELS[provider]} (${provider}) · model=${FACET_MODELS[provider]} · ${
      live ? "LIVE" : "STUB (no key)"
    } ──`
  );

  const out: Record<string, FacetResult> = {};
  const failed: { chcId: string; reason: string }[] = [];

  for (const d of derivs) {
    try {
      const res = await vlmFacet(readFileSync(d.path), provider);
      out[d.chcId] = res;
      const cats = Object.keys(res.visible_inventory).length;
      console.log(`  ✓ ${d.chcId} — ${cats} categor${cats === 1 ? "y" : "ies"}`);
    } catch (err) {
      const reason = String((err as Error)?.message ?? err);
      failed.push({ chcId: d.chcId, reason });
      console.log(`  ✗ ${d.chcId} — ${reason}`);
    }
  }

  const outPath = resolve(REPO_ROOT, outDir, `facets-discovery-${provider}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`  Wrote ${Object.keys(out).length} record(s), failed ${failed.length}. → ${outPath}`);
  for (const f of failed) console.log(`    - ${f.chcId}: ${f.reason}`);
  return { provider, live, written: Object.keys(out).length, failed: failed.length };
}

async function main() {
  const inDir = resolve(REPO_ROOT, ARGV.in as string);
  let derivs = discoverDerivatives(inDir);

  if (ARGV.only) {
    derivs = derivs.filter((d) => d.chcId === ARGV.only);
    if (!derivs.length) {
      console.error(`No derivative found for --only ${ARGV.only} in ${inDir}`);
      process.exit(1);
    }
  }
  if (ARGV.limit) {
    const n = Number(ARGV.limit);
    if (Number.isFinite(n) && n > 0) derivs = derivs.slice(0, n);
  }
  if (!derivs.length) {
    console.error(`No JPEG derivatives in ${inDir}. Run \`npm run scan:run\` first.`);
    process.exit(1);
  }

  let providers = ALL_PROVIDERS;
  if (ARGV.provider) {
    if (!ALL_PROVIDERS.includes(ARGV.provider as FacetProvider)) {
      console.error(`--provider must be one of: ${ALL_PROVIDERS.join(", ")}`);
      process.exit(1);
    }
    providers = [ARGV.provider as FacetProvider];
  }

  console.log(
    `Facet discovery v0.3 (3-way): ${derivs.length} derivative(s) × ${providers.length} arm(s)`
  );
  const missing = providers.filter((p) => !hasLiveKey(p));
  if (missing.length) {
    console.log(
      `Note: no key for ${missing.map((p) => PROVIDER_LABELS[p]).join(", ")} → those arms run in STUB mode.`
    );
  }

  const summary = [];
  for (const p of providers) summary.push(await runProvider(p, derivs, ARGV.outDir as string));

  console.log("\n── Summary ──");
  for (const s of summary) {
    console.log(
      `  ${PROVIDER_LABELS[s.provider]}: ${s.written} written, ${s.failed} failed${s.live ? "" : " (STUB — set key)"}`
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
