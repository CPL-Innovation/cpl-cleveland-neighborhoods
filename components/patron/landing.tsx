"use client";
// PatronLanding — the public "Cleveland Neighborhoods" landing. Map hero with overlays:
// header (wordmark + nav + search), draggable time-range filter, geolocation pill, zoom
// controls, Story of the Week card, density legend, onboarding whisper. Clicking a dot
// opens the photo detail panel. Ported from desktop-landing.jsx.
//
// The Leaflet map is loaded via next/dynamic({ssr:false}) so it never runs on the server.
// The photo pool (curated seed + harvested ContentDM records) lives in React state and is
// passed down as props — the old window.ALL_PHOTOS global is retired.
import React from "react";
import dynamic from "next/dynamic";
import {
  CLEVELAND_PHOTOS, MILLIONAIRES_ROW, CURATED_PHOTOS,
  adaptHarvestedRecord, type Photo, type HarvestedRecord,
} from "./data";
import { SearchIcon, SearchPanel, PhotoDetailPanel, StoryPanel } from "./panels";

const ClevelandMap = dynamic(() => import("./cleveland-map"), { ssr: false });

const MIN_YEAR = 1880;
const MAX_YEAR = 2020;
// Public Square — the synthetic "near you" point for the demo.
const NEAR_YOU = { x: 484, y: 376, label: "Public Square" };

export default function PatronLanding() {
  const [photos, setPhotos] = React.useState<Photo[]>(CURATED_PHOTOS);
  const [yearRange, setYearRange] = React.useState<[number, number]>([1880, 2025]);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Photo | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [nearYouActive, setNearYouActive] = React.useState(false);
  const [storyOpen, setStoryOpen] = React.useState(false);
  const [whisperOpen, setWhisperOpen] = React.useState(true);

  // ── Load harvested ContentDM records and merge over the curated seed ──
  React.useEffect(() => {
    let cancelled = false;
    fetch("/data/tier3-all/records.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("records.json missing"))))
      .then((raw: HarvestedRecord[]) => {
        if (cancelled) return;
        const harvested = raw.map(adaptHarvestedRecord).filter((p): p is Photo => p !== null);
        setPhotos([...CLEVELAND_PHOTOS, ...harvested, ...MILLIONAIRES_ROW]);
        console.log(`[harvest] loaded ${harvested.length} ContentDM records into the patron map`);
      })
      .catch((err) => console.warn("[harvest] using curated photos only:", err.message));
    return () => { cancelled = true; };
  }, []);

  // ── Map sizing ──
  const mapWrapRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ w: 1280, h: 780 });
  React.useLayoutEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleCount = photos.filter((p) => p.year >= yearRange[0] && p.year <= yearRange[1]).length;
  const totalCount = photos.length;

  // ── Keyboard ──
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else if (storyOpen) setStoryOpen(false);
        else if (searchOpen) setSearchOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, storyOpen, searchOpen]);

  const zoomIn = () => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)));
  const resetView = () => { setZoom(1); setYearRange([1880, 2020]); setNearYouActive(false); };

  return (
    <div style={{
      width: "100%", height: "100%", background: "#F6F2EB", color: "#1A1814",
      fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column",
      overflow: "hidden", position: "relative",
    }}>
      <DesktopHeader onSearchClick={() => setSearchOpen(true)} />
      <div ref={mapWrapRef} style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <ClevelandMap
          width={size.w}
          height={size.h}
          yearRange={yearRange}
          hoveredId={hoveredId}
          selectedId={selected ? selected.id : null}
          onDotHover={setHoveredId}
          onDotClick={(p) => setSelected(p)}
          zoom={zoom}
          nearYou={nearYouActive ? NEAR_YOU : null}
          photos={photos}
        />

        <GeolocationPill active={nearYouActive} onToggle={() => setNearYouActive((v) => !v)} />
        <TimeRangeFilter value={yearRange} onChange={setYearRange}
          visibleCount={visibleCount} totalCount={totalCount} />
        <MapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetView} />
        <StoryOfTheWeek onOpen={() => setStoryOpen(true)} />
        <DensityLegend />
        <AttributionPill visibleCount={visibleCount} totalCount={totalCount} yearRange={yearRange} />

        {whisperOpen && <OnboardingWhisper onDismiss={() => setWhisperOpen(false)} />}
      </div>

      {searchOpen && (
        <SearchPanel
          query={searchQuery}
          onQuery={setSearchQuery}
          onClose={() => setSearchOpen(false)}
          onPick={(p) => { setSelected(p); setSearchOpen(false); }}
          photos={photos}
        />
      )}

      {selected && (
        <PhotoDetailPanel
          photo={selected}
          onClose={() => setSelected(null)}
          onOpenPhoto={(p) => setSelected(p)}
          photos={photos}
        />
      )}

      {storyOpen && (
        <StoryPanel
          onClose={() => setStoryOpen(false)}
          onOpenPhoto={(p) => { setStoryOpen(false); setSelected(p); }}
        />
      )}
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────

function DesktopHeader({ onSearchClick }: { onSearchClick: () => void }) {
  return (
    <div style={{
      height: 72, borderBottom: "1px solid #D6CDBD", display: "flex", alignItems: "center",
      padding: "0 32px", gap: 32, background: "rgba(246,242,235,0.92)",
      backdropFilter: "blur(6px)", zIndex: 5, position: "relative",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
          fontWeight: 460, fontSize: 24, letterSpacing: -0.4, lineHeight: 1, color: "#1A1814",
        }}>
          Cleveland&nbsp;Neighborhoods
        </div>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, serif",
          fontStyle: "italic", fontWeight: 400, fontSize: 12.5, letterSpacing: 0.1,
          lineHeight: 1, color: "#6B6359",
        }}>
          A century of Cleveland, mapped to the corner.
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <nav style={{ display: "flex", gap: 28, fontSize: 14, letterSpacing: 0.1, color: "#1A1814" }}>
        <NavLink>Stories</NavLink>
        <NavLink>Browse</NavLink>
        <NavLink>About</NavLink>
      </nav>
      <div style={{ width: 1, height: 22, background: "#D6CDBD", marginLeft: 4 }} />
      <button onClick={onSearchClick} style={{
        height: 36, padding: "0 14px", display: "flex", alignItems: "center", gap: 8,
        background: "transparent", border: "1px solid #D6CDBD", borderRadius: 18,
        color: "#1A1814", fontSize: 13,
        fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        cursor: "pointer",
      }}>
        <SearchIcon />
        <span style={{ color: "#6B6359" }}>Search the collection</span>
        <span style={{
          marginLeft: 14, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, color: "#A39684", letterSpacing: 0,
        }}>⌘ K</span>
      </button>
    </div>
  );
}

function NavLink({ children, active }: { children: React.ReactNode; active?: boolean }) {
  const [hov, setHov] = React.useState(false);
  return (
    <a
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        color: active ? "#1A1814" : "#3D3833", textDecoration: "none", fontWeight: 500,
        padding: "6px 0",
        borderBottom: (active || hov) ? "1.5px solid #1F5963" : "1.5px solid transparent",
        cursor: "pointer", transition: "border-color 120ms",
      }}>{children}</a>
  );
}

// ── Geolocation pill ────────────────────────────────────────────

function GeolocationPill({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      position: "absolute", top: 24, right: 24, zIndex: 4,
      display: "flex", alignItems: "center", gap: 8,
      height: 40, padding: "0 16px 0 14px",
      background: active ? "#1F5963" : "#FFFFFF",
      color: active ? "#F6F2EB" : "#1A1814",
      border: "1px solid " + (active ? "#1F5963" : "#D6CDBD"),
      borderRadius: 999, boxShadow: "0 2px 12px rgba(26,24,20,0.06)",
      fontSize: 13.5, cursor: "pointer",
      fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <LocationGlyph color={active ? "#F6F2EB" : "#A8362B"} />
      <span>{active ? `Near you · ${NEAR_YOU.label}` : "Photos near you"}</span>
    </button>
  );
}

function LocationGlyph({ color = "#A8362B" }: { color?: string }) {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
      <path d="M7 1c-3.3 0-6 2.6-6 5.8 0 4.4 6 8.7 6 8.7s6-4.3 6-8.7C13 3.6 10.3 1 7 1z"
        fill={color} stroke="#1A1814" strokeOpacity="0.2" strokeWidth="0.6" />
      <circle cx="7" cy="6.6" r="2" fill="#fff" />
    </svg>
  );
}

// ── Time-range filter (draggable) ───────────────────────────────

function TimeRangeFilter({
  value, onChange, visibleCount, totalCount,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
  visibleCount: number;
  totalCount: number;
}) {
  const [lo, hi] = value;
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState<"lo" | "hi" | null>(null);

  const decades = [1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
  const labelDecades = [1880, 1900, 1920, 1940, 1960, 1980, 2000, 2020];
  const pct = (y: number) => ((y - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const r = track.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
      const yr = Math.round(MIN_YEAR + (x / r.width) * (MAX_YEAR - MIN_YEAR));
      if (dragging === "lo") onChange([Math.min(yr, hi - 1), hi]);
      else onChange([lo, Math.max(yr, lo + 1)]);
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, lo, hi, onChange]);

  return (
    <div style={{
      position: "absolute", top: 24, left: 24, zIndex: 4,
      width: 460, padding: "14px 22px 14px",
      background: "#FFFFFF", border: "1px solid #D6CDBD", borderRadius: 12,
      boxShadow: "0 2px 12px rgba(26,24,20,0.06)", userSelect: "none",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: "#6B6359",
        }}>Time range</div>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
          fontSize: 16, fontWeight: 600, color: "#1A1814", letterSpacing: 0.2,
        }}>{lo} — {hi}</div>
      </div>

      <div ref={trackRef} style={{ position: "relative", height: 30 }}>
        <div style={{ position: "absolute", top: 13, left: 0, right: 0, height: 1.5, background: "#D6CDBD", borderRadius: 1 }} />
        <div style={{
          position: "absolute", top: 12, left: `${pct(lo)}%`,
          width: `${pct(hi) - pct(lo)}%`, height: 3, background: "#1F5963", borderRadius: 2,
        }} />

        <div onMouseDown={(e) => { e.preventDefault(); setDragging("lo"); }} style={{
          position: "absolute", top: 5, left: `${pct(lo)}%`, transform: "translateX(-50%)",
          width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF",
          border: "2px solid #1F5963", boxShadow: "0 1px 4px rgba(26,24,20,0.18)", cursor: "ew-resize",
        }} />
        <div onMouseDown={(e) => { e.preventDefault(); setDragging("hi"); }} style={{
          position: "absolute", top: 5, left: `${pct(hi)}%`, transform: "translateX(-50%)",
          width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF",
          border: "2px solid #1F5963", boxShadow: "0 1px 4px rgba(26,24,20,0.18)", cursor: "ew-resize",
        }} />

        {decades.map((d) => {
          const isLabel = labelDecades.includes(d);
          return (
            <div key={d} style={{
              position: "absolute", left: `${pct(d)}%`, top: 21,
              width: 1, height: isLabel ? 5 : 3, background: "#1A1814",
              opacity: isLabel ? 0.55 : 0.3, transform: "translateX(-50%)", pointerEvents: "none",
            }} />
          );
        })}
      </div>

      <div style={{ position: "relative", height: 14, marginTop: 2 }}>
        {labelDecades.map((d) => (
          <div key={d} style={{
            position: "absolute", left: `${pct(d)}%`, transform: "translateX(-50%)",
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10.5, color: "#A39684", letterSpacing: 0.2, lineHeight: 1,
          }}>’{String(d).slice(-2)}</div>
        ))}
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginTop: 10, fontSize: 12, color: "#3D3833",
      }}>
        <div>
          <span style={{
            fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
            fontWeight: 600, color: "#1A1814",
          }}>{visibleCount}</span>
          <span style={{ color: "#6B6359" }}> photographs visible</span>
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, color: "#A39684", letterSpacing: 0.2,
        }}>{totalCount} total in collection</div>
      </div>
    </div>
  );
}

// ── Map controls ────────────────────────────────────────────────

function MapControls({ onZoomIn, onZoomOut, onReset }: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) {
  const btn = (children: React.ReactNode, onClick: () => void, last?: boolean) => (
    <button onClick={onClick} style={{
      width: 40, height: 40, background: "#FFFFFF", border: "none",
      borderBottom: last ? "none" : "1px solid #EEE6D6",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", color: "#1A1814",
    }}>{children}</button>
  );
  return (
    <div style={{
      position: "absolute", bottom: 28, right: 24, zIndex: 4,
      width: 40, borderRadius: 10, overflow: "hidden",
      border: "1px solid #D6CDBD", boxShadow: "0 2px 12px rgba(26,24,20,0.06)",
    }}>
      {btn(<PlusIcon />, onZoomIn)}
      {btn(<MinusIcon />, onZoomOut)}
      {btn(<ResetIcon />, onReset, true)}
    </div>
  );
}
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="#1A1814" strokeWidth="1.6" strokeLinecap="round" /></svg>; }
function MinusIcon() { return <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7h12" stroke="#1A1814" strokeWidth="1.6" strokeLinecap="round" /></svg>; }
function ResetIcon() { return <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 7a4.5 4.5 0 1 1 1.3 3.2" stroke="#1A1814" strokeWidth="1.4" fill="none" strokeLinecap="round" /><path d="M2 4v3h3" stroke="#1A1814" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

// ── Story of the Week card ──────────────────────────────────────

function StoryOfTheWeek({ onOpen }: { onOpen: () => void }) {
  return (
    <div onClick={onOpen} style={{
      position: "absolute", bottom: 28, left: 24, zIndex: 4, width: 312,
      background: "#FFFFFF", border: "1px solid #D6CDBD", borderRadius: 12,
      overflow: "hidden", boxShadow: "0 2px 12px rgba(26,24,20,0.06)",
      cursor: "pointer", transition: "transform 120ms, box-shadow 120ms",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(26,24,20,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(26,24,20,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{
        height: 132, background: "repeating-linear-gradient(135deg, #C8B68F 0 8px, #B8A37A 8px 16px)", position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(26,24,20,0) 40%, rgba(26,24,20,0.55) 100%)" }} />
        <div style={{
          position: "absolute", top: 10, left: 12,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
          color: "#fff", opacity: 0.92, background: "rgba(26,24,20,0.55)",
          padding: "4px 8px", borderRadius: 3,
        }}>Story of the week</div>
        <div style={{
          position: "absolute", bottom: 8, right: 10,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, color: "#fff", opacity: 0.85,
        }}>[ archival photo ]</div>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
          fontWeight: 500, fontSize: 20, lineHeight: 1.15, letterSpacing: -0.2,
          color: "#1A1814", marginBottom: 6,
        }}>Millionaire&apos;s Row</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: "#3D3833", marginBottom: 12 }}>
          The mansions Euclid Avenue lost — and the photographs that remember them.
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#1F5963", fontSize: 13, fontWeight: 500 }}>Read story →</span>
          <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, color: "#A39684" }}>11 photos · 1900–1928</span>
        </div>
      </div>
    </div>
  );
}

// ── Density legend ──────────────────────────────────────────────

function DensityLegend() {
  return (
    <div style={{
      position: "absolute", bottom: 28, left: 360, zIndex: 4, padding: "10px 14px",
      background: "rgba(255,255,255,0.86)", border: "1px solid #D6CDBD", borderRadius: 10,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, color: "#6B6359",
      display: "flex", alignItems: "center", gap: 10, letterSpacing: 0.4, textTransform: "uppercase",
    }}>
      <span>1 dot = 1 photo</span>
      <span style={{ color: "#D6CDBD" }}>·</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C8983A", display: "inline-block" }} />
        featured
      </span>
      <span style={{ color: "#D6CDBD" }}>·</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#A8362B", display: "inline-block" }} />
        photo
      </span>
    </div>
  );
}

function AttributionPill({ visibleCount, totalCount, yearRange }: { visibleCount: number; totalCount: number; yearRange: [number, number] }) {
  return (
    <div style={{
      position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 3,
      padding: "7px 14px", background: "rgba(255,255,255,0.86)", border: "1px solid #D6CDBD",
      borderRadius: 999, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 11, color: "#6B6359", letterSpacing: 0.4, textTransform: "uppercase", pointerEvents: "none",
    }}>
      Showing {visibleCount} of {totalCount} photographs · {yearRange[0]}–{yearRange[1]}
    </div>
  );
}

// ── Onboarding whisper (dismissable) ────────────────────────────

function OnboardingWhisper({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 4,
      padding: "10px 14px", background: "rgba(26,24,20,0.88)", color: "#F6F2EB",
      borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 12,
      maxWidth: 480, boxShadow: "0 4px 18px rgba(26,24,20,0.22)",
    }}>
      <span style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: "#C8983A",
      }}>30 sec</span>
      <span style={{ flex: 1, lineHeight: 1.35 }}>
        Drag the time slider. Click a dot. Find your street.
      </span>
      <button onClick={onDismiss} style={{
        background: "none", border: "none", color: "#F6F2EB", opacity: 0.7,
        fontSize: 18, lineHeight: 1, padding: 0, cursor: "pointer",
      }}>×</button>
    </div>
  );
}
