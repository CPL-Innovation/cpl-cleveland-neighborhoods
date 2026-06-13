// Accuracy rollup — ported from scan/accuracy.mjs, now operating on ScanRecord[] (DB rows).
// The PoC deliverable: a by-product of review verdicts, not a separate scoring pass.
import type {
  ScanRecord,
  FieldStats,
  DescriptionStats,
  AccuracyRollup,
  FieldMiss,
} from "@/lib/types";

function fieldStats(records: ScanRecord[], field: "address" | "year"): FieldStats {
  let correct = 0, edited = 0, flagWrong = 0, flagIllegible = 0, unreviewed = 0;
  const misses: FieldMiss[] = [];
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

function descriptionStats(records: ScanRecord[]): DescriptionStats {
  let accepted = 0, edited = 0, rejected = 0, unreviewed = 0;
  const notes: { chc_id: string; note: string }[] = [];
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
    notes,
  };
}

export function computeAccuracy(records: ScanRecord[]): AccuracyRollup {
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
    misses: [...address.misses, ...year.misses],
  };
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(records: ScanRecord[]): string {
  const header = [
    "chc_id", "status", "review_status",
    "address_verdict", "address_vlm", "address_confirmed", "address_flag_reason",
    "year_verdict", "year_vlm", "year_confirmed", "year_flag_reason",
    "description_verdict", "description_vlm", "description_confirmed",
    "notes",
  ];
  const rows = [header.join(",")];
  for (const r of records) {
    const a = r.review?.address, y = r.review?.year, d = r.review?.description;
    rows.push([
      r.chc_id, r.status, r.review?.status || "unreviewed",
      a?.verdict || "", r.vlm?.address || "", a?.value || "", a?.flag_reason || "",
      y?.verdict || "", r.vlm?.year || "", y?.value || "", y?.flag_reason || "",
      d?.verdict || "", r.vlm?.description || "", d?.value || "",
      r.review?.notes || "",
    ].map(csvCell).join(","));
  }
  return rows.join("\n") + "\n";
}
