"use client";
// Gallery view — the same photographs as the map, laid out as pictures instead of dots.
//
// The gallery is a *view of the map*, not a separate catalog: it shows exactly the photographs
// whose coordinates fall inside the area the map was showing, and inside the time range. So
// "zoom the map to Clark-Fulton, switch to Gallery" means "show me Clark-Fulton's pictures".
// The map stays mounted underneath, so switching back lands you where you were.
//
// Coordinates resolve through `photoLatLng`, the same as the map's dots — if the two read a
// coordinate differently, a photo could be on screen in one view and missing from the other.
import React from "react";
import { thumbUrl, type Photo } from "./data";
import type { MapBounds } from "./cleveland-map";
import { photoLatLng, byYear } from "@/lib/patron-places";
import { C, F, T, HATCH } from "./theme";

/** Photos inside the map's current bounds — every one, whatever its date. */
export function photosInBounds(photos: Photo[], b: MapBounds | null): Photo[] {
  if (!b) return [];
  return photos.filter((p) => {
    const { lat, lng } = photoLatLng(p);
    return lat <= b.north && lat >= b.south && lng <= b.east && lng >= b.west;
  });
}

const inRange = (p: Photo, [lo, hi]: [number, number]) => p.year > 0 && p.year >= lo && p.year <= hi;
// The box-scans carry "Cleveland · City Hall box" — a source, not a neighbourhood. Name the
// source rather than pass "Cleveland" off as a place you could filter to.
const hood = (p: Photo) => {
  const [first, rest] = (p.neighborhood || "").split("·").map((x) => x.trim());
  if (first === "Cleveland" && rest) return rest;
  return first || "Neighborhood not recorded";
};

type Sort = "oldest" | "newest";

export function GalleryView({
  photos, bounds, yearRange, onYearRange, fullRange, timeControl, selectedId, onOpenPhoto, onShowMap,
}: {
  photos: Photo[];
  bounds: MapBounds | null;
  yearRange: [number, number];
  onYearRange: (r: [number, number]) => void;
  /** The slider's whole extent — what "Clear all" and "Show every year" go back to. */
  fullRange: [number, number];
  /** The map's time-range control, re-hosted in the rail so it works the same in both views. */
  timeControl: React.ReactNode;
  selectedId: string | null;
  onOpenPhoto: (p: Photo) => void;
  onShowMap: () => void;
}) {
  const [sort, setSort] = React.useState<Sort>("oldest");
  const [hoods, setHoods] = React.useState<string[]>([]);
  const [withUndated, setWithUndated] = React.useState(false);

  const inView = React.useMemo(() => photosInBounds(photos, bounds), [photos, bounds]);
  const dated = inView.filter((p) => inRange(p, yearRange));
  const undated = inView.filter((p) => !(p.year > 0));
  const pool = withUndated ? [...dated, ...undated] : dated;

  // Neighbourhood facets come from what's in view, so there's never an option that yields nothing.
  const hoodCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    pool.forEach((p) => m.set(hood(p), (m.get(hood(p)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pool]);
  // A neighbourhood panned out of view can't stay selected — it would filter to nothing silently.
  const activeHoods = hoods.filter((h) => hoodCounts.some(([n]) => n === h));

  const shown = (activeHoods.length ? pool.filter((p) => activeHoods.includes(hood(p))) : pool)
    .slice()
    .sort((a, b) => (sort === "oldest" ? byYear(a, b) : byYear(b, a)))
    // byYear puts undated last ascending; keep them last when descending too.
    .sort((a, b) => Number(!(a.year > 0)) - Number(!(b.year > 0)));

  // Galleries by decade — the collection's own grain, and what the time range is measured in.
  // A decade holding one or two photographs would be a lonely row of mostly white, so thin
  // neighbouring decades are pooled ("1880s–1900s") until a gallery has enough to fill a row.
  const MIN_PER_GALLERY = 4;
  const decades: [string, Photo[]][] = [];
  for (const p of shown) {
    const label = p.year > 0 ? `${Math.floor(p.year / 10) * 10}s` : "Date unknown";
    const last = decades[decades.length - 1];
    if (last && last[0] === label) last[1].push(p);
    else decades.push([label, [p]]);
  }
  const sections: [string, Photo[]][] = [];
  let pending: { first: string; last: string; items: Photo[] } | null = null;
  const flush = () => {
    if (!pending) return;
    sections.push([pending.first === pending.last ? pending.first : `${pending.first}–${pending.last}`, pending.items]);
    pending = null;
  };
  for (const [label, items] of decades) {
    if (label === "Date unknown") { flush(); sections.push([label, items]); continue; }
    if (!pending) pending = { first: label, last: label, items: [...items] };
    else { pending.last = label; pending.items.push(...items); }
    if (pending.items.length >= MIN_PER_GALLERY) flush();
  }
  // A thin tail joins the gallery before it rather than standing alone.
  if (pending) {
    const tail: { first: string; last: string; items: Photo[] } = pending;
    const prev = sections[sections.length - 1];
    if (prev && prev[0] !== "Date unknown" && tail.items.length < MIN_PER_GALLERY) {
      prev[0] = `${prev[0].split("–")[0]}–${tail.last}`;
      prev[1].push(...tail.items);
      pending = null;
    } else flush();
  }

  const narrowed = yearRange[0] > fullRange[0] || yearRange[1] < fullRange[1];
  const placeSummary = hoodCounts.slice(0, 3).map(([n]) => n).join(", ") + (hoodCounts.length > 3 ? ` + ${hoodCounts.length - 3} more` : "");

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [bounds, yearRange, sort, activeHoods.join("|"), withUndated]);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 6, background: C.canvas,
      display: "flex", paddingLeft: 32,
    }}>
      {/* FacetRail */}
      <aside style={{
        width: 300, flexShrink: 0, borderRight: `1px solid ${C.hairMed}`,
        padding: "72px 28px 24px 0", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={T.sectionLabel}>Refine</span>
          {(activeHoods.length > 0 || narrowed || withUndated) && (
            <button className="dc-link" style={{ fontFamily: F.mono, fontWeight: 400, fontSize: 10, letterSpacing: "0.06em" }}
              onClick={() => { setHoods([]); setWithUndated(false); onYearRange(fullRange); }}>
              Clear all ✕
            </button>
          )}
        </div>

        <div style={{ marginTop: 18 }}>{timeControl}</div>

        <RailGroup name="Neighborhood" note="Any of">
          {hoodCounts.length === 0 && <div style={{ ...T.stamp, padding: "8px 0", textTransform: "uppercase" }}>None in view</div>}
          {hoodCounts.map(([n, c]) => {
            const on = activeHoods.includes(n);
            return (
              <button key={n} className="dc-facet" aria-pressed={on}
                onClick={() => setHoods((h) => (on ? h.filter((x) => x !== n) : [...h, n]))}>
                <span>{on ? "✕ " : ""}{n}</span>
                <span className="dc-facet__count">{c}</span>
              </button>
            );
          })}
        </RailGroup>

        {undated.length > 0 && (
          <RailGroup name="Undated" note="No legible date">
            <button className="dc-facet" aria-pressed={withUndated} onClick={() => setWithUndated((v) => !v)}>
              <span>{withUndated ? "✕ " : ""}Include undated photographs</span>
              <span className="dc-facet__count">{undated.length}</span>
            </button>
          </RailGroup>
        )}

        <div style={{ marginTop: 26, borderTop: `1px solid ${C.hairMed}`, paddingTop: 12, ...T.stamp, lineHeight: 1.7, textTransform: "uppercase" }}>
          Shows the photographs placed inside the area of the map you were looking at. Pan or zoom the map to change it.
          <div style={{ marginTop: 10 }}>
            <button className="dc-link" onClick={onShowMap}>Change the area on the map ←</button>
          </div>
        </div>
      </aside>

      {/* Results */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      {/* A fixed band for the Map | Gallery switch to sit in, so pictures scroll under a
          hairline instead of under the switch. */}
      <div style={{ height: 72, flexShrink: 0, borderBottom: `1px solid ${C.hairLight}` }} />
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 32px 80px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap",
          borderBottom: `2px solid ${C.navy}`, paddingBottom: 10,
        }}>
          <div>
            <div style={{ ...T.meta, marginBottom: 6 }}>In view on the map{placeSummary ? ` · ${placeSummary}` : ""}</div>
            <h2 style={{ ...T.section, fontSize: 26, margin: 0 }}>
              {shown.length} {shown.length === 1 ? "photograph" : "photographs"}
              <span style={{ fontWeight: 400, fontStyle: "italic", color: C.secondary }}>
                {" "}from {yearRange[0]}–{yearRange[1]}{withUndated && undated.length ? ", and undated" : ""}
              </span>
            </h2>
          </div>
          <div className="dc-seg" role="group" aria-label="Sort">
            <button aria-pressed={sort === "oldest"} onClick={() => setSort("oldest")}>Oldest first</button>
            <button aria-pressed={sort === "newest"} onClick={() => setSort("newest")}>Newest first</button>
          </div>
        </div>

        {/* Three different nothings, each with its own way out. */}
        {inView.length === 0 && (
          <Empty
            title="Nothing photographed in this part of the city — yet."
            note={bounds ? "No photographs are placed inside the area the map is showing." : "The map hasn't reported its area yet."}
            action={<button className="dc-btn dc-btn--outline" onClick={onShowMap}>Back to the map ←</button>}
          />
        )}
        {inView.length > 0 && pool.length === 0 && (
          <Empty
            title={`Nothing in view from ${yearRange[0]}–${yearRange[1]}.`}
            note={`${inView.length} photograph${inView.length === 1 ? " is" : "s are"} in this area, outside the time range${undated.length ? " or undated" : ""}.`}
            action={<button className="dc-btn dc-btn--outline" onClick={() => onYearRange(fullRange)}>Show every year →</button>}
          />
        )}

        {sections.map(([label, items]) => (
          <section key={label} style={{ marginTop: 34 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              borderBottom: `1px solid ${C.body}`, paddingBottom: 6, marginBottom: 18,
            }}>
              <h3 style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 800, color: C.ink, margin: 0 }}>{label}</h3>
              <span style={T.meta}>{items.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "28px 24px" }}>
              {items.map((p) => (
                <button
                  key={p.id}
                  className="dc-tile"
                  aria-current={p.id === selectedId}
                  onClick={() => onOpenPhoto(p)}
                  title={p.title}
                >
                  {/* An <img loading="lazy"> rather than a CSS background: backgrounds all download
                      at once, and a decade of box-scans is a lot of bytes below the fold. */}
                  <div className="dc-tile__frame" style={{
                    aspectRatio: "4 / 3", borderTopColor: p.featured ? C.marigold : C.navy,
                    background: p.thumb ? C.sunken : HATCH, position: "relative",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {p.thumb
                      ? <img src={thumbUrl(p.thumb, 384)} alt="" loading="lazy" decoding="async" style={{
                          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block",
                        }} />
                      : <span style={T.stamp}>[ NO SCAN YET ]</span>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                    <span style={{
                      fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
                      color: C.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{hood(p)}</span>
                    <span style={T.stamp}>{p.year > 0 ? p.year : "UNDATED"}</span>
                  </div>
                  <div className="dc-tile__title" style={{
                    fontFamily: F.serif, fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: C.ink, marginTop: 4,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  } as React.CSSProperties}>{p.title}</div>
                  {p.featured && p.story && (
                    <div style={{ ...T.stamp, color: C.navy, marginTop: 4, textTransform: "uppercase" }}>Featured · {p.story}</div>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      </div>
    </div>
  );
}

function RailGroup({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
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

function Empty({ title, note, action }: { title: string; note: string; action?: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.hairMed}`, padding: 44, textAlign: "center", marginTop: 28 }}>
      <div style={T.empty}>{title}</div>
      <div style={{ ...T.meta, fontSize: 11, lineHeight: 1.8, marginTop: 12 }}>{note}</div>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
