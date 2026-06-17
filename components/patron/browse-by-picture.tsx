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
import type { Photo } from "./data";

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

function toPhoto(fp: FacetPhoto): Photo {
  return {
    id: fp.chc_id, x: 0, y: 0, year: fp.year ?? 0,
    title: fp.address || fp.chc_id,
    neighborhood: "Cleveland (City Hall box)", address: fp.address || "—",
    photographer: "unknown", rights: "Public Domain (pre-1931)",
    branch: "Cleveland Public Library", note: null,
    thumb: fp.jpeg_url, caption: fp.caption, facets: fp.facets, aiExtracted: true,
  };
}

export function BrowseByPicture({ onClose, onOpenPhoto }: { onClose: () => void; onOpenPhoto: (p: Photo) => void }) {
  const [photos, setPhotos] = React.useState<FacetPhoto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [f, setF] = React.useState<Filters>(EMPTY);

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

  const results = photos.filter((p) => matches(p, f));
  const active = f.signage || f.change || f.materials.length > 0 || f.buildingTypes.length > 0;

  const toggleArr = (key: "materials" | "buildingTypes", v: string) =>
    setF((s) => ({ ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] }));

  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 45, background: "rgba(26,24,20,0.45)",
      display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "48px 28px", overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(1120px, 100%)", background: "#F6F2EB", border: "1px solid #D6CDBD",
        borderRadius: 14, boxShadow: "0 24px 60px rgba(26,24,20,0.32)", overflow: "hidden",
        display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 96px)",
      }}>
        {/* Header */}
        <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #E6DECC", display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: "#A8362B", marginBottom: 6 }}>
              Concept demo · City Hall box · AI-extracted (staff-reviewable)
            </div>
            <h1 style={{ fontFamily: "Spectral, 'Libre Caslon Text', Georgia, serif", fontWeight: 500, fontSize: 30, letterSpacing: -0.4, margin: "0 0 6px", color: "#1A1814" }}>
              Browse by what&apos;s in the picture
            </h1>
            <div style={{ fontSize: 14, color: "#3D3833", lineHeight: 1.45, maxWidth: 640 }}>
              Search the collection by what the camera actually saw — signs, materials, a street mid-change — not just the catalog card. <span style={{ color: "#1F5963", fontWeight: 500 }}>Try a search the catalog can&apos;t do.</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, lineHeight: 1, color: "#6B6359" }}>×</button>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Filter rail */}
          <div style={{ width: 270, borderRight: "1px solid #E6DECC", padding: "18px 20px", overflowY: "auto", flexShrink: 0 }}>
            <RailLabel>The two the catalog can&apos;t answer</RailLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <Exemplar emoji="🪧" label="Storefront signs" sub={`${countWhere((p) => (p.facets.scene_text ?? []).some((s) => SIGNAGE_KINDS.includes(s.kind)))} photos`}
                on={f.signage && !f.change && !f.materials.length && !f.buildingTypes.length}
                onClick={() => setF({ ...EMPTY, signage: true })} />
              <Exemplar emoji="🏚" label="Streets mid-change" sub={`${countWhere((p) => (p.facets.condition_and_change ?? []).length > 0)} photos`}
                on={f.change && !f.signage && !f.materials.length && !f.buildingTypes.length}
                onClick={() => setF({ ...EMPTY, change: true })} />
            </div>

            <RailLabel>Filters</RailLabel>
            <Toggle label="Has storefront / scene signage" on={f.signage} onClick={() => setF((s) => ({ ...s, signage: !s.signage }))} />
            <Toggle label="Street mid-change" on={f.change} onClick={() => setF((s) => ({ ...s, change: !s.change }))} />

            {buildingOpts.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <RailLabel>Building type</RailLabel>
                <ChipWrap>{buildingOpts.map((b) => <FilterChip key={b} on={f.buildingTypes.includes(b)} onClick={() => toggleArr("buildingTypes", b)}>{b.replace(/_/g, " ")}</FilterChip>)}</ChipWrap>
              </div>
            )}
            {materialOpts.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <RailLabel>Cladding material</RailLabel>
                <ChipWrap>{materialOpts.map((m) => <FilterChip key={m} on={f.materials.includes(m)} onClick={() => toggleArr("materials", m)}>{m.replace(/_/g, " ")}</FilterChip>)}</ChipWrap>
              </div>
            )}

            {active && (
              <button onClick={() => setF(EMPTY)} style={{ marginTop: 18, background: "none", border: "none", color: "#A8362B", fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "'Work Sans', sans-serif" }}>Clear all</button>
            )}
          </div>

          {/* Result grid */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "18px 24px 28px" }}>
            <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, color: "#6B6359", letterSpacing: 0.3, marginBottom: 14 }}>
              {loading ? "Loading…" : err ? "—" : `${results.length} of ${photos.length} photographs`}
            </div>

            {err && (
              <div style={{ color: "#6B6359", fontSize: 14, lineHeight: 1.5, maxWidth: 460 }}>
                Couldn&apos;t load facets: {err}
                <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, color: "#A39684", marginTop: 8 }}>
                  Graduate the 99 in the staff Facet review surface first.
                </div>
              </div>
            )}

            {!loading && !err && results.length === 0 && (
              <div style={{ color: "#6B6359", fontSize: 14, lineHeight: 1.5, maxWidth: 420 }}>
                No photographs match those filters. Loosen one, or try an exemplar search.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 14 }}>
              {results.map((fp) => {
                const sign = (fp.facets.scene_text ?? []).find((s) => SIGNAGE_KINDS.includes(s.kind));
                const change = (fp.facets.condition_and_change ?? [])[0];
                return (
                  <button key={fp.chc_id} onClick={() => onOpenPhoto(toPhoto(fp))} style={{
                    background: "#FFFFFF", border: "1px solid #E6DECC", borderRadius: 10, padding: 0,
                    textAlign: "left", cursor: "pointer", overflow: "hidden", fontFamily: "'Work Sans', sans-serif",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C8983A")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E6DECC")}
                  >
                    <div style={{ height: 120, background: `#1A1814 center / cover no-repeat url(${fp.jpeg_url})` }} />
                    <div style={{ padding: "8px 10px 10px" }}>
                      <div style={{ fontSize: 12.5, color: "#1A1814", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {fp.address || fp.chc_id}
                      </div>
                      <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10, color: "#A39684", marginTop: 2 }}>
                        {fp.year || "—"}{fp.facets.building_type ? ` · ${fp.facets.building_type.replace(/_/g, " ")}` : ""}
                      </div>
                      {sign && <div style={{ marginTop: 5, fontSize: 11.5, color: "#1F5963", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🪧 “{sign.text}”</div>}
                      {!sign && change && <div style={{ marginTop: 5, fontSize: 11.5, color: "#A8362B" }}>🏚 {change.replace(/_/g, " ")}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: "#A39684", marginBottom: 9 }}>{children}</div>;
}
function ChipWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>;
}
function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <span onClick={onClick} style={{
      cursor: "pointer", fontSize: 12, padding: "4px 10px", borderRadius: 999, userSelect: "none",
      background: on ? "#1F5963" : "#FFFFFF", color: on ? "#F6F2EB" : "#3D3833",
      border: `1px solid ${on ? "#1F5963" : "#D6CDBD"}`,
    }}>{children}</span>
  );
}
function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <label onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 13, color: "#1A1814" }}>
      <span style={{
        width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${on ? "#1F5963" : "#C0B69F"}`,
        background: on ? "#1F5963" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{on && <span style={{ color: "#F6F2EB", fontSize: 11, lineHeight: 1 }}>✓</span>}</span>
      {label}
    </label>
  );
}
function Exemplar({ emoji, label, sub, on, onClick }: { emoji: string; label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer",
      background: on ? "#FBF1DC" : "#FFFFFF", border: `1px solid ${on ? "#C8983A" : "#E6DECC"}`,
      borderRadius: 10, padding: "10px 12px", fontFamily: "'Work Sans', sans-serif",
    }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "#1A1814" }}>{label}</span>
        <span style={{ display: "block", fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10.5, color: "#A39684", marginTop: 1 }}>{sub}</span>
      </span>
    </button>
  );
}
