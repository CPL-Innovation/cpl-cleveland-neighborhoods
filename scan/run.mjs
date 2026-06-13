#!/usr/bin/env node
// Run — the pipeline orchestrator that Surface A reports on.
//
// Spec: scan-pipeline-ux.md §"Pipeline stages" 3–4 and §"Failure handling".
//   - Derive all masters (delegates to derive.mjs), then call vlmExtract once per JPEG.
//   - Write the vlm block + status (ready | failed, with reason) into scan_review.json.
//   - A failed photo is itemized and does NOT block the batch.
//   - `--only <CHC_ID>` re-attempts a single photo (per-photo retry — NOT the killed
//     "re-run the whole pass" feature).

import "./env.mjs"; // load .env → process.env (GEMINI_API_KEY) before the adapter reads it
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadStore, saveStore, upsert, REPO_ROOT } from "./store.mjs";
import { discoverMasters, deriveOne } from "./derive.mjs";
import { vlmExtract, hasLiveKey, MODEL } from "./vlm-extract.mjs";

const { values: ARGV } = parseArgs({
  options: {
    in: { type: "string", default: "masters" },
    out: { type: "string", default: "derivatives" },
    only: { type: "string" }, // re-attempt a single CHC ID
    force: { type: "boolean", default: false }, // re-derive + re-VLM even if present
  },
});

const IN_DIR = resolve(REPO_ROOT, ARGV.in);
const OUT_DIR = resolve(REPO_ROOT, ARGV.out);

async function ensureDerived(store, m) {
  const jpegPath = resolve(OUT_DIR, `${m.chcId}.jpg`);
  const jpegRel = `${ARGV.out}/${m.chcId}.jpg`;
  const masterRel = `${ARGV.in}/${m.file}`;
  if (!ARGV.force && existsSync(jpegPath)) {
    upsert(store, m.chcId, { master_path: masterRel, jpeg_path: jpegRel });
    return { jpegPath, jpegRel };
  }
  const derive = await deriveOne(m.path, jpegPath);
  upsert(store, m.chcId, {
    master_path: masterRel,
    jpeg_path: jpegRel,
    derive,
    status: "derived",
    error: null,
  });
  return { jpegPath, jpegRel };
}

async function processOne(store, m) {
  // Derive (or confirm derived), then VLM.
  let jpegRel;
  try {
    ({ jpegRel } = await ensureDerived(store, m));
  } catch (err) {
    upsert(store, m.chcId, {
      derive: { status: "failed", reason: err.message },
      status: "failed",
      error: `derive: ${err.message}`,
    });
    return { chcId: m.chcId, ok: false, stage: "derive", reason: err.message };
  }

  try {
    const vlm = await vlmExtract(jpegRel);
    upsert(store, m.chcId, { vlm, status: "ready", error: null });
    return { chcId: m.chcId, ok: true, stub: vlm._stub === true };
  } catch (err) {
    upsert(store, m.chcId, { status: "failed", error: `vlm: ${err.message}` });
    return { chcId: m.chcId, ok: false, stage: "vlm", reason: err.message };
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const all = discoverMasters(IN_DIR);
  const masters = ARGV.only ? all.filter((m) => m.chcId === ARGV.only) : all;

  if (ARGV.only && !masters.length) {
    console.error(`No master found for --only ${ARGV.only} in ${IN_DIR}`);
    process.exit(1);
  }

  console.log(
    `Pipeline: ${masters.length} photo(s) · model=${MODEL} · ${hasLiveKey() ? "LIVE" : "STUB (no GEMINI_API_KEY)"}`
  );

  const store = await loadStore();
  const results = [];
  let done = 0;
  for (const m of masters) {
    results.push(await processOne(store, m));
    if (++done % 25 === 0) {
      await saveStore(store); // periodic checkpoint for long runs
      console.log(`  …${done}/${masters.length}`);
    }
  }
  await saveStore(store);

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`\nReady ${ok.length}, failed ${failed.length}.`);
  if (failed.length) {
    console.log("Failures (re-attempt with --only <CHC_ID>):");
    for (const f of failed) console.log(`  - ${f.chcId} [${f.stage}]: ${f.reason}`);
  }
  if (ok.some((r) => r.stub)) {
    console.log("\nNote: ran in STUB mode. Set GEMINI_API_KEY for real address/year/description.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
