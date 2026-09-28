// The basemap under the photographs — a *pale, quiet* map, because the dots are the subject and
// the city is context. Kept as a seam, not a hardcoded URL, for the reason this file exists:
//
// ⚠ CARTO gated their keyless raster basemaps. Every style (light_all, voyager, light_nolabels…)
// still answers HTTP 200 with a valid 256×256 PNG — which reads "API KEY REQUIRED" across the
// tile. Nothing in Leaflet, the console, or the network panel registers that as a failure, so the
// map "worked" while showing no map at all. A basemap can break by *rendering*, so the check that
// matters is a human looking at it.
//
// Default is keyless on purpose: this pilot runs without an API key or a billing relationship
// anywhere (same rule the then-and-now Street View embed follows). Esri's World Light Gray Canvas
// is the closest keyless match to Positron's look — near-white land, white roads, almost no
// colour — with place names on a separate reference layer, which is why `labels` exists below.

export interface Basemap {
  url: string;
  attribution: string;
  /** Deepest zoom the provider actually has tiles for; Leaflet upscales past it rather than blanking. */
  maxNativeZoom: number;
  subdomains?: string;
  /** Optional place-name layer drawn over the base (Esri splits labels out of the canvas). */
  labels?: { url: string; maxNativeZoom: number };
}

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const ESRI_LIGHT_GRAY: Basemap = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  attribution: `Tiles &copy; <a href="https://www.esri.com">Esri</a> — Esri, HERE, Garmin · ${OSM_ATTR} contributors`,
  maxNativeZoom: 16, // z17+ returns a blank tile, so Leaflet stretches z16 instead
  labels: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 16,
  },
};

/** CARTO Positron — the original look. Needs an API key since CARTO gated the free tiles. */
const cartoPositron = (apiKey: string): Basemap => ({
  url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(apiKey)}`,
  attribution: `${OSM_ATTR} · &copy; <a href="https://carto.com/attributions">CARTO</a>`,
  subdomains: "abcd",
  maxNativeZoom: 19,
});

/** Plain OpenStreetMap — keyless and unambiguous, but its colour fights the archival palette. */
const OSM_STANDARD: Basemap = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: `${OSM_ATTR} contributors`,
  maxNativeZoom: 19,
};

/**
 * Which basemap to draw. Set `NEXT_PUBLIC_CARTO_API_KEY` to go back to Positron exactly, or
 * `NEXT_PUBLIC_BASEMAP=osm` for plain OpenStreetMap. Default: keyless Esri light gray.
 */
export function basemap(): Basemap {
  const key = process.env.NEXT_PUBLIC_CARTO_API_KEY;
  const choice = (process.env.NEXT_PUBLIC_BASEMAP ?? "").toLowerCase();
  if (choice === "osm") return OSM_STANDARD;
  if (choice === "esri") return ESRI_LIGHT_GRAY;
  // A key is the only thing that makes CARTO work now, so it alone selects Positron.
  if (key) return cartoPositron(key);
  return ESRI_LIGHT_GRAY;
}
