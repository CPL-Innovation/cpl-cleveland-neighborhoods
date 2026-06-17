// Address → coordinates, the geocode seam for the Finalize stage (tier1-normalize-unify-spec
// §"Part A" + §"Finalize stage"). Mirrors the vlm-extract pattern: a real provider behind a seam
// that degrades gracefully, so the pipeline runs without external config and the geocode-miss
// exception tray (staff pin-drop) catches whatever doesn't auto-resolve.
//
// Discipline (the firebreak analogue): a wrong address auto-geocoded to a confident pin is worse
// than no pin. So we (1) refuse known-ambiguous address shapes BEFORE any network call — ranges
// ("17515-19"), "Rear of…", "near/opp/bet." — routing them straight to the staff tray, and
// (2) treat any provider failure as a miss, never a guess.
//
// Provider: OpenStreetMap Nominatim (keyless, public) by default — set GEOCODER=none to skip the
// network entirely (everything → needs-pin), or GEOCODER=nominatim (default). Nominatim asks for a
// descriptive User-Agent + ≤1 req/sec; the Finalize batch throttles between calls (GEOCODE_THROTTLE_MS).

import { setTimeout as sleep } from "node:timers/promises";

export type GeoSource = "verified_address" | "staff_lookup" | "inferred";

export interface GeoHit {
  ok: true;
  lat: number;
  lng: number;
  geoSource: GeoSource;
  geoConfidence: "exact" | "block" | "neighborhood";
}
export interface GeoMiss {
  ok: false;
  reason: string; // why it needs a human pin
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
  /\bside of\b/i,
  /\bvacant\b/i,
];
// A street-number RANGE: leading number immediately hyphenated to more digits, e.g.
// "17515-19", "16020-22-24 Grovewood Ave". The true frontage is ambiguous → staff pin.
const NUMBER_RANGE = /^\s*\d+\s*-\s*\d+/;

/** Classify an address string without any network call. Returns null when it looks geocodable. */
export function ambiguityReason(addressRaw: string | null | undefined): string | null {
  const a = (addressRaw ?? "").trim();
  if (!a) return "no address";
  if (NUMBER_RANGE.test(a)) return "address range — ambiguous frontage";
  for (const re of AMBIGUOUS) if (re.test(a)) return "descriptive / relative address";
  if (!/\d/.test(a)) return "no street number";
  return null;
}

async function nominatim(address: string): Promise<GeoResult> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=" +
    encodeURIComponent(`${address}, ${CITY_CONTEXT}`);
  const ctrl = new AbortController();
  const timer = global.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "cpl-cleveland-neighborhoods/finalize (local pilot; contact: library staff)" },
    });
    if (!res.ok) return { ok: false, reason: `geocoder ${res.status}` };
    const rows = (await res.json()) as Array<{ lat: string; lon: string; type?: string; addresstype?: string }>;
    const hit = rows[0];
    if (!hit) return { ok: false, reason: "no geocoder match" };
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, reason: "bad geocoder coords" };
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
    return { ok: false, reason: ctrl.signal.aborted ? "geocoder timeout" : (err as Error).message };
  } finally {
    global.clearTimeout(timer);
  }
}

/** Geocode one confirmed address. Ambiguous shapes + provider failures both return a GeoMiss. */
export async function geocodeAddress(addressRaw: string | null | undefined): Promise<GeoResult> {
  const reason = ambiguityReason(addressRaw);
  if (reason) return { ok: false, reason };
  if (provider === "none") return { ok: false, reason: "geocoder disabled (GEOCODER=none)" };
  return nominatim((addressRaw as string).trim());
}

/** Polite inter-request throttle for the Nominatim batch (no-op when the provider is off). */
export async function geocodeThrottle(): Promise<void> {
  if (provider !== "none" && THROTTLE_MS > 0) await sleep(THROTTLE_MS);
}
