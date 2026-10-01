"use client";
// Exhibits — the STORIES section, rethought as small curated exhibitions of the collection.
//
// One exhibit is curated today: Millionaire's Row, with a curator's words at every stop. The
// others are DRAFTS — sets the collection already holds (one street across five decades, the
// signs a machine could still read, a neighbourhood then and now), gathered by rule from the
// catalog and the AI-read box scans. They are real photographs in a real order, but nobody has
// written them yet, and every surface says so: an exhibit is a curatorial claim, and a draft
// must never pass as one. The words on a draft are counts and sources, not history.
import React from "react";
import { MILLIONAIRES_ROW, boxScanPhoto, thumbUrl, largeUrl, type Photo } from "./data";
import type { FacetPhoto } from "@/lib/types";
import { photoLatLng, byYear } from "@/lib/patron-places";
import { C, F, T, HATCH } from "./theme";

// ── Model ───────────────────────────────────────────────────────

type Status = "curated" | "draft";

interface Stop {
  photo: Photo;
  /** A curator's note, the AI-written description, or nothing — and the UI labels which. */
  text: string | null;
  textKind: "curator" | "ai" | null;
  /** Signs transcribed from the print, shown as quoted marks. */
  signs?: string[];
}

export interface Exhibit {
  id: string;
  status: Status;
  kicker: string;
  title: string;
  /** The variable part of the headline, set in italic (the design system's HeroDeck rule). */
  titleEm?: string;
  deck: string;
  byline: string;
  /** What made this set — shown as the HonestyNote on drafts. */
  provenance?: string;
  chapters: { title: string; note?: string; stops: Stop[] }[];
  cover: Photo[];
}

const SIGN_KINDS = ["business_name", "poster"];
const span = (ps: Photo[]) => {
  const ys = ps.map((p) => p.year).filter((y) => y > 0);
  if (!ys.length) return null;
  const lo = Math.min(...ys), hi = Math.max(...ys);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
};
export const stopsOf = (e: Exhibit) => e.chapters.flatMap((c) => c.stops);
const decadeChapters = (stops: Stop[]) => {
  const out: { title: string; stops: Stop[] }[] = [];
  for (const s of stops) {
    const t = s.photo.year > 0 ? `The ${Math.floor(s.photo.year / 10) * 10}s` : "Date unknown";
    const last = out[out.length - 1];
    if (last && last.title === t) last.stops.push(s); else out.push({ title: t, stops: [s] });
  }
  return out;
};
/** k items spread evenly across a list — a cover should show the range of a set, not its first page. */
const spread = <X,>(xs: X[], k: number): X[] =>
  xs.length <= k ? xs : Array.from({ length: k }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (k - 1))]);
const aiStop = (p: Photo, signs?: string[]): Stop => ({ photo: p, text: p.caption ?? null, textKind: p.caption ? "ai" : null, signs });
const hood = (p: Photo) => (p.neighborhood || "").split("·")[0].trim();

/** Build the exhibits from what the collection actually holds. Drafts with too little to show are left out. */
export function buildExhibits(pool: Photo[], boxScans: FacetPhoto[]): Exhibit[] {
  const out: Exhibit[] = [];

  // 1 · Curated — Millionaire's Row.
  out.push({
    id: "millionaires-row",
    status: "curated",
    kicker: "A map trail",
    title: "Millionaire's Row,",
    titleEm: "before it was gone",
    deck: "Between 1880 and 1930, four miles of Euclid Avenue held some of the largest private fortunes in the country. By the time anyone thought to save it, almost all of it was gone.",
    byline: "Curated by Brian K.",
    chapters: [{
      title: "Along Euclid Avenue",
      note: "West to east, the way a carriage would have taken it",
      stops: MILLIONAIRES_ROW.map((p) => ({ photo: p, text: p.note, textKind: p.note ? "curator" : null })),
    }],
    cover: MILLIONAIRES_ROW.filter((p) => p.id === "mr-5"),
  });

  // Box scans as Photos, preferring the map's copy (same id) so a stop knows its coordinate.
  const byId = new Map(pool.map((p) => [p.id, p]));
  const box = boxScans.map((fp) => byId.get(`box-${fp.chc_id}`) ?? boxScanPhoto(fp));
  const signsOf = (p: Photo) => (p.facets?.scene_text ?? []).filter((s) => SIGN_KINDS.includes(s.kind)).map((s) => s.text);

  // 2 · Draft — one street, photographed by the city across five decades.
  const grove = box.filter((p) => /grovewood/i.test(p.address || p.title)).sort(byYear);
  if (grove.length >= 6) {
    const stops = grove.map((p) => aiStop(p, signsOf(p)));
    out.push({
      id: "grovewood",
      status: "draft",
      kicker: "One street",
      title: "Grovewood Avenue,",
      titleEm: span(grove) ?? "",
      deck: `${grove.length} photographs the City of Cleveland took along a single street — houses, storefronts, and the same addresses photographed again years apart.`,
      byline: "Gathered from the City Hall box",
      provenance: "Draft exhibit · photographs gathered by street address from the City Hall box scans · descriptions machine-written, curator-reviewable · no curator has written this exhibit yet",
      chapters: decadeChapters(stops),
      cover: spread(grove.filter((p) => p.thumb), 4),
    });
  }

  // 3 · Draft — the signs a machine could still read on the prints.
  const signed = box.filter((p) => signsOf(p).length > 0).sort(byYear);
  if (signed.length >= 6) {
    const examples = [...new Set(signed.flatMap(signsOf))].filter((t) => t.length > 6).slice(0, 3);
    out.push({
      id: "signs",
      status: "draft",
      kicker: "Read off the prints",
      title: "Signs of the times:",
      titleEm: "what the storefronts said",
      deck: `${signed.length} photographs in which a sign can still be read${examples.length ? ` — ${examples.map((t) => `“${t}”`).join(", ")}` : ""}. The catalog never recorded them; a machine transcribed them from the prints.`,
      byline: "Gathered from AI-read signage",
      provenance: "Draft exhibit · every photograph with a storefront sign or poster the machine transcribed · signs and descriptions machine-extracted, curator-reviewable · no curator has written this exhibit yet",
      chapters: [{ title: "The signs", note: "Oldest first", stops: signed.map((p) => aiStop(p, signsOf(p))) }],
      // Not the Grovewood exhibit's pictures again — most early signs are on Grovewood.
      cover: spread(signed.filter((p) => p.thumb && !/grovewood/i.test(p.address || "")), 4),
    });
  }

  // 4 · Draft — a neighbourhood then and now (ContentDM: the early prints and the 2010s–20s series).
  const cf = pool.filter((p) => hood(p) === "Clark-Fulton" && p.thumb && p.year > 0 && !p.aiExtracted).sort(byYear);
  const then = cf.filter((p) => p.year < 1970).slice(0, 8);
  const now = cf.filter((p) => p.year >= 2010).slice(-8);
  if (then.length >= 3 && now.length >= 3) {
    const catalogStop = (p: Photo): Stop => ({ photo: p, text: null, textKind: null });
    out.push({
      id: "clark-fulton",
      status: "draft",
      kicker: "Then and now",
      title: "Clark-Fulton,",
      titleEm: `${then[0].year} and ${now[now.length - 1].year}`,
      deck: "The same neighbourhood twice: the earliest catalog photographs of it, and the street series photographed in the last decade — set side by side, not yet matched corner to corner.",
      byline: "Gathered from the catalog",
      provenance: "Draft exhibit · the earliest and latest Clark-Fulton photographs in the ContentDM catalog, chosen by date · no curator has written this exhibit yet",
      chapters: [
        { title: `Then · ${span(then)}`, stops: then.map(catalogStop) },
        { title: `Now · ${span(now)}`, stops: now.map(catalogStop) },
      ],
      cover: [then[0], now[now.length - 1], then[1], now[now.length - 2]].filter(Boolean),
    });
  }

  return out;
}

// ── Shared bits ─────────────────────────────────────────────────

const shell: React.CSSProperties = { maxWidth: 1360, margin: "0 auto", padding: "0 32px" };

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ ...T.kicker, display: "inline-block", borderBottom: `3px solid ${C.marigold}`, paddingBottom: 4 }}>
      {children}
    </span>
  );
}

function StatusTag({ status }: { status: Status }) {
  return status === "curated"
    ? <span style={{ ...T.stamp, fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, color: C.onNavy, background: C.navy, padding: "2px 7px" }}>CURATED</span>
    : <span style={{ ...T.stamp, fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, color: C.infoInk, border: `1px solid ${C.infoInk}`, padding: "1px 6px" }}>DRAFT</span>;
}

/** A cover: one photograph, or a 2×2 contact sheet for a draft gathered from many. */
function Cover({ photos, height }: { photos: Photo[]; height: number | string }) {
  const one = photos.length < 4;
  if (one) {
    const p = photos[0];
    return (
      <div style={{ height, background: p?.thumb ? `${C.ink} center 40% / cover no-repeat url(${largeUrl(p.thumb)})` : HATCH, border: `1px solid ${C.hairLight}` }} />
    );
  }
  return (
    <div style={{ height, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2, background: C.canvas, border: `1px solid ${C.hairLight}` }}>
      {photos.slice(0, 4).map((p) => (
        <div key={p.id} style={{ background: p.thumb ? `${C.sunken} center / cover no-repeat url(${thumbUrl(p.thumb, 640)})` : HATCH }} />
      ))}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer style={{ background: C.navy, marginTop: 80 }}>
      <div style={{
        ...shell, display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap",
        paddingTop: 20, paddingBottom: 20, fontFamily: F.mono, fontSize: 10.5, lineHeight: 1.7,
        letterSpacing: "0.08em", textTransform: "uppercase", color: C.onNavy,
      }}>
        <div>
          Cleveland Neighborhoods · Cleveland Public Library photograph collection<br />
          Catalog records from ContentDM · box-scan descriptions &amp; signs machine-extracted, curator-reviewable
        </div>
        <div style={{ textAlign: "right" }}>Rights vary by photograph — see each record</div>
      </div>
    </footer>
  );
}

// ── The exhibits index ──────────────────────────────────────────

export function ExhibitsIndex({
  exhibits, onOpen, onShowOnMap, experiment, onOpenPhoto,
}: {
  exhibits: Exhibit[];
  onOpen: (id: string) => void;
  onShowOnMap: (e: Exhibit) => void;
  /** The 3D Sackett Avenue photograph, when it's in the pool — shown as an experiment, not an exhibit. */
  experiment: Photo | null;
  onOpenPhoto: (p: Photo) => void;
}) {
  const featured = exhibits.find((e) => e.status === "curated");
  const drafts = exhibits.filter((e) => e.status === "draft");
  return (
    <>
      <div style={shell}>
        {/* HeroDeck */}
        <div style={{
          display: "grid", gridTemplateColumns: "8fr 4fr", gap: 48, alignItems: "end",
          padding: "44px 0 30px", borderBottom: `1px solid ${C.hairMed}`,
        }}>
          <div>
            <Kicker>The exhibits</Kicker>
            <h1 style={{ ...T.heroSection, margin: "14px 0 0" } as React.CSSProperties}>
              Walk the city with a curator, <em>one street at a time.</em>
            </h1>
          </div>
          <p style={{ ...T.deck, margin: 0, paddingBottom: 6 }}>
            Small exhibitions made from the Library&rsquo;s photographs: a route to follow on the map,
            a street seen across five decades, the signs a city once read. Each stop opens the photograph itself.
          </p>
        </div>

        {/* Featured exhibit */}
        {featured && (
          <div style={{
            display: "grid", gridTemplateColumns: "7fr 5fr", gap: 48, alignItems: "center",
            padding: "36px 0", borderBottom: `1px solid ${C.hairMed}`,
          }}>
            <button onClick={() => onOpen(featured.id)} className="dc-tile" aria-label={`Enter ${featured.title}`}>
              <div className="dc-tile__frame" style={{ borderTopColor: C.marigold }}>
                <Cover photos={featured.cover} height={420} />
              </div>
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Kicker>Featured exhibit</Kicker><StatusTag status="curated" />
              </div>
              <h2 style={{ ...T.detailTitle, fontSize: 38, margin: "16px 0 0" } as React.CSSProperties}>
                {featured.title} <em>{featured.titleEm}</em>
              </h2>
              <p style={{ ...T.deck, margin: "14px 0 0" }}>{featured.deck}</p>
              <div style={{ ...T.meta, marginTop: 16 }}>
                {featured.byline} · {stopsOf(featured).length} stops · {span(stopsOf(featured).map((s) => s.photo))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                <button className="dc-btn dc-btn--primary" onClick={() => onOpen(featured.id)}>Enter the exhibit →</button>
                <button className="dc-btn dc-btn--outline" onClick={() => onShowOnMap(featured)}>Walk it on the map →</button>
              </div>
            </div>
          </div>
        )}

        {/* Drafts + the experiment */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap",
          borderBottom: `2px solid ${C.navy}`, padding: "40px 0 10px",
        }}>
          <h2 style={{ ...T.section, margin: 0 }}>In preparation</h2>
          <span style={{ ...T.meta, color: C.infoInk }}>Gathered from the collection · not yet written by a curator</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "32px 28px", marginTop: 28 }}>
          {drafts.map((e) => (
            <button key={e.id} className="dc-tile" onClick={() => onOpen(e.id)}>
              <div className="dc-tile__frame"><Cover photos={e.cover} height={200} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.secondary }}>{e.kicker}</span>
                <StatusTag status="draft" />
              </div>
              <div className="dc-tile__title" style={{ ...T.cardTitle, fontSize: 22, marginTop: 6 }}>
                {e.title} <em>{e.titleEm}</em>
              </div>
              <div style={{ ...T.snippet, fontSize: 14, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                {e.deck}
              </div>
              <div style={{ ...T.stamp, marginTop: 10, textTransform: "uppercase" }}>
                {stopsOf(e).length} photographs · {span(stopsOf(e).map((s) => s.photo))}
              </div>
            </button>
          ))}
          {experiment && (
            <button className="dc-tile" onClick={() => onOpenPhoto(experiment)}>
              <div className="dc-tile__frame" style={{ borderTopColor: C.marigold }}><Cover photos={[experiment]} height={200} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.secondary }}>Experiment · 3D</span>
                <span style={{ ...T.stamp, fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, color: C.onMarigold, background: C.marigold, padding: "2px 7px" }}>DEMO</span>
              </div>
              <div className="dc-tile__title" style={{ ...T.cardTitle, fontSize: 22, marginTop: 6 }}>
                One corner in 3D: <em>Sackett Avenue, 1929</em>
              </div>
              <div style={{ ...T.snippet, fontSize: 14, marginTop: 6 }}>
                A single photograph rebuilt as a 3D model and a world you can walk into — a look at where an exhibit could go next.
              </div>
              <div style={{ ...T.stamp, marginTop: 10, textTransform: "uppercase" }}>1 photograph · open it ⤢</div>
            </button>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

// ── One exhibit ─────────────────────────────────────────────────

export function ExhibitPage({
  exhibit, next, onBack, onOpen, onOpenPhoto, onShowOnMap, scrollRoot,
}: {
  exhibit: Exhibit;
  next: Exhibit | null;
  onBack: () => void;
  onOpen: (id: string) => void;
  onOpenPhoto: (p: Photo) => void;
  onShowOnMap: (e: Exhibit) => void;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
}) {
  const stops = stopsOf(exhibit);
  const placed = stops.filter((s) => s.photo.lat != null || exhibit.status === "curated").length;
  const stopRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const goTo = (i: number) => stopRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  let n = 0;

  return (
    <>
      <div style={shell}>
        {/* BackBar */}
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16,
          borderBottom: `1px solid ${C.hairMed}`, padding: "22px 0 14px",
        }}>
          <button className="dc-link" onClick={onBack} style={{ fontSize: 13, fontWeight: 600 }}>← Back to the exhibits</button>
          <span style={{ ...T.stamp, fontSize: 11, letterSpacing: "0.08em", color: C.secondary, textTransform: "uppercase" }}>
            Exhibit · {stops.length} {exhibit.status === "curated" ? "stops" : "photographs"} · {span(stops.map((s) => s.photo))}
          </span>
        </div>

        {/* HeroDeck, with the cover beside it */}
        <div style={{
          display: "grid", gridTemplateColumns: "6fr 6fr", gap: 48, alignItems: "end",
          padding: "36px 0 32px", borderBottom: `1px solid ${C.hairMed}`,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Kicker>{exhibit.kicker}</Kicker><StatusTag status={exhibit.status} />
            </div>
            <h1 style={{ ...T.heroSection, fontSize: 50, margin: "16px 0 0" } as React.CSSProperties}>
              {exhibit.title} <em>{exhibit.titleEm}</em>
            </h1>
            <p style={{ ...T.deck, fontSize: 18, margin: "18px 0 0", maxWidth: "62ch" }}>{exhibit.deck}</p>
            <div style={{ ...T.meta, marginTop: 16 }}>{exhibit.byline}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
              <button className="dc-btn dc-btn--primary" onClick={() => goTo(0)}>Begin ↓</button>
              {placed >= 2 && (
                <button className="dc-btn dc-btn--outline" onClick={() => onShowOnMap(exhibit)}>See it on the map →</button>
              )}
            </div>
          </div>
          <Cover photos={exhibit.cover} height={380} />
        </div>

        {exhibit.provenance && (
          <div style={{
            marginTop: 22, padding: "10px 12px", border: `1px solid ${C.hairMed}`,
            ...T.meta, lineHeight: 1.7, color: C.infoInk,
          }}>
            {exhibit.provenance}
          </div>
        )}

        {/* Contact sheet — the whole exhibit at a glance; each frame jumps to its stop. */}
        <div style={{ marginTop: 28 }}>
          <div style={{ ...T.sectionLabel, marginBottom: 10 }}>In this exhibit</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
            {stops.map((s, i) => (
              <button key={s.photo.id} className="dc-tile" onClick={() => goTo(i)} title={s.photo.title} style={{ flex: "0 0 auto", width: 84 }}>
                <div className="dc-tile__frame" style={{ height: 60, borderTopWidth: 1, background: s.photo.thumb ? `${C.sunken} center / cover no-repeat url(${thumbUrl(s.photo.thumb, 256)})` : HATCH }} />
                <div style={{ ...T.stamp, marginTop: 3 }}>{String(i + 1).padStart(2, "0")}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Chapters and stops */}
        {exhibit.chapters.map((ch) => (
          <section key={ch.title} style={{ marginTop: 44 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16,
              borderBottom: `2px solid ${C.navy}`, paddingBottom: 10,
            }}>
              <h2 style={{ ...T.section, margin: 0 }}>{ch.title}</h2>
              <span style={T.meta}>{ch.note ? `${ch.note} · ` : ""}{ch.stops.length}</span>
            </div>
            {ch.stops.map((s) => {
              const i = n++;
              const p = s.photo;
              return (
                <div
                  key={p.id}
                  ref={(el) => { stopRefs.current[i] = el; }}
                  style={{
                    display: "grid", gridTemplateColumns: "56px 7fr 5fr", gap: 32, alignItems: "start",
                    padding: "32px 0", borderBottom: `1px solid ${C.hairLight}`, scrollMarginTop: 20,
                  }}
                >
                  <div style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 700, color: C.navy, lineHeight: 1 }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <button className="dc-tile" onClick={() => onOpenPhoto(p)} aria-label={`Open ${p.title}`} style={{ cursor: "zoom-in" }}>
                    <div className="dc-tile__frame" style={{ aspectRatio: "4 / 3", background: p.thumb ? C.ink : HATCH, position: "relative" }}>
                      {p.thumb && (
                        <img src={largeUrl(p.thumb)} alt="" loading="lazy" decoding="async" style={{
                          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block",
                        }} />
                      )}
                    </div>
                  </button>
                  <div>
                    <div style={{ ...T.stamp, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {p.year > 0 ? (p.date_display || p.year) : "Date unknown"}{p.address && p.address !== p.title ? ` · ${p.address}` : ""}
                    </div>
                    <h3 style={{ ...T.cardTitle, fontSize: 25, margin: "8px 0 0", textWrap: "balance" } as React.CSSProperties}>{p.title}</h3>
                    {s.signs && s.signs.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                        {s.signs.map((t, k) => (
                          <span key={k} style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 600, color: C.ink, background: C.marigoldMark, padding: "1px 5px" }}>“{t}”</span>
                        ))}
                      </div>
                    )}
                    {s.text && s.textKind === "curator" && (
                      <p style={{ fontFamily: F.serif, fontSize: 17.5, lineHeight: 1.65, color: C.body, margin: "14px 0 0", maxWidth: "62ch" }}>{s.text}</p>
                    )}
                    {s.text && s.textKind === "ai" && (
                      <>
                        <p style={{ ...T.dek, fontSize: 16, color: C.body, margin: "14px 0 0", maxWidth: "62ch" }}>{s.text}</p>
                        <div style={{ ...T.fine, color: C.infoInk, marginTop: 6 }}>✦ Description machine-written from the photograph · curator-reviewable</div>
                      </>
                    )}
                    <button className="dc-link" onClick={() => onOpenPhoto(p)} style={{ marginTop: 16 }}>Open the photograph ⤢</button>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {/* The way on */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap", marginTop: 44 }}>
          <button className="dc-btn dc-btn--ghost" onClick={onBack}>All exhibits ←</button>
          {next && (
            <button className="dc-story" onClick={() => { onOpen(next.id); scrollRoot.current?.scrollTo({ top: 0 }); }} style={{
              display: "grid", gridTemplateColumns: "120px 1fr", gap: 16, alignItems: "center", textAlign: "left",
              padding: 10, background: C.canvas, border: `1px solid ${C.hairMed}`, borderTop: `3px solid ${C.marigold}`,
              cursor: "pointer", minWidth: 380,
            }}>
              <Cover photos={next.cover.slice(0, 1)} height={80} />
              <div>
                <div style={{ ...T.kicker, fontSize: 10 }}>Next exhibit</div>
                <div className="dc-row__title" style={{ ...T.cardTitle, fontSize: 18, marginTop: 4 }}>{next.title} <em>{next.titleEm}</em> →</div>
              </div>
            </button>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

/** Points to fit on the map for an exhibit — only real coordinates (or the trail's own x/y). */
export function exhibitPoints(e: Exhibit) {
  return stopsOf(e)
    .filter((s) => s.photo.lat != null || e.status === "curated")
    .map((s) => photoLatLng(s.photo));
}
