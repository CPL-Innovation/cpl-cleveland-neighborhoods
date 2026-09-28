// Address → coordinates, the geocode seam for the Finalize stage (tier1-normalize-unify-spec
// §"Part A" + §"Finalize stage"). Mirrors the vlm-extract pattern: a real provider behind a seam
// that degrades gracefully, so the pipeline runs without external config and the geocode-miss
// exception tray (staff pin-drop) catches whatever doesn't auto-resolve.
//
// Discipline (the firebreak analogue): a wrong address auto-geocoded to a confident pin is worse
// than no pin. So we (1) refuse known-ambiguous address shapes BEFORE any network call — ranges
// ("17515-19"), "Rear of…", intersections ("Grovewood Ave. W. At E. 161 St."), "near/opp/bet." —
// routing them straight to the staff tray, and (2) treat any provider failure as a miss, never a
// guess.
//
// ⚠ A miss is NOT one thing, and the difference matters operationally:
//   • `ambiguous` — the shape is un-geocodable by policy. No network call. Permanent: a human pins it.
//   • `no_match`  — the provider answered, and OSM simply has no such house number. Permanent-ish.
//   • `provider`  — HTTP error, timeout, rate-limit, network down. TRANSIENT: the address may well
//                   resolve on the next run, so the caller must be able to retry it.
// Collapsing these three into one "couldn't resolve" is what makes a working geocoder look broken:
// a photograph parked in the pin tray by a two-second outage is indistinguishable from one OSM
// genuinely can't place. Hence `GeoMiss.kind`, which the Finalize stage persists.
//
// Provider: OpenStreetMap Nominatim (keyless, public) by default — set GEOCODER=none to skip the
// network entirely (everything → needs-pin), or GEOCODER=nominatim (default). Nominatim asks for a
// descriptive User-Agent + ≤1 req/sec; the Finalize batch throttles between calls (GEOCODE_THROTTLE_MS).

import { setTimeout as sleep } from "node:timers/promises";

export type GeoSource = "verified_address" | "staff_lookup" | "inferred";
export type GeoMissKind = "ambiguous" | "no_match" | "provider";

export interface GeoHit {
  ok: true;
  lat: number;
  lng: number;
  geoSource: GeoSource;
  geoConfidence: "exact" | "block" | "neighborhood";
}
export interface GeoMiss {
  ok: false;
  kind: GeoMissKind;
  reason: string; // why it needs a human pin — shown verbatim in the Finalize tray
}
export type GeoResult = GeoHit | GeoMiss;

const CITY_CONTEXT = process.env.GEOCODE_CITY ?? "Cleveland, Ohio, USA";
const THROTTLE_MS = Number(process.env.GEOCODE_THROTTLE_MS ?? 1100);
const provider = (process.env.GEOCODER ?? "nominatim").toLowerCase();

// Address shapes we will NOT auto-geocode — they need a human pin (spec's examples + obvious kin).
const AMBIGUOUS = [
  /\brear of\b/i,
  /\bnear\b/i,
  /\bopp\.?\b/i,
  /\bbet\.?\b/i,
  /\bcorner of\b/i,
  /\bside\b/i, // "W. Side E. 161 St. N. At Grovewood Ave." — a frontage, not an address
  /\bat\b/i, // an intersection ("Grovewood Ave. W. At E. 161 St."); Nominatim can't place these
  /\bvacant\b/i,
];
// A street-number RANGE: leading number immediately hyphenated to more digits, e.g.
// "17515-19", "16020-22-24 Grovewood Ave". The true frontage is ambiguous → staff pin.
const NUMBER_RANGE = /^\s*\d+\s*-\s*\d+/;

/**
 * The query we actually send, stripped of archival apparatus the cataloger wrote for a human.
 *
 * These prints carry marginalia in the address line — "(Year of)", "A.K.A 1178-80 E. 167 St." —
 * which is meaningful provenance and useless to a gazetteer: Nominatim reads the whole string and
 * returns nothing. We keep `address_raw` verbatim (the archival evidence) and clean only the copy
 * sent over the wire.
 */
export function geocodeQuery(addressRaw: string): string {
  return addressRaw
    .replace(/\([^)]*\)/g, " ") // "(Year of)", "(rear)"
    .replace(/\ba\.?k\.?a\.?\b.*$/i, " ") // "… A.K.A 1178-80 E. 167 St."
    .replace(/\s*\.\s*$/, "") // a lone trailing period ("Grovewood Ave .")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classify an address string without any network call. Returns null when it looks geocodable. */
export function ambiguityReason(addressRaw: string | null | undefined): string | null {
  const a = geocodeQuery((addressRaw ?? "").trim());
  if (!a) return "no address";
  if (NUMBER_RANGE.test(a)) return "address range — ambiguous frontage";
  if (/\bat\b/i.test(a) || /\bside\b/i.test(a)) return "intersection / relative frontage";
  for (const re of AMBIGUOUS) if (re.test(a)) return "descriptive / relative address";
  if (!/\d/.test(a)) return "no street number";
  return null;
}

async function nominatimOnce(query: string): Promise<GeoResult> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=" +
    encodeURIComponent(`${query}, ${CITY_CONTEXT}`);
  const ctrl = new AbortController();
  const timer = global.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "cpl-cleveland-neighborhoods/finalize (local pilot; contact: library staff)" },
    });
    if (!res.ok) return { ok: false, kind: "provider", reason: `geocoder returned HTTP ${res.status}` };
    const rows = (await res.json()) as Array<{ lat: string; lon: string; type?: string; addresstype?: string }>;
    const hit = rows[0];
    if (!hit) return { ok: false, kind: "no_match", reason: "no match in OpenStreetMap" };
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, kind: "provider", reason: "geocoder returned unusable coordinates" };
    }
    // House-number / building match → exact; otherwise a street/area centroid → coarser.
    const exact = hit.addresstype === "building" || hit.type === "house" || hit.addresstype === "house_number";
    return {
      ok: true,
      lat,
      lng,
      geoSource: exact ? "verified_address" : "inferred",
      geoConfidence: exact ? "exact" : "block",
    };
  } catch (err) {
    return {
      ok: false,
      kind: "provider",
      reason: ctrl.signal.aborted ? "geocoder timed out" : `geocoder unreachable — ${(err as Error).message}`,
    };
  } finally {
    global.clearTimeout(timer);
  }
}

/**
 * Geocode one confirmed address. Ambiguous shapes never touch the network; provider failures get
 * exactly one polite retry (a public keyless service drops the occasional request) before being
 * reported as transient.
 */
export async function geocodeAddress(addressRaw: string | null | undefined): Promise<GeoResult> {
  const reason = ambiguityReason(addressRaw);
  if (reason) return { ok: false, kind: "ambiguous", reason };
  if (provider === "none") return { ok: false, kind: "provider", reason: "geocoder disabled (GEOCODER=none)" };

  const query = geocodeQuery((addressRaw as string).trim());
  const first = await nominatimOnce(query);
  if (first.ok || first.kind !== "provider") return first;
  await sleep(Math.max(THROTTLE_MS, 1100));
  return nominatimOnce(query);
}

/** Polite inter-request throttle for the Nominatim batch (no-op when the provider is off). */
export async function geocodeThrottle(): Promise<void> {
  if (provider !== "none" && THROTTLE_MS > 0) await sleep(THROTTLE_MS);
}
