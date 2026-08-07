// Places — the same corner, photographed more than once.
//
// The archive is full of repeat visits: the city photographed 16133 Grovewood in 1978, 1981,
// 1982 and 1983, plus four undated passes. Plotted one-marker-per-photo those land on the
// identical coordinate, so eight pins stack and only the top one can be clicked — 86 of the
// 300 mappable photographs were unreachable that way.
//
// Grouping by coordinate fixes the reachability bug, but the better reason is that a stack
// isn't a collision: it's a sequence. One corner, several "thens", and (where a librarian has
// framed one) a "now".
import { unprojectXY, type Photo } from "@/components/patron/data";

/**
 * Coordinate → place key.
 *
 * 5 decimal places is ~1m, which is the right grain here: these photographs were geocoded from
 * the *same address string*, so siblings land on byte-identical coordinates. A looser key would
 * start merging genuinely different addresses on the same block, which is a different claim.
 */
export function placeKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/**
 * The map coordinate for a photo.
 *
 * Geocoded records (box-scans, harvested ContentDM with coords) carry real lat/lng; the curated
 * seed still carries legacy viewBox x/y. Both resolve here, and *everything* that groups photos
 * by location must go through this — the map and the panel disagreeing on how to read a
 * coordinate is exactly how the corner sequence failed to appear for harvested records.
 */
export function photoLatLng(p: Photo): { lat: number; lng: number } {
  return p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : unprojectXY(p.x, p.y);
}

export interface Place {
  key: string;
  lat: number;
  lng: number;
  /** Every photograph at this coordinate, oldest first; undated ones last. */
  photos: Photo[];
}

/** Undated photos carry year 0 (the adapters' sentinel) — sort them after the dated ones. */
export function byYear(a: Photo, b: Photo): number {
  const ay = a.year > 0 ? a.year : Infinity;
  const by = b.year > 0 ? b.year : Infinity;
  return ay - by;
}

/** Group photos into places. Order of places follows first appearance, so it's stable. */
export function groupIntoPlaces(photos: Photo[]): Place[] {
  const byKey = new Map<string, Place>();
  for (const p of photos) {
    const { lat, lng } = photoLatLng(p);
    const key = placeKey(lat, lng);
    const place = byKey.get(key);
    if (place) place.photos.push(p);
    else byKey.set(key, { key, lat, lng, photos: [p] });
  }
  for (const place of byKey.values()) place.photos.sort(byYear);
  return [...byKey.values()];
}

/** The photographs sharing a coordinate with this one, including it. */
export function siblingsOf(photo: Photo, photos: Photo[]): Photo[] {
  const here = photoLatLng(photo);
  const key = placeKey(here.lat, here.lng);
  return photos.filter((p) => {
    const at = photoLatLng(p);
    return placeKey(at.lat, at.lng) === key;
  }).sort(byYear);
}

/** "1978–1983", "1978", or null when nothing in the group carries a date. */
export function yearSpan(photos: Photo[]): string | null {
  const years = photos.map((p) => p.year).filter((y) => y > 0);
  if (!years.length) return null;
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}
