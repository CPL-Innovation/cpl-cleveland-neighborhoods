#!/usr/bin/env node
// Bounded end-to-end test: enumerates 10 pointers, fetches their full records,
// runs the projection logic, and prints the results. Exercises the same code
// paths as harvest.mjs + project.mjs without committing to the ~40-minute run.

import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const HOST = "https://cplorg.contentdm.oclc.org";
const ALIAS = "p4014coll18";
const N = 10;

async function dm(fn, args) {
  const url = `${HOST}/digital/bl/dmwebservices/index.php?q=${fn}/${args.join("/")}/json`;
  const r = await fetch(url);
  return r.json();
}

const isEmpty = (v) => v == null || v === "" || typeof v === "object";
const str = (v) => (isEmpty(v) ? null : String(v).trim() || null);
const num = (v) => {
  if (isEmpty(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function neighborhoodFromPlace(place) {
  if (!place) return null;
  const m = String(place).match(/^([^()]+?)\s+neighborhood/i);
  return m ? m[1].trim() : String(place).trim();
}

const page = await dm("dmQuery", [ALIAS, "0", "dmrecord", "dmrecord", String(N), "1", "0", "0", "0", "0", "0", "0"]);
const pointers = page.records.map((r) => String(r.pointer ?? r.dmrecord));
console.log(`Enumerated ${pointers.length} of ${page.pager.total} total. Fetching...\n`);

const results = [];
for (const p of pointers) {
  await sleep(200);
  const info = await dm("dmGetItemInfo", [ALIAS, p]);
  const hash = createHash("sha256")
    .update(JSON.stringify(info, Object.keys(info).sort()))
    .digest("hex").slice(0, 16);
  results.push({
    id: p,
    title: str(info.title),
    date: str(info.date),
    sort_date: str(info.sortda),
    lat: num(info.latitu),
    lng: num(info.longit),
    neighborhood: neighborhoodFromPlace(str(info.place)),
    rights_uri: str(info.standa),
    physical_location: str(info.locati),
    thumb: `${HOST}/iiif/2/${ALIAS}:${p}/full/400,/0/default.jpg`,
    hash,
  });
}

console.log("Projected records:");
console.table(results.map((r) => ({
  id: r.id,
  title: (r.title || "").slice(0, 40),
  date: r.date,
  geo: r.lat != null && r.lng != null ? `${r.lat.toFixed(3)},${r.lng.toFixed(3)}` : null,
  nbhd: r.neighborhood,
})));

const cov = {
  with_sort_date: results.filter((r) => r.sort_date).length,
  with_latlng: results.filter((r) => r.lat != null && r.lng != null).length,
  with_neighborhood: results.filter((r) => r.neighborhood).length,
  with_rights_uri: results.filter((r) => r.rights_uri).length,
};
console.log(`\nCoverage on this ${N}-record sample:`, cov);
