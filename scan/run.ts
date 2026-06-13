// Run (local CLI) — the offline batch. For each master: derive → upload JPEG to Supabase
// Storage → VLM read → upsert the scan_review row in Postgres. Ported from scan/run.mjs,
// now DB + Storage backed instead of writing scan_review.json.
//
//   npx tsx scan/run.ts                 derive + VLM every master
//   npx tsx scan/run.ts --only CHC016776   one photo (per-photo retry)
//   npx tsx scan/run.ts --force            re-derive + re-VLM even if already ready
import "./env.mjs"; // load .env.local / .env (DATABASE_URL, SUPABASE_*, GEMINI_API_KEY)
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { discoverMasters, deriveOne, REPO_ROOT } from "./derive";
import { getRecord, upsert } from "@/lib/scan-store";
import { uploadDerivative } from "@/lib/storage";
import { vlmExtract, hasLiveKey, MODEL } from "@/lib/vlm-extract";

const { values: ARGV } = parseArgs({
  options: {
    in: { type: "string", default: "masters" },
    only: { type: "string" },
    force: { type: "boolean", default: false },
  },
});

const IN_DIR = resolve(REPO_ROOT, ARGV.in as string);

async function processOne(m: { file: string; chcId: string; path: string }) {
  const masterRel = `${ARGV.in}/${m.file}`;
  // Web-relative path to the derived JPEG (bookkeeping + the review UI's <img> fallback).
  // The actual file is written once, by the storage layer (public/derivatives/ locally,
  // or Supabase Storage when deployed) — no separate top-level copy.
  const jpegRel = `derivatives/${m.chcId}.jpg`;

  const existing = await getRecord(m.chcId);
  if (!ARGV.force && existing?.status === "ready") {
    return { chcId: m.chcId, ok: true, skipped: true };
  }

  // 1. Derive (sharp) → JPEG bytes.
  let jpeg: Buffer;
  let derive;
  try {
    ({ jpeg, meta: derive } = await deriveOne(m.path));
  } catch (err) {
    await upsert(m.chcId, {
      master_path: masterRel,
      derive: { status: "failed", reason: (err as Error).message },
      status: "failed",
      error: `derive: ${(err as Error).message}`,
    });
    return { chcId: m.chcId, ok: false, stage: "derive", reason: (err as Error).message };
  }

  // 2. Upload to Storage.
  let jpegUrl: string;
  try {
    jpegUrl = await uploadDerivative(m.chcId, jpeg);
  } catch (err) {
    await upsert(m.chcId, {
      master_path: masterRel,
      jpeg_path: jpegRel,
      derive,
      status: "failed",
      error: `upload: ${(err as Error).message}`,
    });
    return { chcId: m.chcId, ok: false, stage: "upload", reason: (err as Error).message };
  }

  // 3. VLM read.
  try {
    const vlm = await vlmExtract(jpeg, m.chcId);
    await upsert(m.chcId, {
      master_path: masterRel,
      jpeg_path: jpegRel,
      jpeg_url: jpegUrl,
      derive,
      vlm,
      status: "ready",
      error: null,
    });
    return { chcId: m.chcId, ok: true, stub: vlm._stub === true };
  } catch (err) {
    await upsert(m.chcId, {
      master_path: masterRel,
      jpeg_path: jpegRel,
      jpeg_url: jpegUrl,
      derive,
      status: "failed",
      error: `vlm: ${(err as Error).message}`,
    });
    return { chcId: m.chcId, ok: false, stage: "vlm", reason: (err as Error).message };
  }
}

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
  for (const m of masters) results.push(await processOne(m));

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const skipped = ok.filter((r) => (r as { skipped?: boolean }).skipped);
  console.log(`\nReady ${ok.length} (${skipped.length} skipped), failed ${failed.length}.`);
  for (const f of failed) console.log(`  - ${f.chcId} [${f.stage}]: ${f.reason}`);
  if (ok.some((r) => (r as { stub?: boolean }).stub)) {
    console.log("\nNote: STUB mode. Set GEMINI_API_KEY for real reads.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
