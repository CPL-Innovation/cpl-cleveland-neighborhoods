// Run (local CLI) — the offline batch. For each master: derive → upload JPEG to the store →
// VLM read → upsert the scan_review row in Postgres. The per-master pipeline lives in
// lib/scan-ingest.ts (ingestOne), shared with the UI-driven ingest API.
//
//   npx tsx scan/run.ts                 derive + VLM every master
//   npx tsx scan/run.ts --only CHC016776   one photo (per-photo retry)
//   npx tsx scan/run.ts --force            re-derive + re-VLM even if already ready
import "./env.mjs"; // load .env.local / .env (DATABASE_URL, SUPABASE_*, GEMINI_API_KEY)
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { discoverMasters, REPO_ROOT } from "./derive";
import { ingestOne } from "@/lib/scan-ingest";
import { hasLiveKey, MODEL } from "@/lib/vlm-extract";

const { values: ARGV } = parseArgs({
  options: {
    in: { type: "string", default: "scans/masters" },
    only: { type: "string" },
    force: { type: "boolean", default: false },
  },
});

const IN_DIR = resolve(REPO_ROOT, ARGV.in as string);

async function main() {
  const all = discoverMasters(IN_DIR);
  const masters = ARGV.only ? all.filter((m) => m.chcId === ARGV.only) : all;
  if (ARGV.only && !masters.length) {
    console.error(`No master found for --only ${ARGV.only} in ${IN_DIR}`);
    process.exit(1);
  }

  const storageBackend =
    process.env.STORAGE_BACKEND === "supabase" ||
    (process.env.STORAGE_BACKEND !== "local" &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY)
      ? "Supabase"
      : "local disk";
  console.log(
    `Pipeline: ${masters.length} photo(s) · model=${MODEL} · ${hasLiveKey() ? "LIVE" : "STUB (no GEMINI_API_KEY)"} → ${storageBackend}`
  );

  const results = [];
  for (const m of masters) {
    results.push(await ingestOne(m, { force: ARGV.force as boolean, masterRel: `${ARGV.in}/${m.file}` }));
  }

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const skipped = ok.filter((r) => r.skipped);
  console.log(`\nReady ${ok.length} (${skipped.length} skipped), failed ${failed.length}.`);
  for (const f of failed) console.log(`  - ${f.chc_id} [${f.stage}]: ${f.reason}`);
  if (ok.some((r) => r.stub)) {
    console.log("\nNote: STUB mode. Set GEMINI_API_KEY for real reads.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
