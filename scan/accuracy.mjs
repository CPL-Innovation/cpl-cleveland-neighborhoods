#!/usr/bin/env node
// Accuracy — the PoC's actual deliverable. A rollup of Surface B review verdicts.
//
// Spec: scan-pipeline-ux.md §"The eval".
//   - Handwriting (address, year): % correct vs edited, with `illegible` flags reported
//     separately and EXCLUDED from the denominator so bad handwriting doesn't punish
//     the VLM's grade.
//   - Description: % accepted-as-is / edited / rejected (qualitative, NOT a single score)
//     alongside the corpus of holistic review notes.
//   - The list of photos the VLM got wrong (the risk evidence).
//   - CSV export. No separate scoring pass.

import { writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadStore, STORE_DIR } from "./store.mjs";

function fieldStats(records, field) {
  let correct = 0, edited = 0, flagWrong = 0, flagIllegible = 0, unreviewed = 0;
  const misses = [];
  for (const r of records) {
    const f = r.review?.[field];
    const v = f?.verdict;
    if (v === "correct") correct++;
    else if (v === "edited") {
      edited++;
      misses.push({ chc_id: r.chc_id, field, vlm: r.vlm?.[field] ?? "", confirmed: f.value ?? "" });
    } else if (v === "flag") {
      if (f.flag_reason === "illegible") flagIllegible++;
      else { flagWrong++; misses.push({ chc_id: r.chc_id, field, vlm: r.vlm?.[field] ?? "", confirmed: "" }); }
    } else unreviewed++;
  }
  // Denominator excludes illegible flags (not the VLM's fault) and unreviewed.
  const denom = correct + edited + flagWrong;
  return {
    correct, edited, flag_wrong: flagWrong, flag_illegible: flagIllegible, unreviewed,
    denominator: denom,
    correct_pct: denom ? Math.round((correct / denom) * 1000) / 10 : null,
    misses,
  };
}

function descriptionStats(records) {
  let accepted = 0, edited = 0, rejected = 0, unreviewed = 0;
  const notes = [];
  for (const r of records) {
    const v = r.review?.description?.verdict;
    if (v === "accepted") accepted++;
    else if (v === "edited") edited++;
    else if (v === "rejected") rejected++;
    else unreviewed++;
    const note = (r.review?.notes || "").trim();
    if (note) notes.push({ chc_id: r.chc_id, note });
  }
  const denom = accepted + edited + rejected;
  return {
    accepted, edited, rejected, unreviewed,
    denominator: denom,
    accepted_pct: denom ? Math.round((accepted / denom) * 1000) / 10 : null,
    notes, // qualitative corpus — surfaced, never averaged into a number
  };
}

/** Compute the full accuracy rollup from a scan_review store map. */
export function computeAccuracy(map) {
  const records = Object.values(map);
  const reviewed = records.filter((r) => r.review?.status === "reviewed");
  const address = fieldStats(reviewed, "address");
  const year = fieldStats(reviewed, "year");
  const description = descriptionStats(reviewed);
  return {
    totals: {
      photos: records.length,
      ready: records.filter((r) => r.status === "ready").length,
      failed: records.filter((r) => r.status === "failed").length,
      reviewed: reviewed.length,
    },
    address,
    year,
    description,
    // Combined miss list (the risk evidence John needs).
    misses: [...address.misses, ...year.misses],
  };
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Per-photo CSV of the review verdicts — the granular eval table. */
export function toCSV(map) {
  const header = [
    "chc_id", "status", "review_status",
    "address_verdict", "address_vlm", "address_confirmed", "address_flag_reason",
    "year_verdict", "year_vlm", "year_confirmed", "year_flag_reason",
    "description_verdict", "description_vlm", "description_confirmed",
    "notes",
  ];
  const rows = [header.join(",")];
  for (const r of Object.values(map)) {
    const a = r.review?.address || {}, y = r.review?.year || {}, d = r.review?.description || {};
    rows.push([
      r.chc_id, r.status, r.review?.status || "unreviewed",
      a.verdict || "", r.vlm?.address || "", a.value || "", a.flag_reason || "",
      y.verdict || "", r.vlm?.year || "", y.value || "", y.flag_reason || "",
      d.verdict || "", r.vlm?.description || "", d.value || "",
      r.review?.notes || "",
    ].map(csvCell).join(","));
  }
  return rows.join("\n") + "\n";
}

function pctLine(label, s) {
  if (!s.denominator) return `  ${label}: no reviewed records yet`;
  return (
    `  ${label}: ${s.correct_pct}% correct ` +
    `(${s.correct}/${s.denominator}; edited ${s.edited}, flagged-wrong ${s.flag_wrong}` +
    `${s.flag_illegible ? `, illegible ${s.flag_illegible} excluded` : ""})`
  );
}

async function main() {
  const map = await loadStore();
  const acc = computeAccuracy(map);
  console.log(`Photos ${acc.totals.photos} · ready ${acc.totals.ready} · failed ${acc.totals.failed} · reviewed ${acc.totals.reviewed}\n`);
  console.log("Handwriting accuracy (illegible excluded from denominator):");
  console.log(pctLine("Address", acc.address));
  console.log(pctLine("Year   ", acc.year));
  const d = acc.description;
  console.log(`\nDescription outcomes${d.denominator ? "" : " (none reviewed)"}:`);
  if (d.denominator) {
    console.log(`  accepted-as-is ${d.accepted_pct}% (${d.accepted}/${d.denominator}; edited ${d.edited}, rejected ${d.rejected})`);
  }
  if (acc.misses.length) {
    console.log(`\nPhotos the VLM got wrong (${acc.misses.length}):`);
    for (const m of acc.misses) {
      console.log(`  - ${m.chc_id} [${m.field}]  VLM: "${m.vlm}"${m.confirmed ? ` → human: "${m.confirmed}"` : " (flagged, no correction)"}`);
    }
  }

  mkdirSync(STORE_DIR, { recursive: true });
  const csvPath = resolve(STORE_DIR, "accuracy.csv");
  await writeFile(csvPath, toCSV(map));
  console.log(`\nCSV → ${csvPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
