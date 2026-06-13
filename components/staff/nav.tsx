"use client";
// Navigation context + the adapted-record type, ported from staff-app.jsx.
// The StaffApp provider lives in app.tsx; this module holds the context, the useNav hook,
// SAMPLE_RECORDS (fallback data), and adaptHarvestedToStaff.
import React from "react";

export type ToastTone = "info" | "ok" | "warn";

export interface NavigateOpts {
  id?: string;
  savedView?: string;
}

// The shape the staff screens consume (output of adaptHarvestedToStaff + SAMPLE_RECORDS).
export interface StaffRecord {
  id: string;
  thumb?: number;
  thumbUrl?: string | null;
  contentdmUrl?: string | null;
  title: string;
  year?: string;
  nbhd?: string;
  themes?: string[];
  geo?: string;
  conf?: string;
  caption?: string;
  status?: string;
  alt?: string;
  notes?: number;
  selected?: boolean;
  captionText?: string;
  noteText?: string;
  doneGeo?: boolean;
  needsRewrite?: boolean;
  physicalLocation?: string | null;
  creator?: string | null;
  rights?: string | null;
  rightsUri?: string | null;
}

export interface NavCtx {
  view: string;
  recordId: string | null;
  scanId: string | null;
  savedView: string;
  selection: Set<string>;
  navigate: (target: string, opts?: NavigateOpts) => void;
  toast: (text: string, tone?: ToastTone) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  records: StaffRecord[];
}

export const SAMPLE_RECORDS: StaffRecord[] = [
  { id: "cpl_011_4738", thumb: 1, title: "Euclid Ave looking east", year: "c.1915", nbhd: "—", themes: ["streetcars"], geo: "missing", conf: "—", caption: "good", status: "draft", alt: "—", notes: 2, selected: false, captionText: "Streetcars rounding the curve near East 9th; the Statler Hotel anchors the block. Look for the bowler-hatted businessmen waiting at the corner.", noteText: "Compare to cpl_011_4742 — same block, ~6 months later, streetcar livery has changed." },
  { id: "cpl_011_4742", thumb: 2, title: "Euclid Ave, same block, ~6mo later", year: "c.1915", nbhd: "—", themes: ["streetcars"], geo: "missing", conf: "—", caption: "placeholder", status: "draft", alt: "—", notes: 0, selected: false },
  { id: "cpl_011_5108", thumb: 3, title: "Statler Hotel, Lobby", year: "1912", nbhd: "Downtown", themes: ["hotels", "interiors"], geo: "missing", conf: "—", caption: "good", status: "review", alt: "—", notes: 1, selected: false },
  { id: "cpl_011_3994", thumb: 4, title: "Streetcars at Public Square", year: "1916", nbhd: "Downtown", themes: ["streetcars", "public-space"], geo: "missing", conf: "—", caption: "good", status: "draft", alt: "ok", notes: 0, selected: false },
  { id: "cpl_011_3995", thumb: 5, title: "Cleveland Trust Rotunda", year: "1907", nbhd: "Downtown", themes: ["banks", "architecture"], geo: "block", conf: "2", caption: "good", status: "ready", alt: "ok", notes: 0, selected: false, doneGeo: true },
  { id: "cpl_011_4101", thumb: 6, title: "(no caption — cataloger fields only)", year: "c.1910", nbhd: "—", themes: [], geo: "missing", conf: "—", caption: "rewrite", status: "draft", alt: "—", notes: 3, selected: false, needsRewrite: true },
  { id: "cpl_011_4205", thumb: 7, title: "Detroit Ave at W 25th, looking south", year: "1922", nbhd: "Ohio City", themes: ["streetcars", "commerce"], geo: "missing", conf: "—", caption: "good", status: "review", alt: "ok", notes: 1, selected: false },
  { id: "cpl_011_4506", thumb: 8, title: "West Side Market, exterior", year: "c.1920", nbhd: "Ohio City", themes: ["markets"], geo: "block", conf: "2", caption: "good", status: "ready", alt: "ok", notes: 0, selected: false, doneGeo: true },
  { id: "cpl_011_4607", thumb: 9, title: "Tremont Methodist, Lincoln Park", year: "1908", nbhd: "Tremont", themes: ["religion"], geo: "missing", conf: "—", caption: "placeholder", status: "draft", alt: "—", notes: 0, selected: false },
  { id: "cpl_011_4711", thumb: 10, title: "Lincoln Park Bandstand, summer evening", year: "1910", nbhd: "Tremont", themes: ["public-space", "music"], geo: "inter", conf: "3", caption: "good", status: "review", alt: "ok", notes: 2, selected: false, doneGeo: true },
  { id: "cpl_011_4720", thumb: 11, title: "Pilgrim Church, southwest corner", year: "c.1912", nbhd: "Tremont", themes: ["religion", "architecture"], geo: "missing", conf: "—", caption: "good", status: "draft", alt: "—", notes: 0, selected: false },
  { id: "cpl_011_4801", thumb: 12, title: "Steel mill workers, Tremont overlook", year: "1919", nbhd: "Tremont", themes: ["industry", "labor"], geo: "missing", conf: "—", caption: "rewrite", status: "draft", alt: "—", notes: 1, selected: false, needsRewrite: true },
];

const FALLBACK: NavCtx = {
  view: "home", recordId: null, scanId: null, savedView: "All harvested",
  navigate: () => {}, toast: () => {}, toggleSelect: () => {}, clearSelection: () => {},
  selection: new Set<string>(), records: SAMPLE_RECORDS,
};

export const NavContext = React.createContext<NavCtx | null>(null);

export function useNav(): NavCtx {
  return React.useContext(NavContext) ?? FALLBACK;
}

// Raw harvested Tier-3 record (data/tier3-all/records.json). Loose by design.
type HarvestedRecord = Record<string, unknown> & { id: string | number };

// Adapt a harvested record into the staff screen shape (ported from staff-app.jsx).
export function adaptHarvestedToStaff(r: HarvestedRecord, i: number): StaffRecord {
  const sortDate = r.sort_date as string | number | undefined;
  const year = sortDate ? String(sortDate).slice(0, 4) : ((r.date_display as string) || "—");
  const subject = r.subject as string | undefined;
  const themes = subject ? subject.split(";").map((s) => s.trim()).filter(Boolean).slice(0, 3) : [];
  const hasGeo = r.lat != null && r.lng != null;
  return {
    id: String(r.id),
    thumb: (i % 12) + 1,
    thumbUrl: (r.thumb as string) || null,
    contentdmUrl: (r.contentdm_url as string) || null,
    title: (r.title as string) || "(untitled)",
    year,
    nbhd: (r.neighborhood as string) || "—",
    themes,
    geo: hasGeo ? "exact" : "missing",
    conf: hasGeo ? "1" : "—",
    caption: "placeholder",
    status: "draft",
    alt: "—",
    notes: 0,
    selected: false,
    doneGeo: hasGeo,
    captionText: "",
    noteText: "",
    physicalLocation: (r.physical_location as string) || null,
    creator: (r.creator as string) || null,
    rights: (r.rights as string) || null,
    rightsUri: (r.rights_uri as string) || null,
  };
}
