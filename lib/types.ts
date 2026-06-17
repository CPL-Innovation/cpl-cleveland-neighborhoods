// Shared types for the scan pipeline + enrichment. The JSONB columns in drizzle/schema.ts
// are typed with these so the scan_review shape is checked end-to-end (CLI → DB → API → UI).

// Three flat verdicts: correct (VLM matched), edited (VLM wrong, reviewer fixed → the only
// "miss"), illegible (no human can read it → excluded from the accuracy denominator).
export type AddressYearVerdict = "correct" | "edited" | "illegible";
export type DescriptionVerdict = "accepted" | "edited" | "rejected";
export type RecordStatus = "discovered" | "derived" | "ready" | "failed";
export type ReviewStatus = "unreviewed" | "reviewed";

export interface ReviewField {
  verdict: AddressYearVerdict | null;
  value: string;
}

export interface ReviewDescription {
  verdict: DescriptionVerdict | null;
  value: string;
}

export interface Review {
  address: ReviewField;
  year: ReviewField;
  description: ReviewDescription;
  notes: string;
  status: ReviewStatus;
}

export interface VlmResult {
  address: string;
  year: string;
  description: string;
  objects: string[];
  _stub?: boolean;
}

// ── Tier 1.5 facet discovery (vlmFacet — sibling to vlmExtract) ──
// Discovery-run output (build/enrichment-app/vlm-facet-spec.md §"Run 1", v0.3 prompt): a
// visible-only inventory grouped by candidate axis. The container shape is enforced (these
// keys, all optional, string-array values) but the string VALUES are free — natural
// vocabulary surfaces. Categories omitted when nothing is visible (absence is signal).
// v0.3 split the print-object layer out of `other` into archival_markup (intentional
// librarian marks — findable signal) + print_condition (physical defects — noise).
// Analysis artifact only — never written to photo_enrichment / scan_review.
export interface VisibleInventory {
  // Scene categories — the depicted world
  structures?: string[];
  materials?: string[];
  street_and_ground?: string[];
  transport?: string[];
  people_and_activity?: string[];
  text_in_scene?: string[];
  vegetation?: string[];
  condition_and_change?: string[];
  // Print-object categories — marks/defects ON the print, not in the scene
  archival_markup?: string[];
  print_condition?: string[];
  // Catch-all
  other?: string[];
}

export interface FacetResult {
  visible_inventory: VisibleInventory;
  _stub?: boolean;
}

// The three discovery arms for the v0.3 cross-check (vlm-facet-spec §"Build brief — v0.3").
export type FacetProvider = "gemini" | "opus" | "gpt5";

// ── Tier 1.5 Run 2 — the enforced v1 LOCKED facet schema (vlm-facet-spec §"Run 2 — the
// enforced schema"). Discovery froze the container + freed the values; Run 2 ALSO constrains
// the values to closed enums. Every field is optional — "omit when not visible" is enforced by
// the no-fabrication guard, and an empty/omitted field is the correct answer when evidence is
// absent. soft-confidence fields (building_type, roof_form) carry a *_confidence sibling.
// Eval artifact only — never written to photo_enrichment / scan_review until the A/B clears.
export type FacetConfidence = "high" | "medium" | "low";
export type BuildingType =
  | "single_family"
  | "multi_family"
  | "commercial"
  | "civic"
  | "accessory_only"
  | "mixed";
export type Stories = "1" | "1.5" | "2" | "2.5" | "3plus" | "unknown";
export type RoofForm = "gable" | "hip" | "flat" | "gambrel" | "mansard" | "dormer";
export type AccessoryStructure = "detached_garage" | "shed" | "fence" | "chimney" | "outbuilding";
export type Material = "wood_frame" | "brick" | "stone" | "concrete_block" | "stucco" | "metal" | "glass";
export type StreetGround =
  | "paved_street"
  | "sidewalk"
  | "curb"
  | "driveway"
  | "dirt_unpaved"
  | "brick_street"
  | "snow_cover"
  | "open_lot"
  | "cracked_pavement"; // v0.5: a ground STATE, moved here from condition_and_change
export type TransportFeature =
  | "utility_poles"
  | "overhead_wires"
  | "parked_cars"
  | "street_lights"
  | "street_signs"
  | "streetcar_tracks";
export type Vegetation = "trees" | "grass_lawn" | "shrubs" | "weeds_overgrown" | "bare_trees";
export type SceneTextKind = "business_name" | "street_sign" | "poster" | "address" | "other";
export type ArchivalMarkupKind = "date_stamp" | "catalog_code" | "ink_annotation" | "drawn_mark";
// CHANGE-ONLY: fires on visible evidence of transition; empty array = stable/intact default.
// NEVER includes an empty/vacant lot (that is a ground fact → street_and_ground: open_lot).
export type ConditionChange =
  | "boarded_shuttered"
  | "demolition_rubble"
  | "under_construction"
  | "fire_damage"
  | "deteriorating"; // v0.5: cracked_pavement removed (it's a ground state → street_and_ground)
export type PersonPresent = "people" | "children" | "workers" | "vendors" | "animals";

export interface SceneTextItem {
  text: string;
  kind: SceneTextKind;
}
export interface ArchivalMarkupItem {
  text: string;
  kind: ArchivalMarkupKind;
}

// One faceted photo as the patron convergence slice consumes it (live read of the enrichment
// store — vlm-facet-spec / convergence-slice-spec). facets = the graduated v0.5 record;
// caption/year/address come from the box-scan's Tier-1 record. Read-only on the patron side.
export interface FacetPhoto {
  chc_id: string;
  jpeg_url: string;
  year: number | null;
  address: string | null;
  caption: string | null;
  lat: number | null; // normalized (Finalize stage) — null until geocoded/pinned
  lng: number | null;
  facets: Run2Facets;
}

export interface Run2Facets {
  // BUILDING (decomposed from raw `structures`)
  building_type?: BuildingType;
  building_type_confidence?: FacetConfidence; // soft-confidence sibling
  stories?: Stories;
  roof_form?: RoofForm[];
  roof_form_confidence?: FacetConfidence; // soft-confidence sibling
  has_porch?: boolean;
  accessory_structures?: AccessoryStructure[];
  // ENVIRONMENT (multi-select set-membership, unordered)
  materials?: Material[];
  street_and_ground?: StreetGround[];
  transport?: TransportFeature[];
  vegetation?: Vegetation[];
  // FREE-TEXT transcription arrays (light kind enum)
  scene_text?: SceneTextItem[];
  archival_markup?: ArchivalMarkupItem[];
  // CHANGE-ONLY enum
  condition_and_change?: ConditionChange[];
  // DEMOTED
  has_print_damage?: boolean;
  people_present?: PersonPresent[];
  _stub?: boolean;
}

export interface DeriveMeta {
  status: "ok" | "failed";
  reason?: string;
  srcDpi?: number;
  srcWidth?: number;
  srcHeight?: number;
  srcSpace?: string;
  srcDepth?: string;
  srcPages?: number;
  outWidth?: number;
  outDpi?: number;
}

// ── Prep stage (crop & deskew) — turns raw/ flatbed scans into clean masters/ ──
// A separate working domain from scan_review: Prep's only output is masters/<CHC>.tif,
// which is the boundary the downstream Run stage already assumes.
export type PrepStatus = "pending" | "auto_ok" | "flagged" | "fixed" | "approved";

// Engine flag keys (kept as strings so adding heuristics needs no schema change):
//   clip_top · large_angle · extreme_aspect · multi_component · detect_weak
export type PrepFlag = string;

// The crop box in RAW full-resolution pixels — center, size, skew angle (deg).
// deskew rotates by -angle. The frontend editor maps these to screen with one uniform scale.
export interface PrepBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
}

export interface PrepRecord {
  chc_id: string;
  raw_path: string | null; // raw/<CHC>.tif (the input flatbed scan)
  status: PrepStatus;
  box: PrepBox | null;
  flags: PrepFlag[];
  raw_w: number | null;
  raw_h: number | null;
  raw_preview: string | null; // /prep/<CHC>.raw.jpg (served off public/)
  crop_preview: string | null; // /prep/<CHC>.crop.jpg
  threshold_mult: number;
  area_frac: number | null;
  ms: number | null; // last engine wall-clock (ms) — feeds the throughput stat
  master_path: string | null; // masters/<CHC>.tif once approved + written
  error: string | null;
  created_at?: string;
  updated_at?: string;
}

// raw/ folder listing cross-referenced with prep state (mirrors MasterEntry's shape).
// Carries enough of the prep row that the contact-sheet grid AND the crop editor share one
// list call: previews for the tiles, box + raw dimensions for the editor's overlay.
export interface RawEntry {
  file: string;
  chc_id: string;
  size: number;
  status: PrepStatus | "new"; // "new" when no prep row exists yet
  flags: PrepFlag[];
  raw_preview: string | null;
  crop_preview: string | null;
  box: PrepBox | null;
  raw_w: number | null;
  raw_h: number | null;
}

// What the `accept` path writes — photo_enrichment-shaped (a subset for this slice).
export interface EnrichmentDraft {
  patron_caption: string | null;
  accessibility_alt_text: string | null;
  date_start: string | null;
  date_end: string | null;
  date_precision: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood_tag: string | null;
  caption_quality: string;
  public_status: string;
  record_key: string;
}

// The per-photo working record (mirrors scan/store.mjs, now DB-backed).
export interface ScanRecord {
  chc_id: string;
  master_path: string | null;
  jpeg_url: string | null; // Supabase Storage public URL (what the UI <img> loads)
  jpeg_path: string | null; // local derivative path (CLI bookkeeping)
  derive: DeriveMeta | null;
  vlm: VlmResult | null;
  status: RecordStatus;
  error: string | null;
  review: Review;
  enrichment: EnrichmentDraft | null;
  created_at?: string;
  updated_at?: string;
}

export function emptyReview(): Review {
  return {
    address: { verdict: null, value: "" },
    year: { verdict: null, value: "" },
    description: { verdict: null, value: "" },
    notes: "",
    status: "unreviewed",
  };
}

// ── Accuracy rollup (mirrors scan/accuracy.mjs computeAccuracy output) ──
export interface FieldMiss {
  chc_id: string;
  field: "address" | "year";
  vlm: string;
  confirmed: string;
}

export interface FieldStats {
  correct: number;
  edited: number;
  illegible: number; // reported separately; NOT in the denominator
  unreviewed: number;
  denominator: number;
  correct_pct: number | null;
  misses: FieldMiss[];
}

export interface DescriptionStats {
  accepted: number;
  edited: number;
  rejected: number;
  unreviewed: number;
  denominator: number;
  accepted_pct: number | null;
  notes: { chc_id: string; note: string }[];
}

export interface AccuracyRollup {
  totals: { photos: number; ready: number; failed: number; reviewed: number };
  address: FieldStats;
  year: FieldStats;
  description: DescriptionStats;
  misses: FieldMiss[];
}
