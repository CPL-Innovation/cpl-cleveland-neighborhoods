// Then-and-now: parsing a Google Maps Street View embed URL into the schema.
//
// A librarian frames the "now" by hand — walking Street View to the spot the archival
// photographer stood, matching the viewpoint, then using Google's "Share → Embed a map"
// to copy the URL. That beats any bearing we could compute from the address alone: the
// human is matching a *photograph*, not pointing at a coordinate.
//
// The URL's `pb` parameter is a packed tree of typed fields:
//
//   !4v1786075437984                 embed generated at (ms) — NOT the panorama capture date
//   !6m8!1m7                         container arity markers
//   !1sh9axPT4UrzIUob54N3Edww        s = string  → panorama id
//   !2m2!1d41.57571690308742         d = double  → latitude   (camera position)
//        !2d-81.56736950610885       d = double  → longitude
//   !3f347.57847263136347            f = float   → heading, degrees clockwise from north
//   !4f-4.556613281566413            f = float   → pitch, degrees (negative = looking down)
//   !5f0.7820865974627469            f = float   → field of view / zoom
//
// We keep the URL as the thing staff pasted, and ALSO unpack the camera geometry into the
// `rephoto_*` columns that already exist. That matters: if Street View is ever dropped, the
// framing survives as numbers we own, and can be pointed at another provider. Sealed inside
// an opaque Google string it would have to be re-curated by hand, 99 times over.

const EMBED_PREFIX = "https://www.google.com/maps/embed?pb=";

export interface RephotoFraming {
  /** The URL exactly as staff pasted it — the source of truth. */
  embedUrl: string;
  /** Google's panorama id, when present. */
  panoId: string | null;
  /** Camera position (where the modern photographer stands), not the subject. */
  lat: number | null;
  lng: number | null;
  /** Heading in degrees clockwise from north. */
  bearing: number | null;
  /** Pitch in degrees; negative looks down. */
  pitch: number | null;
}

/** Thrown for anything that isn't a Maps *embed* URL, so a bad paste fails loudly. */
export class RephotoUrlError extends Error {}

/**
 * Validate + unpack a Street View embed URL.
 *
 * Deliberately strict about the prefix. The column is rendered into an iframe `src`, so it
 * must never hold arbitrary markup or a non-Google origin — we store the URL rather than the
 * `<iframe>` snippet precisely so the app keeps control of sandbox, sizing and referrer policy.
 */
export function parseRephotoEmbed(input: string): RephotoFraming {
  const raw = input.trim();
  if (!raw) throw new RephotoUrlError("No URL given.");

  // Tolerate a pasted <iframe …> by lifting its src, since that is what Google's
  // "Embed a map" tab actually puts on the clipboard.
  const fromIframe = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(raw);
  const url = (fromIframe ? fromIframe[1] : raw).replace(/&amp;/g, "&");

  if (!url.startsWith(EMBED_PREFIX)) {
    throw new RephotoUrlError(
      `Not a Google Maps embed URL — expected it to start with "${EMBED_PREFIX}". ` +
        `Use Share → Embed a map on the Street View you framed.`,
    );
  }

  const pb = url.slice(EMBED_PREFIX.length);
  // Fields are `!<index><type><value>`; we only want the typed leaves we understand.
  const field = (index: number, type: "s" | "d" | "f"): string | null => {
    const m = new RegExp(`!${index}${type}([^!]+)`).exec(pb);
    return m ? m[1] : null;
  };
  const num = (v: string | null): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const framing: RephotoFraming = {
    embedUrl: url,
    panoId: field(1, "s"),
    lat: num(field(1, "d")),
    lng: num(field(2, "d")),
    bearing: num(field(3, "f")),
    pitch: num(field(4, "f")),
  };

  // A Street View embed always carries a camera position. A plain *map* embed doesn't —
  // catching that here stops a map iframe being filed as a rephoto viewpoint.
  if (framing.lat == null || framing.lng == null) {
    throw new RephotoUrlError(
      "That embed has no camera position — it looks like a map embed rather than a Street View. " +
        "Open Street View at the spot first, then Share → Embed a map.",
    );
  }
  if (framing.lat < -90 || framing.lat > 90 || framing.lng < -180 || framing.lng > 180) {
    throw new RephotoUrlError("The embed's coordinates are out of range.");
  }

  return framing;
}

/** Normalize a heading to [0, 360) for display. */
export function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** "347° (N)" — a compass reading a person can sanity-check against the photo. */
export function describeBearing(deg: number): string {
  const d = normalizeBearing(deg);
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return `${Math.round(d)}° (${points[Math.round(d / 22.5) % 16]})`;
}

// ── The unframed "now": a default Street View built from the address ────────────────
//
// Everything above describes a viewpoint a librarian FRAMED — walked to, matched against the
// print, and pasted in. That is the good version, and it stays the good version. But it exists
// for a few dozen photographs out of thousands, and the rest were showing no "now" at all even
// when we knew exactly where they were.
//
// So: where a photo has real coordinates and nobody has framed it, we synthesize a Street View
// at that point. It is NOT a then-and-now. Three things we cannot do without a Google API key:
//
//   1. Check that Street View covers the spot at all. The metadata endpoint is keyed; keyless,
//      a coordinate with no imagery renders grey. (Compare the CARTO basemap: HTTP 200, valid
//      PNG, "API KEY REQUIRED" painted across it. Providers fail by rendering.)
//   2. Aim it. The geocode is the SUBJECT — the building. The panorama is somewhere out on the
//      street, and we can't read where, so we can't compute the heading back toward the house.
//      We therefore set none and let Google use the panorama's own default (usually down the
//      street), rather than assert a bearing we'd be guessing.
//   3. Promise the house is even in shot. Nominatim often interpolates along the street.
//
// Which is why the panel labels this one differently and invites the reader to pan: the honest
// claim is "this is the street today, near this address", not "this is the same view".
//
// The URL is the old keyless `output=svembed` form — no API key, no billing, same as the `pb=`
// embeds staff paste. It is derived, never stored: there is no column for it and no write path.
// A synthesized URL in the database would be a second, stale home for a fact that is already
// fully determined by lat/lng.

export function autoStreetViewUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // Literal comma, not %2C — the encoded form is accepted and then rendered blank.
  const at = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  // ⚠ `cbp` is NOT optional, whatever it looks like. Drop it and the same URL still returns a
  // perfectly good embed — of a zoomed-out world map. No error, no console warning, no failed
  // request: `layer=c` alone silently degrades to map mode. (Third time this project has met a
  // vendor that fails by rendering; see the CARTO basemap note in CLAUDE.md.) The fields are
  // zoom,heading,tilt,?,pitch — heading 0 is due north, which is all we can honestly claim.
  return `https://maps.google.com/maps?q=&layer=c&cbll=${at}&cbp=11,0,0,0,0&source=embed&output=svembed&hl=en`;
}
