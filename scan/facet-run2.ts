// Facet Run 2 (local CLI) — Tier 1.5 Run 2, Piece A: the enforced-schema extraction.
// Canonical intent: build/enrichment-app/vlm-facet-spec.md §"Build brief — Run 2 extraction".
//
// A standalone one-off eval script (NOT an app/UI component, and explicitly NOT the facet-review
// UI — that is Piece B, downstream). Reads the same reviewed derivatives the discovery run used
// (public/derivatives/<CHC>.jpg), calls vlmRun2 once per image under the v1 LOCKED enforced schema
// (Gemini 3.1 Pro, single model), and writes ONE JSON file keyed by CHC ID. It does NOT re-run
// Tier-1 and writes NOTHING to the production store (photo_enrichment / scan_review) — the
// production-write firebreak holds until the A/B clears. Eval artifact only.
//
//   npx tsx scan/facet-run2.ts                  enforced extraction over every derivative
//   npx tsx scan/facet-run2.ts --only CHC019059  one photo (smoke test)
//   npx tsx scan/facet-run2.ts --limit 5         first N (cheap dry run)
//   npx tsx scan/facet-run2.ts --out data/scan/facets-run2.json   custom output path
import "./env.mjs"; // GEMINI_API_KEY (+ FACET_MODEL_GEMINI override)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { REPO_ROOT } from "./derive";
import { vlmRun2, hasLiveKey, RUN2_MODEL } from "@/lib/vlm-run2";
import type { Run2Facets } from "@/lib/types";

const { values: ARGV } = parseArgs({
  options: {
    in: { type: "string", default: "public/derivatives" },
    out: { type: "string", default: "data/scan/facets-run2.json" },
    only: { type: "string" },
    limit: { type: "string" },
    force: { type: "boolean", default: false }, // re-extract even records already in the out file
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

  // Resume: keep records already in the out file, skip them unless --force. Lets a quota-
  // interrupted run be finished without re-burning calls on records already extracted.
  const outPath = resolve(REPO_ROOT, ARGV.out as string);
  const out: Record<string, Run2Facets> = existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, "utf8")) as Record<string, Run2Facets>)
    : {};
  const todo = ARGV.force ? derivs : derivs.filter((d) => !(d.chcId in out));
  const skipped = derivs.length - todo.length;

  console.log(
    `Facet Run 2 (enforced schema): ${todo.length} to extract` +
      (skipped ? `, ${skipped} already done (skipped)` : "") +
      ` · model=${RUN2_MODEL} · ${hasLiveKey() ? "LIVE" : "STUB (no GEMINI_API_KEY)"}`
  );

  const failed: { chcId: string; reason: string }[] = [];
  let stub = false;

  for (const d of todo) {
    try {
      const res = await vlmRun2(readFileSync(d.path));
      out[d.chcId] = res;
      stub = stub || Boolean(res._stub);
      const fields = Object.keys(res).filter((k) => k !== "_stub").length;
      console.log(`  ✓ ${d.chcId} — ${fields} field${fields === 1 ? "" : "s"}`);
    } catch (err) {
      const reason = String((err as Error)?.message ?? err);
      failed.push({ chcId: d.chcId, reason });
      console.log(`  ✗ ${d.chcId} — ${reason}`);
    }
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`\nWrote ${Object.keys(out).length} record(s) total, failed ${failed.length} this pass.`);
  for (const f of failed) console.log(`  - ${f.chcId}: ${f.reason}`);
  console.log(`JSON → ${outPath}`);
  if (stub) console.log("\nNote: STUB mode. Set GEMINI_API_KEY for real reads.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
