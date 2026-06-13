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
