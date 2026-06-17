// Patron map photo data + projection helpers. Ported from cleveland-map.jsx.
// The curated sets (CLEVELAND_PHOTOS, MILLIONAIRES_ROW) are the demo seed; harvested
// ContentDM records (data/tier3-all/records.json) are adapted in at runtime and merged.
// The old window-global pool (window.ALL_PHOTOS / loadHarvestedPhotos) is retired — the
// landing holds the merged pool in React state and passes it down as props.

export interface Photo {
  id: string;
  x: number; // legacy viewBox coords; the map unprojects these back to lat/lng
  y: number;
  year: number;
  title: string;
  neighborhood: string;
  address: string;
  photographer: string;
  rights: string;
  branch: string;
  note: string | null;
  featured?: boolean;
  story?: string;
  // Harvested-only fields:
  contentdm_id?: string | number;
  thumb?: string;
  contentdm_url?: string;
  sort_date?: string;
  date_display?: string;
  lat?: number;
  lng?: number;
  // Convergence-slice (Tier 1.5 facets) — present only on the faceted 99:
  facets?: import("@/lib/types").Run2Facets;
  caption?: string | null;
  aiExtracted?: boolean; // render the "AI-extracted (staff-reviewable)" honesty label
}

// A raw Tier-3 harvested record (data/tier3-all/records.json). Loose by design.
export interface HarvestedRecord {
  id: string | number;
  lat?: number | null;
  lng?: number | null;
  sort_date?: string | null;
  title?: string | null;
  neighborhood?: string | null;
  creator?: string | null;
  rights_uri?: string | null;
  thumb?: string | null;
  contentdm_url?: string | null;
  date_display?: string | null;
}

const CLEVELAND_PHOTOS: Photo[] = [
  // West side market cluster
  { id: "wsm-1908", x: 360, y: 410, year: 1908, title: "West Side Market under construction",
    neighborhood: "Ohio City", address: "W. 25th & Lorain", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Carnegie West Branch",
    note: "The cornerstone was laid this year. The clock tower would come last." },
  { id: "wsm-1925", x: 380, y: 432, year: 1925, title: "Market day, W. 25th",
    neighborhood: "Ohio City", address: "W. 25th near Lorain", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Carnegie West Branch",
    note: "Saturday crowds. The streetcar tracks ran right through the entrance." },
  { id: "wsm-1932", x: 348, y: 388, year: 1932, title: "Lorain Ave looking east",
    neighborhood: "Ohio City", address: "Lorain & W. 28th", photographer: "Plain Dealer",
    rights: "Plain Dealer collection — contact for reuse", branch: "Carnegie West Branch",
    note: null },

  // Public Square
  { id: "ps-1903", x: 484, y: 376, year: 1903, title: "Public Square, trolley turnaround",
    neighborhood: "Downtown", address: "Public Square", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Main Library",
    note: "Three streetcar lines met here. The Soldiers & Sailors Monument is barely a decade old." },
  { id: "ps-1928", x: 506, y: 360, year: 1928, title: "Public Square at dusk",
    neighborhood: "Downtown", address: "Public Square", photographer: "Margaret Bourke-White",
    rights: "Public Domain (pre-1931)", branch: "Main Library",
    note: null },

  // Tremont
  { id: "tr-1915", x: 440, y: 510, year: 1915, title: "Lincoln Park bandstand",
    neighborhood: "Tremont", address: "Kenilworth & W. 11th", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "South Branch",
    note: "The bandstand stood for another forty years." },
  { id: "tr-1922", x: 412, y: 540, year: 1922, title: "St. Theodosius, dome",
    neighborhood: "Tremont", address: "733 Starkweather", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "South Branch",
    note: "Consecrated 1913. The Deer Hunter scenes were shot here fifty-six years later." },
  { id: "tr-1934", x: 470, y: 522, year: 1934, title: "Tremont rooftops",
    neighborhood: "Tremont", address: "W. 14th near Auburn", photographer: "WPA",
    rights: "CPL — display only", branch: "South Branch",
    note: "Depression-era housing survey. The corner is still here." },

  // Ohio City
  { id: "oc-1912", x: 332, y: 446, year: 1912, title: "Bridge Avenue houses",
    neighborhood: "Ohio City", address: "Bridge & W. 32nd", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Carnegie West Branch",
    note: null },

  // Lakefront
  { id: "lf-1918", x: 560, y: 232, year: 1918, title: "Lakefront docks",
    neighborhood: "Downtown", address: "E. 9th Pier", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Main Library",
    note: "Ore boats from the Mesabi range. The shoreline was four blocks closer then." },
  { id: "lf-1924", x: 640, y: 218, year: 1924, title: "Municipal Stadium site, before",
    neighborhood: "Downtown", address: "N. Marginal & E. 9th", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Main Library",
    note: null },

  // East side scatter
  { id: "es-1905", x: 820, y: 372, year: 1905, title: "E. 55th streetcar barn",
    neighborhood: "Midtown", address: "E. 55th & Quincy", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Sterling Branch",
    note: null },
  { id: "es-1920", x: 880, y: 410, year: 1920, title: "Quincy Ave corner store",
    neighborhood: "Fairfax", address: "Quincy & E. 79th", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Sterling Branch",
    note: "Run by the Mihelic family. The building is gone — the corner is still here." },
  { id: "es-1910", x: 760, y: 444, year: 1910, title: "Central Ave row houses",
    neighborhood: "Central", address: "Central near E. 40th", photographer: "Lewis Hine",
    rights: "Public Domain (pre-1931)", branch: "Sterling Branch",
    note: "Hine’s documentation of working-family housing." },
  { id: "es-1930", x: 700, y: 478, year: 1930, title: "Cedar–Central kids",
    neighborhood: "Central", address: "E. 30th & Cedar", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Sterling Branch",
    note: null },

  // Hough (sparse, intentional)
  { id: "ho-1932", x: 820, y: 300, year: 1932, title: "Hough Avenue, looking east",
    neighborhood: "Hough", address: "Hough & E. 79th", photographer: "WPA",
    rights: "CPL — display only", branch: "Hough Branch",
    note: "We’re still digitizing Hough. If you remember this corner, tell us." },

  // Detroit-Shoreway
  { id: "ds-1916", x: 280, y: 360, year: 1916, title: "Detroit Ave streetcar",
    neighborhood: "Detroit-Shoreway", address: "Detroit & W. 65th", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Lorain Branch",
    note: null },
  { id: "ds-1928", x: 240, y: 384, year: 1928, title: "Gordon Square theatre",
    neighborhood: "Detroit-Shoreway", address: "Detroit & W. 65th", photographer: "unknown",
    rights: "Public Domain (pre-1931)", branch: "Lorain Branch",
    note: null },
];

// Millionaire's Row — featured story along Euclid. Shared fields applied below.
const MILLIONAIRES_ROW_SEED: Array<Pick<Photo, "id" | "x" | "y" | "year" | "title" | "address" | "photographer" | "note">> = [
  { id: "mr-1", x: 480, y: 380, year: 1900, title: "Euclid Ave at E. 12th",
    address: "Euclid & E. 12th", photographer: "unknown",
    note: "The Wade mansion stood on the south side of Euclid until 1925." },
  { id: "mr-2", x: 540, y: 360, year: 1903, title: "Stone gate at the Hanna estate",
    address: "Euclid & E. 18th", photographer: "unknown", note: null },
  { id: "mr-3", x: 600, y: 340, year: 1906, title: "Carriage drive, Euclid Ave",
    address: "Euclid & E. 22nd", photographer: "unknown",
    note: "The Avenue was paved with cedar blocks. You can still find them under the asphalt." },
  { id: "mr-4", x: 660, y: 320, year: 1909, title: "Brush mansion front gate",
    address: "Euclid & E. 30th", photographer: "unknown", note: null },
  { id: "mr-5", x: 720, y: 300, year: 1912, title: "Rockefeller house, side view",
    address: "Euclid & E. 40th", photographer: "unknown",
    note: "Demolished 1938. The Cleveland Clinic main campus sits roughly here now." },
  { id: "mr-6", x: 780, y: 280, year: 1915, title: "Mather residence garden",
    address: "Euclid & E. 46th", photographer: "unknown",
    note: "This building is gone. The corner is still here." },
  { id: "mr-7", x: 840, y: 260, year: 1918, title: "Bingham mansion, winter",
    address: "Euclid & E. 55th", photographer: "unknown", note: null },
  { id: "mr-8", x: 900, y: 240, year: 1921, title: "Severance house porch",
    address: "Euclid & E. 62nd", photographer: "unknown", note: null },
  { id: "mr-9", x: 960, y: 220, year: 1924, title: "Last of the Euclid mansions",
    address: "Euclid & E. 71st", photographer: "unknown",
    note: "By 1924 most of the Row was rooming houses or commercial conversions." },
  { id: "mr-10", x: 1020, y: 200, year: 1927, title: "Euclid Ave widening",
    address: "Euclid & E. 79th", photographer: "Plain Dealer",
    note: "The Avenue was widened. Setbacks vanished. The Row vanished with them." },
  { id: "mr-11", x: 1080, y: 180, year: 1928, title: "Vacant lot, former Hay estate",
    address: "Euclid & E. 86th", photographer: "Plain Dealer", note: null },
];

export const MILLIONAIRES_ROW: Photo[] = MILLIONAIRES_ROW_SEED.map((p) => ({
  ...p,
  featured: true,
  neighborhood: "Midtown · Euclid Corridor",
  rights: p.year < 1931 ? "Public Domain (pre-1931)" : "CPL — display only",
  branch: "Main Library",
  story: "Millionaire’s Row",
}));

// Anchored linear projection: Public Square (lat 41.4995, lng -81.6938) -> viewBox (500, 395).
export function projectLatLng(lat: number, lng: number): { x: number; y: number } {
  return {
    x: 500 + (lng - -81.6938) * 2500,
    y: 395 - (lat - 41.4995) * 5000,
  };
}

// Inverse of projectLatLng — turn legacy SVG x/y back into lat/lng for Leaflet.
export function unprojectXY(x: number, y: number): { lat: number; lng: number } {
  return {
    lat: 41.4995 - (y - 395) / 5000,
    lng: -81.6938 + (x - 500) / 2500,
  };
}

function rightsFromUri(uri?: string | null): string {
  if (!uri) return "CPL — contact for reuse";
  if (/NoC-US|publicdomain|PDM/i.test(uri)) return "Public Domain";
  if (/InC\b/i.test(uri)) return "CPL — contact for reuse";
  return "CPL — contact for reuse";
}

export function adaptHarvestedRecord(rec: HarvestedRecord): Photo | null {
  if (rec.lat == null || rec.lng == null) return null;
  const { x, y } = projectLatLng(rec.lat, rec.lng);
  const year = rec.sort_date ? parseInt(String(rec.sort_date).slice(0, 4), 10) : NaN;
  if (!Number.isFinite(year)) return null;
  return {
    id: `cdm-${rec.id}`,
    contentdm_id: rec.id,
    x, y, year,
    title: rec.title || "Untitled",
    neighborhood: rec.neighborhood || "Central",
    address: rec.title || "",
    photographer: rec.creator || "unknown",
    rights: rightsFromUri(rec.rights_uri),
    branch: "Main Library",
    note: null,
    thumb: rec.thumb || undefined,
    contentdm_url: rec.contentdm_url || undefined,
    sort_date: rec.sort_date || undefined,
    date_display: rec.date_display || undefined,
  };
}

// Adapt a unified box-scan photo (from /api/patron/facets — the normalized 99) onto the map.
// Requires real coordinates (set by the Finalize stage's geocode/pin) + a usable year; the rest
// stay in the pool but off the map, exactly like ungeocoded ContentDM records. The honesty label
// (aiExtracted) travels with it since caption/facets are AI-extracted + staff-reviewable.
export function adaptFacetPhoto(fp: import("@/lib/types").FacetPhoto): Photo | null {
  if (fp.lat == null || fp.lng == null) return null;
  if (!Number.isFinite(fp.year ?? NaN)) return null;
  const { x, y } = projectLatLng(fp.lat, fp.lng);
  return {
    id: `box-${fp.chc_id}`,
    x, y,
    year: fp.year as number,
    title: fp.address || fp.chc_id,
    neighborhood: "Cleveland · City Hall box",
    address: fp.address || "",
    photographer: "unknown",
    rights: "CPL — display only",
    branch: "Cleveland Public Library",
    note: null,
    thumb: fp.jpeg_url,
    lat: fp.lat,
    lng: fp.lng,
    facets: fp.facets,
    caption: fp.caption,
    aiExtracted: true,
  };
}

// The curated demo pool — the landing fetches + merges harvested records on top of this.
export const CURATED_PHOTOS: Photo[] = [...CLEVELAND_PHOTOS, ...MILLIONAIRES_ROW];

export { CLEVELAND_PHOTOS };
