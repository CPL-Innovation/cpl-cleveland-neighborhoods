#!/usr/bin/env node
// ContentDM harvest — Tier 1 → Tier 2 full-fidelity snapshot.
//
// Spec: technical/contentdm-api.md §"Recommended architecture" and
// §"Integration with the enrichment interface."
//
// Phase 1: page dmQuery to enumerate every pointer in p4014coll18.
// Phase 2: dmGetItemInfo per pointer for the full record.
// Phase 3: write JSONL with a stable source_record_hash per record.
//
// Resumable: re-running skips pointers already present in records.jsonl.
// Polite: throttled to ~5 req/s with retry+backoff on transient errors.

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HOST = "https://cplorg.contentdm.oclc.org";
const ALIAS = "p4014coll18";
const PAGE_SIZE = 1024;
const REQ_INTERVAL_MS = 200; // ~5 req/s
const MAX_RETRIES = 4;

const { values: ARGV } = parseArgs({
  options: {
    search: { type: "string", default: "0" }, // dmQuery search string; "0" = all
    out: { type: "string", default: "data/tier2" }, // output dir relative to repo root
  },
});

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const TIER2_DIR = resolve(REPO_ROOT, ARGV.out);
const RECORDS_PATH = resolve(TIER2_DIR, "records.jsonl");
const POINTERS_PATH = resolve(TIER2_DIR, "pointers.json");
const MANIFEST_PATH = resolve(TIER2_DIR, "manifest.json");

mkdirSync(TIER2_DIR, { recursive: true });
console.log(`Search: ${ARGV.search}`);
console.log(`Output: ${TIER2_DIR}`);

let lastReq = 0;
async function throttle() {
  const wait = REQ_INTERVAL_MS - (Date.now() - lastReq);
  if (wait > 0) await sleep(wait);
  lastReq = Date.now();
}

async function dmCall(fn, args = []) {
  const url = `${HOST}/digital/bl/dmwebservices/index.php?q=${fn}/${args.join("/")}/json`;
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await throttle();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
      const text = await res.text();
      // dmwebservices returns JSON-ish text; sometimes wraps errors as objects with `code`.
      const data = JSON.parse(text);
      if (data && typeof data === "object" && data.code === "-2") {
        throw new Error(`dmwebservices error: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err) {
      lastErr = err;
      const backoff = 500 * 2 ** attempt;
      console.warn(`  ! ${fn} attempt ${attempt + 1} failed (${err.message}); retrying in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function enumeratePointers() {
  if (existsSync(POINTERS_PATH)) {
    const cached = JSON.parse(await readFile(POINTERS_PATH, "utf8"));
    console.log(`Pointers cached: ${cached.length} (delete ${POINTERS_PATH} to re-enumerate)`);
    return cached;
  }

  console.log("Phase 1 — enumerating pointers via paged dmQuery…");
  const pointers = [];
  let total = Infinity;
  let start = 1;
  while (start <= total) {
    // ContentDM uses `^` as an in-searchstring separator (field^term^mode^conn);
    // keep it literal while still encoding spaces, parens, slashes, etc.
    const encodedSearch = encodeURIComponent(ARGV.search).replace(/%5E/g, "^");
    const args = [
      ALIAS,
      encodedSearch, // searchstring; "0" matches all
      "dmrecord",   // fields: just the pointer
      "dmrecord",   // sortby
      String(PAGE_SIZE),
      String(start),
      "0",          // suppress
      "0",          // docptr
      "0",          // suggest
      "0",          // facets
      "0",          // showunpub
      "0",          // denormalize
    ];
    const page = await dmCall("dmQuery", args);
    const pager = page.pager || {};
    total = Number(pager.total ?? 0);
    const records = page.records || [];
    for (const r of records) pointers.push(String(r.pointer ?? r.dmrecord));
    console.log(`  page start=${start} got=${records.length} total=${total}`);
    if (!records.length) break;
    start += records.length;
  }

  await writeFile(POINTERS_PATH, JSON.stringify(pointers, null, 2));
  console.log(`Phase 1 done — ${pointers.length} pointers written to ${POINTERS_PATH}`);
  return pointers;
}

async function loadHarvestedPointerSet() {
  const seen = new Set();
  if (!existsSync(RECORDS_PATH)) return seen;
  const rl = createInterface({ input: createReadStream(RECORDS_PATH), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.contentdm_id) seen.add(String(rec.contentdm_id));
    } catch {
      // tolerate partial last line on a crashed prior run
    }
  }
  return seen;
}

function hashRecord(obj) {
  const h = createHash("sha256");
  h.update(JSON.stringify(obj, Object.keys(obj).sort()));
  return h.digest("hex").slice(0, 16);
}

async function harvestRecords(pointers) {
  const seen = await loadHarvestedPointerSet();
  const remaining = pointers.filter((p) => !seen.has(p));
  console.log(`Phase 2 — ${seen.size} already harvested, ${remaining.length} remaining`);

  const out = createWriteStream(RECORDS_PATH, { flags: "a" });
  const now = new Date().toISOString();
  let done = 0;

  for (const pointer of remaining) {
    try {
      const info = await dmCall("dmGetItemInfo", [ALIAS, pointer]);
      const record = {
        contentdm_id: pointer,
        contentdm_alias: ALIAS,
        contentdm_url: `${HOST}/digital/collection/${ALIAS}/id/${pointer}`,
        iiif_info_url: `${HOST}/iiif/2/${ALIAS}:${pointer}/info.json`,
        last_synced_at: now,
        source_record_hash: hashRecord(info),
        source: info,
      };
      out.write(JSON.stringify(record) + "\n");
      done++;
      if (done % 100 === 0) {
        const totalDone = seen.size + done;
        console.log(`  harvested ${totalDone}/${pointers.length}`);
      }
    } catch (err) {
      console.error(`  X pointer=${pointer} failed permanently: ${err.message}`);
    }
  }
  out.end();
  await new Promise((r) => out.on("close", r));
  console.log(`Phase 2 done — appended ${done} records`);
}

async function writeManifest(pointers) {
  const harvested = await loadHarvestedPointerSet();
  const manifest = {
    alias: ALIAS,
    host: HOST,
    harvested_at: new Date().toISOString(),
    expected_pointers: pointers.length,
    harvested_pointers: harvested.size,
    missing: pointers.filter((p) => !harvested.has(p)),
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(
    `Manifest: ${manifest.harvested_pointers}/${manifest.expected_pointers} harvested` +
    (manifest.missing.length ? ` (${manifest.missing.length} missing)` : "")
  );
}

const start = Date.now();
const pointers = await enumeratePointers();
await harvestRecords(pointers);
await writeManifest(pointers);
console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
