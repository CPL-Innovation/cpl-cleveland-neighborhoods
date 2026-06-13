// Accuracy (local CLI) — prints the rollup from the DB and writes data/scan/accuracy.csv.
// Parity with the old scan/accuracy.mjs, now reading Postgres via the shared lib.
import "./env.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { listRecords } from "@/lib/scan-store";
import { computeAccuracy, toCSV } from "@/lib/accuracy";
import { REPO_ROOT } from "./derive";

async function main() {
  const records = await listRecords();
  const acc = computeAccuracy(records);
  console.log(
    `Photos ${acc.totals.photos} · ready ${acc.totals.ready} · failed ${acc.totals.failed} · reviewed ${acc.totals.reviewed}\n`
  );
  const line = (label: string, s: typeof acc.address) =>
    s.denominator
      ? `  ${label}: ${s.correct_pct}% correct (${s.correct}/${s.denominator}; edited ${s.edited}, flagged-wrong ${s.flag_wrong}${s.flag_illegible ? `, illegible ${s.flag_illegible} excluded` : ""})`
      : `  ${label}: no reviewed records yet`;
  console.log("Handwriting accuracy (illegible excluded):");
  console.log(line("Address", acc.address));
  console.log(line("Year   ", acc.year));
  if (acc.description.denominator) {
    console.log(
      `\nDescription: accepted-as-is ${acc.description.accepted_pct}% (${acc.description.accepted}/${acc.description.denominator}; edited ${acc.description.edited}, rejected ${acc.description.rejected})`
    );
  }
  if (acc.misses.length) {
    console.log(`\nPhotos the VLM got wrong (${acc.misses.length}):`);
    for (const m of acc.misses) {
      console.log(`  - ${m.chc_id} [${m.field}] VLM: "${m.vlm}"${m.confirmed ? ` → human: "${m.confirmed}"` : " (flagged)"}`);
    }
  }

  const dir = resolve(REPO_ROOT, "data/scan");
  mkdirSync(dir, { recursive: true });
  const csvPath = resolve(dir, "accuracy.csv");
  writeFileSync(csvPath, toCSV(records));
  console.log(`\nCSV → ${csvPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
