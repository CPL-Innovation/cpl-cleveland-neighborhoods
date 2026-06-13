// normalizeAddress() — collapse trivial formatting differences so a benign reformat
// ("2079 E 9th St" vs "2079 East 9th Street") does NOT register as an `edited` miss.
// Used by both the accuracy rollup (scan/accuracy.mjs) and the review UI (scan-review.jsx)
// so the headline accuracy % measures *reading*, not *punctuation*.
//
// Per scan-pipeline-ux.md §"Verdict & edit behavior" → "Formatting isn't a miss."

// Directional + street-type abbreviations → canonical long form.
const EXPANSIONS = [
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

/**
 * Canonicalize an address string for equality comparison.
 * @param {string} s
 * @returns {string} normalized form (lowercased, abbreviations expanded, punctuation
 *   stripped, whitespace collapsed). Returns "" for null/empty input.
 */
export function normalizeAddress(s) {
  if (!s) return "";
  let out = String(s).toLowerCase();
  out = out.replace(/[.,#]/g, " "); // drop punctuation that doesn't change the read
  out = out.replace(/\s+/g, " ").trim();
  for (const [re, full] of EXPANSIONS) out = out.replace(re, full);
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/**
 * True when two address strings are the same read modulo formatting.
 * @param {string} a
 * @param {string} b
 */
export function addressesMatch(a, b) {
  return normalizeAddress(a) === normalizeAddress(b);
}
