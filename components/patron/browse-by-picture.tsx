"use client";
// "Browse by what's in the picture" — the convergence slice (convergence-slice-spec).
// Marries the validated Tier 1.5 facets into the M2 patron interface: a facet-filter rail +
// two exemplar queries driving a result grid over the 99 faceted photos, clicking through to
// the existing PhotoDetailPanel (extended to render facets + caption). Reads the enrichment
// store LIVE via /api/patron/facets (read-only). Scoped to the 99; honesty-labeled.
//
// The two exemplar queries — signage + change — are searches the ContentDM catalog cannot
// answer (no human transcribed the signs or coded the change). That gap is the demo.
import React from "react";
import type { FacetPhoto } from "@/lib/types";
import { thumbUrl, boxScanPhoto, type Photo } from "./data";
import { C, F, T, HATCH } from "./theme";
import { SiteFooter } from "./exhibits";

const SIGNAGE_KINDS = ["business_name", "street_sign", "poster"];

interface Filters {
  signage: boolean;
  change: boolean;
  materials: string[];
  buildingTypes: string[];
}
const EMPTY: Filters = { signage: false, change: false, materials: [], buildingTypes: [] };

function matches(fp: FacetPhoto, f: Filters): boolean {
  if (f.signage && !(fp.facets.scene_text ?? []).some((s) => SIGNAGE_KINDS.includes(s.kind))) return false;
  if (f.change && !((fp.facets.condition_and_change ?? []).length > 0)) return false;
  if (f.materials.length && !f.materials.some((m) => (fp.facets.materials ?? []).includes(m as never))) return false;
  if (f.buildingTypes.length && !(fp.facets.building_type && f.buildingTypes.includes(fp.facets.building_type))) return false;
  return true;
}

// ── Description search ──────────────────────────────────────────
// Searches what the machine wrote about each picture — the caption, plus any signage it
// transcribed — never the catalog card (the main search covers that). Every word must appear
// somewhere, in any order: "brick porch" finds a brick house with a porch, not every brick wall.
const termsOf = (q: string) => q.trim().toLowerCase().split(/\s+/).filter(Boolean);
const signTexts = (fp: FacetPhoto) => (fp.facets.scene_text ?? []).map((t) => t.text);
function describes(fp: FacetPhoto, terms: string[]): boolean {
  if (!terms.length) return true;
  const hay = [fp.caption ?? "", ...signTexts(fp)].join(" \n ").toLowerCase();
  return terms.every((t) => hay.includes(t));
}

/** The text with every term marked — the SearchHit pattern: ink on a marigold wash. */
function highlight(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 ? <mark key={i} style={{ background: C.marigoldMark, color: C.ink, padding: "0 1px" }}>{part}</mark> : part);
}

/** ~110 characters of the caption around the first hit, so the match is visible on the tile. */
function snippetAround(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0));
  if (!Number.isFinite(at) || text.length <= 110) return text;
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, start + 110);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

// A full section of the site (under the masthead's WHAT'S IN THE PICTURE tab), not a pop-up:
// the page scrolls as one, the rail sticks beside the results, and it closes with the site's
// footer like every other page. Leaving is the masthead's job (or Esc), so there's no ✕.
export function BrowseByPicture({ onOpenPhoto }: { onOpenPhoto: (p: Photo) => void }) {
  const [photos, setPhotos] = React.useState<FacetPhoto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [f, setF] = React.useState<Filters>(EMPTY);
  const [q, setQ] = React.useState("");
  const terms = termsOf(q);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/patron/facets")
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.error || `facets ${r.status}`)))))
      .then((d) => { if (!cancelled) { setPhotos(d.photos); setErr(null); } })
      .catch((e) => !cancelled && setErr(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // Option lists drawn from what's actually present in the 99 (no empty chips).
  const countWhere = (pred: (fp: FacetPhoto) => boolean) => photos.filter(pred).length;
  const materialOpts = React.useMemo(() => {
    const m = new Set<string>();
    photos.forEach((p) => (p.facets.materials ?? []).forEach((x) => m.add(x)));
    return [...m].sort();
  }, [photos]);
  const buildingOpts = React.useMemo(() => {
    const b = new Set<string>();
    photos.forEach((p) => p.facets.building_type && b.add(p.facets.building_type));
    return [...b].sort();
  }, [photos]);

  const results = photos.filter((p) => matches(p, f) && describes(p, terms));
  const filtering = f.signage || f.change || f.materials.length > 0 || f.buildingTypes.length > 0;
  const active = filtering || terms.length > 0;

  const toggleArr = (key: "materials" | "buildingTypes", v: string) =>
    setF((s) => ({ ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] }));

  const signageCount = countWhere((p) => (p.facets.scene_text ?? []).some((s) => SIGNAGE_KINDS.includes(s.kind)));
  const changeCount = countWhere((p) => (p.facets.condition_and_change ?? []).length > 0);
  const activeBits = [
    f.signage && "signage",
    f.change && "mid-change",
    ...f.buildingTypes.map((b) => b.replace(/_/g, " ")),
    ...f.materials.map((m) => m.replace(/_/g, " ")),
    terms.length ? `“${q.trim()}”` : "",
  ].filter(Boolean) as string[];

  return (
    <>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 32px" }}>
        {/* HeroDeck — kicker, the question, a deck that names the source and why the view exists. */}
        <div style={{
          display: "grid", gridTemplateColumns: "8fr 4fr", gap: 48, alignItems: "end",
          padding: "44px 0 30px", borderBottom: `1px solid ${C.hairMed}`,
        }}>
          <div>
            <span style={{ ...T.kicker, display: "inline-block", borderBottom: `3px solid ${C.marigold}`, paddingBottom: 4 }}>
              What&rsquo;s in the picture
            </span>
            <h1 style={{ ...T.heroSection, margin: "14px 0 0" } as React.CSSProperties}>
              Search by what the camera <em>actually saw</em>.
            </h1>
          </div>
          <p style={{ ...T.deck, margin: 0, paddingBottom: 6 }}>
            Signs, cladding, a street mid-change — read from the City Hall box scans by a machine, not
            from the catalog card. Two of these searches the catalog can&rsquo;t answer at all.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", alignItems: "start" }}>
          {/* FacetRail — sticks beside the results while the page scrolls. */}
          <div style={{
            borderRight: `1px solid ${C.hairMed}`, padding: "24px 28px 24px 0",
            position: "sticky", top: 0, maxHeight: "calc(100vh - 100px)", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={T.sectionLabel}>Refine</span>
              {active && (
                <button className="dc-link" onClick={() => { setF(EMPTY); setQ(""); }} style={{ fontFamily: F.mono, fontWeight: 400, fontSize: 10, letterSpacing: "0.06em" }}>
                  Clear all ✕
                </button>
              )}
            </div>

            <FacetGroup name="Exemplars" note="The catalog can't">
              <Facet label="Storefront signs" count={signageCount}
                on={f.signage && !f.change && !f.materials.length && !f.buildingTypes.length}
                onClick={() => setF({ ...EMPTY, signage: true })} />
              <Facet label="Streets mid-change" count={changeCount}
                on={f.change && !f.signage && !f.materials.length && !f.buildingTypes.length}
                onClick={() => setF({ ...EMPTY, change: true })} />
            </FacetGroup>

            <FacetGroup name="In the scene" note="All of">
              <Facet label="Has signage" count={signageCount} on={f.signage} onClick={() => setF((s) => ({ ...s, signage: !s.signage }))} />
              <Facet label="Mid-change" count={changeCount} on={f.change} onClick={() => setF((s) => ({ ...s, change: !s.change }))} />
            </FacetGroup>

            {buildingOpts.length > 0 && (
              <FacetGroup name="Building type" note="Any of">
                {buildingOpts.map((b) => (
                  <Facet key={b} label={b.replace(/_/g, " ")} count={countWhere((p) => p.facets.building_type === b)}
                    on={f.buildingTypes.includes(b)} onClick={() => toggleArr("buildingTypes", b)} />
                ))}
              </FacetGroup>
            )}
            {materialOpts.length > 0 && (
              <FacetGroup name="Cladding" note="Any of">
                {materialOpts.map((m) => (
                  <Facet key={m} label={m.replace(/_/g, " ")} count={countWhere((p) => (p.facets.materials ?? []).includes(m as never))}
                    on={f.materials.includes(m)} onClick={() => toggleArr("materials", m)} />
                ))}
              </FacetGroup>
            )}

            <div style={{ marginTop: 26, borderTop: `1px solid ${C.hairMed}`, paddingTop: 12, ...T.stamp, lineHeight: 1.7, color: C.infoInk, textTransform: "uppercase" }}>
              All facets machine-extracted (Gemini 3.1 Pro) · curator-reviewable · scope: the 99 City Hall box scans
            </div>
          </div>

          {/* Results */}
          <div style={{ minWidth: 0, padding: "24px 0 40px 32px" }}>
            <DescriptionSearch value={q} onChange={setQ} />
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16,
              borderBottom: `2px solid ${C.navy}`, paddingBottom: 10, marginBottom: 24,
            }}>
              <h2 style={{ ...T.section, margin: 0 }}>{active ? "Matching photographs" : "Every faceted photograph"}</h2>
              <span style={T.meta}>
                {loading ? "Loading…" : err ? "—" : `${results.length} of ${photos.length}`}
                {activeBits.length ? ` · ${activeBits.join(" + ")}` : ""}
              </span>
            </div>

            {err && (
              <EmptyState
                title="The picture index isn't available."
                note={`Couldn't load facets (${err}). Graduate the 99 in the staff Facet review surface first.`}
              />
            )}

            {!loading && !err && results.length === 0 && (
              <EmptyState
                title={terms.length && !filtering ? `No description mentions “${q.trim()}”.` : "Nothing filed under that combination — yet."}
                note={terms.length && !filtering
                  ? "The descriptions were written by a machine from each photograph, in plain words — try a simpler one: cars, porch, fence, sign."
                  : "Every filter and search word narrows the 99; loosen one to widen it."}
                action={terms.length && !filtering
                  ? <button className="dc-btn dc-btn--outline" onClick={() => setQ("")}>Clear the search ✕</button>
                  : <button className="dc-btn dc-btn--outline" onClick={() => { setF(EMPTY); setQ(""); }}>Clear filters →</button>}
              />
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "28px 24px" }}>
              {results.map((fp) => {
                const sign = (fp.facets.scene_text ?? []).find((s) => SIGNAGE_KINDS.includes(s.kind));
                const change = (fp.facets.condition_and_change ?? [])[0];
                // Searching, the tile shows WHERE it matched: the caption around the hit, or the
                // sign that matched when the words were only on a sign.
                const captionHit = terms.length > 0 && !!fp.caption && terms.some((t) => fp.caption!.toLowerCase().includes(t));
                const signHit = terms.length > 0 && !captionHit
                  ? (fp.facets.scene_text ?? []).find((s) => terms.some((t) => s.text.toLowerCase().includes(t)))
                  : undefined;
                return (
                  <button key={fp.chc_id} className="dc-tile" onClick={() => onOpenPhoto(boxScanPhoto(fp))}>
                    <div className="dc-tile__frame" style={{
                      height: 140, borderTopColor: C.catPhoto,
                      background: fp.jpeg_url ? `${C.sunken} center / cover no-repeat url(${thumbUrl(fp.jpeg_url, 384)})` : HATCH,
                    }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                      <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {fp.facets.building_type ? fp.facets.building_type.replace(/_/g, " ") : "Photograph"}
                      </span>
                      <span style={T.stamp}>{fp.year || "UNDATED"}</span>
                    </div>
                    <div className="dc-tile__title" style={{
                      fontFamily: F.serif, fontSize: 17, fontWeight: 700, lineHeight: 1.2, color: C.ink, marginTop: 4,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {fp.address || fp.chc_id}
                    </div>
                    {captionHit && (
                      <div style={{ ...T.snippet, fontSize: 13.5, lineHeight: 1.5, marginTop: 6 }}>
                        {highlight(snippetAround(fp.caption!, terms), terms)}
                      </div>
                    )}
                    {signHit && (
                      <div style={{ marginTop: 6, fontFamily: F.serif, fontSize: 13.5, color: C.ink }}>
                        <span style={{ ...T.stamp, textTransform: "uppercase", marginRight: 6 }}>Sign</span>
                        “{highlight(signHit.text, terms)}”
                      </div>
                    )}
                    {!terms.length && sign && (
                      <div style={{ marginTop: 6, fontFamily: F.serif, fontSize: 13.5, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span style={{ background: C.marigoldMark, padding: "0 2px" }}>“{sign.text}”</span>
                      </div>
                    )}
                    {!terms.length && !sign && change && (
                      <div style={{ marginTop: 6, ...T.stamp, color: C.secondary, textTransform: "uppercase" }}>
                        Mid-change · {change.replace(/_/g, " ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

// Words the descriptions actually use (checked against the 99) — the suggestions have to find
// something, or the first thing a visitor learns is that the box doesn't work. "Gas station",
// "church" and "streetcar" read as natural asks and match nothing.
const SUGGESTIONS = ["porch", "snow", "garage", "fence", "parking"];

function DescriptionSearch({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <label style={{
        display: "flex", alignItems: "center", gap: 12, height: 46, padding: "0 8px 0 14px",
        border: `1px solid ${value ? C.navy : C.hairMed}`, background: C.canvas,
        boxShadow: value ? `inset 0 -2px 0 ${C.navy}` : undefined,
      }}>
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="6" cy="6" r="4.5" stroke={C.navy} strokeWidth="1.5" />
          <path d="M9.5 9.5 L13 13" stroke={C.navy} strokeWidth="1.5" />
        </svg>
        <input
          className="dc-bare-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Esc clears the words first; only an empty box lets Esc close the view.
            if (e.key === "Escape" && value) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); onChange(""); }
          }}
          placeholder="Search the descriptions — a porch, snow, a garage…"
          aria-label="Search the photograph descriptions"
          style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontFamily: F.serif, fontSize: 17, color: C.ink }}
        />
        {value && (
          <button className="dc-btn dc-btn--ghost dc-btn--sm" onClick={() => onChange("")}>Clear ✕</button>
        )}
      </label>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
        <div style={{ ...T.meta, fontSize: 10, color: C.infoInk }}>
          ✦ Matches the AI-written descriptions and transcribed signs — not the catalog · every word must appear
        </div>
        {!value && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ ...T.meta, fontSize: 10 }}>Try</span>
            {SUGGESTIONS.map((w) => (
              <button key={w} className="dc-link" onClick={() => onChange(w)} style={{ textTransform: "none", fontFamily: F.serif, fontSize: 14, fontWeight: 400, letterSpacing: 0 }}>{w}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FacetGroup({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${C.body}`, paddingBottom: 6, marginBottom: 4 }}>
        <span style={T.groupLabel}>{name}</span>
        <span style={{ ...T.stamp, textTransform: "uppercase" }}>{note}</span>
      </div>
      {children}
    </div>
  );
}

function Facet({ label, count, on, onClick }: { label: string; count: number; on: boolean; onClick: () => void }) {
  return (
    <button className="dc-facet" aria-pressed={on} onClick={onClick}>
      <span style={{ textTransform: "capitalize" }}>{on ? "✕ " : ""}{label}</span>
      <span className="dc-facet__count">{count}</span>
    </button>
  );
}

function EmptyState({ title, note, action }: { title: string; note: string; action?: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.hairMed}`, padding: 44, textAlign: "center", marginBottom: 24 }}>
      <div style={T.empty}>{title}</div>
      <div style={{ ...T.meta, fontSize: 11, lineHeight: 1.8, marginTop: 12 }}>{note}</div>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
