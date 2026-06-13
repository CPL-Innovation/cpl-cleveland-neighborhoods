// normalizeAddress() — collapse trivial formatting differences so a benign reformat
// ("2079 E 9th St" vs "2079 East 9th Street") does NOT register as an `edited` miss.
// Shared by the accuracy rollup and the review UI. Ported from scan/normalize-address.mjs
// (single source of truth — the old client-side copy in scan-review.jsx is retired).

const EXPANSIONS: [RegExp, string][] = [
  [/\bn\b/g, "north"],
  [/\bs\b/g, "south"],
  [/\be\b/g, "east"],
  [/\bw\b/g, "west"],
  [/\bne\b/g, "northeast"],
  [/\bnw\b/g, "northwest"],
  [/\bse\b/g, "southeast"],
  [/\bsw\b/g, "southwest"],
  [/\bst\b/g, "street"],
  [/\bave\b/g, "avenue"],
  [/\bav\b/g, "avenue"],
  [/\bblvd\b/g, "boulevard"],
  [/\brd\b/g, "road"],
  [/\bdr\b/g, "drive"],
  [/\bln\b/g, "lane"],
  [/\bct\b/g, "court"],
  [/\bpl\b/g, "place"],
  [/\bpkwy\b/g, "parkway"],
  [/\bsq\b/g, "square"],
  [/\bter\b/g, "terrace"],
  [/\bhwy\b/g, "highway"],
];

export function normalizeAddress(s: string | null | undefined): string {
  if (!s) return "";
  let out = String(s).toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, full] of EXPANSIONS) out = out.replace(re, full);
  return out.replace(/\s+/g, " ").trim();
}

export function addressesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeAddress(a) === normalizeAddress(b);
}
