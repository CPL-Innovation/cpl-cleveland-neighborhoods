#!/usr/bin/env node
// Merge every data/tier3-<slug>/records.json into data/tier3-all/records.json.
// Dedupes by `id` (last write wins, but rec contents are deterministic).
// Also writes a merged coverage.json + neighborhoods.json + search-index.json.

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const DATA_DIR = resolve(REPO_ROOT, "data");
const OUT_DIR = resolve(DATA_DIR, "tier3-all");

const subsetDirs = (await readdir(DATA_DIR, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && d.name.startsWith("tier3-") && d.name !== "tier3-all")
  .map((d) => resolve(DATA_DIR, d.name));

if (!subsetDirs.length) {
  console.error("No data/tier3-<slug>/ subset directories found. Run project.mjs first.");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const byId = new Map();
const subsetCounts = {};
for (const dir of subsetDirs) {
  const path = resolve(dir, "records.json");
  if (!existsSync(path)) continue;
  const arr = JSON.parse(await readFile(path, "utf8"));
  const slug = dir.split("/").pop().replace(/^tier3-/, "");
  subsetCounts[slug] = arr.length;
  for (const rec of arr) byId.set(rec.id, rec);
}

const records = [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));

const neighborhoodCounts = new Map();
const coverage = {
  total: records.length,
  with_sort_date: 0,
  with_latlng: 0,
  with_place: 0,
  with_subject: 0,
  with_rights_uri: 0,
};
for (const p of records) {
  if (p.sort_date) coverage.with_sort_date++;
  if (p.lat != null && p.lng != null) coverage.with_latlng++;
  if (p.place_raw) coverage.with_place++;
  if (p.subject) coverage.with_subject++;
  if (p.rights_uri) coverage.with_rights_uri++;
  if (p.neighborhood) {
    neighborhoodCounts.set(p.neighborhood, (neighborhoodCounts.get(p.neighborhood) || 0) + 1);
  }
}

const pct = (n) => (coverage.total ? ((n / coverage.total) * 100).toFixed(1) + "%" : "0%");
const coverageOut = {
  ...coverage,
  pct_with_sort_date: pct(coverage.with_sort_date),
  pct_with_latlng: pct(coverage.with_latlng),
  pct_with_place: pct(coverage.with_place),
  subset_record_counts: subsetCounts,
  merged_subsets: Object.keys(subsetCounts),
  generated_at: new Date().toISOString(),
};

const neighborhoods = [...neighborhoodCounts.entries()]
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count);

const searchIndex = records.map((p) => ({
  id: p.id,
  blob: [p.title, p.date_display, p.neighborhood, p.subject, p.creator, p.place_raw]
    .filter(Boolean).join(" • ").toLowerCase(),
}));

await writeFile(resolve(OUT_DIR, "records.json"), JSON.stringify(records));
await writeFile(resolve(OUT_DIR, "search-index.json"), JSON.stringify(searchIndex));
await writeFile(resolve(OUT_DIR, "coverage.json"), JSON.stringify(coverageOut, null, 2));
await writeFile(resolve(OUT_DIR, "neighborhoods.json"), JSON.stringify(neighborhoods, null, 2));

console.log(`Merged ${records.length} records from ${Object.keys(subsetCounts).length} subset(s):`);
for (const [slug, n] of Object.entries(subsetCounts)) console.log(`  ${String(n).padStart(5)} ${slug}`);
console.log(`Neighborhoods: ${neighborhoods.map(n => `${n.name} (${n.count})`).join(", ")}`);
console.log(`Coverage: latlng ${coverageOut.pct_with_latlng}, sortda ${coverageOut.pct_with_sort_date}`);
