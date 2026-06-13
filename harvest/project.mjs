#!/usr/bin/env node
// Tier 2 → Tier 3 projection.
//
// Reads data/tier2/records.jsonl (full-fidelity harvest) and writes the four
// lean files the patron frontend consumes:
//
//   records.json       — slim subset: id, title, date, lat/lng, neighborhood, thumb
//   search-index.json  — flat array of {id, blob} for client-side substring search
//   coverage.json      — counts answering the "Caveats" open questions in
//                        technical/contentdm-api.md (sortda / latitu / longit / place)
//   neighborhoods.json — derived from `place` field; counts per neighborhood
//
// Mapping follows the verified ContentDM field nicks in
// technical/contentdm-api.md §"Collection field schema."

import { createReadStream, existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HOST = "https://cplorg.contentdm.oclc.org";
const ALIAS = "p4014coll18";

const { values: ARGV } = parseArgs({
  options: {
    in: { type: "string", default: "data/tier2" },
    out: { type: "string", default: "data/tier3" },
  },
});

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const RECORDS_JSONL = resolve(REPO_ROOT, ARGV.in, "records.jsonl");
const TIER3_DIR = resolve(REPO_ROOT, ARGV.out);

if (!existsSync(RECORDS_JSONL)) {
  console.error(`Missing ${RECORDS_JSONL}. Run harvest.mjs first.`);
  process.exit(1);
}
await mkdir(TIER3_DIR, { recursive: true });

// dmwebservices returns empty fields as {} rather than "" or null. Treat any
// non-string/non-number as missing.
const isEmpty = (v) => v == null || v === "" || (typeof v === "object");

const num = (v) => {
  if (isEmpty(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v) => {
  if (isEmpty(v)) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

// "Hough" from "Hough neighborhood (Cleveland, Ohio)". Conservative — if it
// doesn't match the pattern, fall back to the whole string.
function extractNeighborhood(place) {
  if (!place) return null;
  const m = String(place).match(/^([^()]+?)\s+neighborhood/i);
  return m ? m[1].trim() : String(place).trim();
}

// Cleveland metro bounding box. Anything outside is treated as no-geo —
// guards against cataloging errors like lng=lat seen on a few records.
const CLE_BBOX = { latMin: 41.30, latMax: 41.70, lngMin: -82.00, lngMax: -81.40 };
function validGeo(lat, lng) {
  if (lat == null || lng == null) return false;
  return lat >= CLE_BBOX.latMin && lat <= CLE_BBOX.latMax &&
         lng >= CLE_BBOX.lngMin && lng <= CLE_BBOX.lngMax;
}

function projectRecord(rec) {
  const s = rec.source || {};
  let lat = num(s.latitu);
  let lng = num(s.longit);
  if (!validGeo(lat, lng)) { lat = null; lng = null; }
  const neighborhood = extractNeighborhood(str(s.place));
  return {
    id: rec.contentdm_id,
    title: str(s.title),
    date_display: str(s.date),
    sort_date: str(s.sortda),
    lat,
    lng,
    neighborhood,
    place_raw: str(s.place),
    subject: str(s.subjec),
    creator: str(s.creato) || str(s.contri),
    rights: str(s.rights),
    rights_uri: str(s.standa),
    physical_location: str(s.locati),
    thumb: `${HOST}/iiif/2/${ALIAS}:${rec.contentdm_id}/full/400,/0/default.jpg`,
    iiif_info: rec.iiif_info_url,
    contentdm_url: rec.contentdm_url,
  };
}

function searchBlob(p) {
  return [p.title, p.date_display, p.neighborhood, p.subject, p.creator, p.place_raw]
    .filter(Boolean)
    .join(" • ")
    .toLowerCase();
}

const records = [];
const coverage = {
  total: 0,
  with_sort_date: 0,
  with_latlng: 0,
  with_lat_only: 0,
  with_lng_only: 0,
  with_place: 0,
  with_subject: 0,
  with_rights_uri: 0,
};
const neighborhoodCounts = new Map();

const rl = createInterface({ input: createReadStream(RECORDS_JSONL), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    continue;
  }
  const p = projectRecord(rec);
  records.push(p);
  coverage.total++;
  if (p.sort_date) coverage.with_sort_date++;
  if (p.lat != null && p.lng != null) coverage.with_latlng++;
  else if (p.lat != null) coverage.with_lat_only++;
  else if (p.lng != null) coverage.with_lng_only++;
  if (p.place_raw) coverage.with_place++;
  if (p.subject) coverage.with_subject++;
  if (p.rights_uri) coverage.with_rights_uri++;
  if (p.neighborhood) {
    neighborhoodCounts.set(p.neighborhood, (neighborhoodCounts.get(p.neighborhood) || 0) + 1);
  }
}

const searchIndex = records.map((p) => ({ id: p.id, blob: searchBlob(p) }));

const neighborhoods = [...neighborhoodCounts.entries()]
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count);

const pct = (n) => (coverage.total ? ((n / coverage.total) * 100).toFixed(1) + "%" : "0%");
const coverageOut = {
  ...coverage,
  pct_with_sort_date: pct(coverage.with_sort_date),
  pct_with_latlng: pct(coverage.with_latlng),
  pct_with_place: pct(coverage.with_place),
  pct_with_subject: pct(coverage.with_subject),
  pct_with_rights_uri: pct(coverage.with_rights_uri),
  generated_at: new Date().toISOString(),
};

await writeFile(resolve(TIER3_DIR, "records.json"), JSON.stringify(records));
await writeFile(resolve(TIER3_DIR, "search-index.json"), JSON.stringify(searchIndex));
await writeFile(resolve(TIER3_DIR, "coverage.json"), JSON.stringify(coverageOut, null, 2));
await writeFile(resolve(TIER3_DIR, "neighborhoods.json"), JSON.stringify(neighborhoods, null, 2));

console.log(`Wrote ${records.length} records to ${TIER3_DIR}`);
console.log("Coverage:");
console.log(`  sortda:  ${coverageOut.with_sort_date}/${coverage.total} (${coverageOut.pct_with_sort_date})`);
console.log(`  lat+lng: ${coverageOut.with_latlng}/${coverage.total} (${coverageOut.pct_with_latlng})`);
console.log(`  place:   ${coverageOut.with_place}/${coverage.total} (${coverageOut.pct_with_place})`);
console.log(`  subject: ${coverageOut.with_subject}/${coverage.total} (${coverageOut.pct_with_subject})`);
console.log(`  rights:  ${coverageOut.with_rights_uri}/${coverage.total} (${coverageOut.pct_with_rights_uri})`);
console.log(`Top neighborhoods:`);
for (const n of neighborhoods.slice(0, 8)) console.log(`  ${n.count.toString().padStart(5)} ${n.name}`);
