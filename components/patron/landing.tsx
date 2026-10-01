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
  adaptHarvestedRecord, adaptFacetPhoto, applyPatronEnrichment,
  type Photo, type HarvestedRecord,
} from "./data";
import type { FacetPhoto, PatronEnrichment } from "@/lib/types";
import { SearchIcon, SearchPanel, PhotoDetailPanel } from "./panels";
import { buildExhibits, exhibitPoints, ExhibitsIndex, ExhibitPage, type Exhibit } from "./exhibits";
import { BrowseByPicture } from "./browse-by-picture";
import { GalleryView, photosInBounds } from "./gallery";
import type { MapBounds } from "./cleveland-map";
import { C, F, T, SHADOW, HATCH, patronCssVars } from "./theme";

const ClevelandMap = dynamic(() => import("./cleveland-map"), { ssr: false });

const MIN_YEAR = 1880;
// 2025, not 2020: the collection holds 2022 photographs (the Clark-Fulton street series), and a
// slider ending at 2020 meant dragging it — or Reset — silently dropped them.
const MAX_YEAR = 2025;
const FULL_RANGE: [number, number] = [MIN_YEAR, MAX_YEAR];
// Public Square — the synthetic "near you" point for the demo.
const NEAR_YOU = { x: 484, y: 376, label: "Public Square" };

export default function PatronLanding() {
  const [photos, setPhotos] = React.useState<Photo[]>(CURATED_PHOTOS);
  const [yearRange, setYearRange] = React.useState<[number, number]>(FULL_RANGE);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Photo | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [nearYouActive, setNearYouActive] = React.useState(false);
  // The masthead's sections. EXHIBITS and WHAT'S IN THE PICTURE are full pages that cover the map
  // (which stays mounted underneath, so THE MAP returns you exactly where you left it).
  const [section, setSection] = React.useState<Section>("map");
  const [exhibitId, setExhibitId] = React.useState<string | null>(null);
  const [facetPhotos, setFacetPhotos] = React.useState<FacetPhoto[]>([]);
  const [mapFocus, setMapFocus] = React.useState<{ key: number; points: { lat: number; lng: number }[] } | null>(null);
  const sectionScrollRef = React.useRef<HTMLDivElement | null>(null);
  // `inert` is set by hand: React 18 drops it as an unknown boolean attribute, and the newer
  // @types/react types it as boolean, so neither spelling survives JSX.
  const mapLayerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = mapLayerRef.current;
    if (!el) return;
    el.toggleAttribute("inert", section !== "map");
    if (section !== "map") el.setAttribute("aria-hidden", "true"); else el.removeAttribute("aria-hidden");
  }, [section]);
  const [whisperOpen, setWhisperOpen] = React.useState(true);
  // Closing the card only clears it off the map for this visit — the exhibit is still one click
  // away under EXHIBITS in the masthead.
  const [storyCardOpen, setStoryCardOpen] = React.useState(true);
  // Map or gallery — two views of the same place. The gallery shows what's inside the map's
  // current bounds, so the map stays mounted under it and reports its area as it moves.
  const [mode, setMode] = React.useState<"map" | "gallery">("map");
  const [bounds, setBounds] = React.useState<MapBounds | null>(null);

  // ── Merge the pool: curated seed + harvested ContentDM + the unified box-scan 99 ──
  // The box-scans (live read of the unified enrichment store) carry geocoded coords from the
  // Finalize stage, so they place on the map alongside ContentDM records — one collection.
  //
  // The harvested records arrive in two halves that have to be put back together here: the CATALOG
  // is a static file (a harvest snapshot, no DB), while anything staff have ENRICHED about those
  // same photographs — today the then-and-now viewpoint — is a live read joined on the ContentDM
  // id. Without that join a cataloged photo could never show a "now", however much work a
  // librarian had done on it.
  React.useEffect(() => {
    let cancelled = false;
    const harvest = fetch("/data/tier3-all/records.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("records.json missing"))))
      .then((raw: HarvestedRecord[]) => raw.map(adaptHarvestedRecord).filter((p): p is Photo => p !== null))
      .catch((err) => { console.warn("[harvest] using curated photos only:", err.message); return [] as Photo[]; });
    const enrichment = fetch("/api/patron/enrichment")
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d: { photos: PatronEnrichment[] }) => d.photos || [])
      .catch(() => [] as PatronEnrichment[]);
    const facetRows = fetch("/api/patron/facets")
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d: { photos: FacetPhoto[] }) => d.photos || [])
      .catch(() => [] as FacetPhoto[]);
    const boxScans = facetRows.then((rows) => rows.map(adaptFacetPhoto).filter((p): p is Photo => p !== null));

    Promise.all([harvest, enrichment, boxScans, facetRows]).then(([harvested, overlay, box, rows]) => {
      if (cancelled) return;
      setFacetPhotos(rows); // all 99, placed or not — the exhibits draw on the unplaced ones too
      const enriched = applyPatronEnrichment(harvested, overlay);
      setPhotos([...CLEVELAND_PHOTOS, ...enriched, ...box, ...MILLIONAIRES_ROW]);
      console.log(
        `[map] ${harvested.length} ContentDM (${overlay.length} enriched) + ${box.length} box-scan placed on the map`,
      );
    });
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
  const inViewCount = React.useMemo(
    () => photosInBounds(photos, bounds).filter((p) => p.year > 0 && p.year >= yearRange[0] && p.year <= yearRange[1]).length,
    [photos, bounds, yearRange],
  );
  const totalCount = photos.length;

  const exhibits = React.useMemo(() => buildExhibits(photos, facetPhotos), [photos, facetPhotos]);
  const exhibit = exhibits.find((e) => e.id === exhibitId) ?? null;
  const experiment = React.useMemo(() => photos.find((p) => String(p.contentdm_id) === "8617") ?? null, [photos]);

  const goSection = (s: Section) => {
    setSection(s);
    if (s !== "exhibits") setExhibitId(null);
    if (s === "map") setMode("map");
    sectionScrollRef.current?.scrollTo({ top: 0 });
  };
  const openExhibit = (id: string | null) => {
    setSection("exhibits");
    setExhibitId(id);
    sectionScrollRef.current?.scrollTo({ top: 0 });
  };
  const showExhibitOnMap = (e: Exhibit) => {
    goSection("map");
    setMapFocus({ key: Date.now(), points: exhibitPoints(e) });
  };

  // ── Keyboard ──
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // One layer at a time: photo → search → an exhibit → the section → the gallery.
        if (selected) setSelected(null);
        else if (searchOpen) setSearchOpen(false);
        else if (exhibitId) setExhibitId(null);
        else if (section !== "map") setSection("map");
        else if (mode === "gallery") setMode("map");
      }
      // G flips map ↔ gallery — only when nothing is open and nobody is typing.
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing
        && !selected && section === "map" && !searchOpen) {
        setMode((m) => (m === "map" ? "gallery" : "map"));
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, section, exhibitId, searchOpen, mode]);

  // 3 maps to Leaflet zoom 18 (cleveland-map: 13 + (z − 1) × 2.5) — the deepest level, where the
  // dots become photographs. The old 2.4 cap stopped the + button at 16.5, short of it.
  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)));
  const resetView = () => { setZoom(1); setYearRange(FULL_RANGE); setNearYouActive(false); };

  return (
    <div className="dc-root" style={{
      ...patronCssVars,
      width: "100%", height: "100%", background: C.canvas, color: C.body,
      fontFamily: F.sans,
      WebkitFontSmoothing: "antialiased", display: "flex", flexDirection: "column",
      overflow: "hidden", position: "relative",
    }}>
      <DesktopHeader
        current={section}
        onMapClick={() => goSection("map")}
        onStoriesClick={() => openExhibit(null)}
        onSearchClick={() => setSearchOpen(true)}
        onBrowseClick={() => goSection("browse")}
      />
      <div ref={mapWrapRef} style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {/* The map and its overlays. While a full page covers them they're inert — out of the tab
            order and the accessibility tree — so nobody can tab into a map they can't see. */}
        <div ref={mapLayerRef} style={{ position: "absolute", inset: 0 }}>
        <ClevelandMap
          width={size.w}
          height={size.h}
          yearRange={yearRange}
          hoveredId={hoveredId}
          selectedId={selected ? selected.id : null}
          onDotHover={setHoveredId}
          onDotClick={(p) => setSelected(p)}
          zoom={zoom}
          onZoomChange={setZoom}
          onBoundsChange={setBounds}
          focus={mapFocus}
          nearYou={nearYouActive ? NEAR_YOU : null}
          photos={photos}
        />

        <GeolocationPill active={nearYouActive} onToggle={() => setNearYouActive((v) => !v)} />
        <TimeRangeFilter value={yearRange} onChange={setYearRange}
          visibleCount={visibleCount} totalCount={totalCount} />
        <MapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetView} />
        {storyCardOpen && (
          <StoryOfTheWeek onOpen={() => openExhibit("millionaires-row")} onDismiss={() => setStoryCardOpen(false)} />
        )}
        {/* The legend sits beside the story card; with the card gone it takes its corner. */}
        <DensityLegend left={storyCardOpen ? 340 : 20} />
        {section === "map" && <ViewToggle mode={mode} onMode={setMode} inViewCount={inViewCount} />}

        {mode === "gallery" && (
          <GalleryView
            photos={photos}
            bounds={bounds}
            yearRange={yearRange}
            onYearRange={setYearRange}
            fullRange={FULL_RANGE}
            timeControl={
              <TimeRangeFilter value={yearRange} onChange={setYearRange}
                visibleCount={inViewCount} totalCount={totalCount} embedded />
            }
            selectedId={selected ? selected.id : null}
            onOpenPhoto={(p) => setSelected(p)}
            onShowMap={() => setMode("map")}
          />
        )}

        {whisperOpen && <OnboardingWhisper onDismiss={() => setWhisperOpen(false)} />}
        </div>

        {/* EXHIBITS and WHAT'S IN THE PICTURE are full pages of their own, laid over the map under
            the masthead. One scroll container for both, so each section scrolls as a page. */}
        {section !== "map" && (
          <div ref={sectionScrollRef} style={{ position: "absolute", inset: 0, zIndex: 8, background: C.canvas, overflowY: "auto" }}>
            {section === "browse" && <BrowseByPicture onOpenPhoto={(p) => setSelected(p)} />}
            {section === "exhibits" && !exhibit && (
              <ExhibitsIndex
                exhibits={exhibits}
                onOpen={openExhibit}
                onShowOnMap={showExhibitOnMap}
                experiment={experiment}
                onOpenPhoto={(p) => setSelected(p)}
              />
            )}
            {section === "exhibits" && exhibit && (
              <ExhibitPage
                exhibit={exhibit}
                next={exhibits.length > 1 ? exhibits[(exhibits.indexOf(exhibit) + 1) % exhibits.length] : null}
                onBack={() => openExhibit(null)}
                onOpen={openExhibit}
                onOpenPhoto={(p) => setSelected(p)}
                onShowOnMap={showExhibitOnMap}
                scrollRoot={sectionScrollRef}
              />
            )}
          </div>
        )}
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

    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────
// SiteHeader: a provenance strip saying what the visitor is looking at, then the masthead —
// set-type wordmark (no logo), uppercase section tabs, a square search field.

type Section = "map" | "exhibits" | "browse";

function DesktopHeader({
  current, onMapClick, onStoriesClick, onSearchClick, onBrowseClick,
}: {
  current: Section;
  onMapClick: () => void;
  onStoriesClick: () => void;
  onSearchClick: () => void;
  onBrowseClick: () => void;
}) {
  return (
    <header style={{ position: "relative", zIndex: 5, flexShrink: 0 }}>
      <div style={{
        background: C.sunken, borderBottom: `1px solid ${C.hairLight}`,
        padding: "4px 32px", fontFamily: F.mono, fontSize: 10, lineHeight: 1.6,
        letterSpacing: "0.08em", color: C.tertiary, textTransform: "uppercase",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        Cleveland Public Library · Photograph collection · Catalog records from ContentDM ·
        Box-scan locations &amp; descriptions machine-extracted, curator-reviewable
      </div>
      <div style={{
        background: C.canvas, borderBottom: `1px solid ${C.hairLight}`,
        display: "flex", alignItems: "center", gap: 32, padding: "14px 32px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: F.serif, fontSize: 24, fontWeight: 800, lineHeight: 1, color: C.navy }}>
            Cleveland Neighborhoods
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.14em", color: C.tertiary }}>
            1880–{MAX_YEAR}
          </span>
        </div>
        <nav className="dc-nav" aria-label="Sections">
          <button aria-current={current === "map"} onClick={onMapClick}>The Map</button>
          <button aria-current={current === "exhibits"} onClick={onStoriesClick}>Exhibits</button>
          <button aria-current={current === "browse"} onClick={onBrowseClick}>What&rsquo;s in the Picture</button>
          <button>About</button>
        </nav>
        <div style={{ flex: 1 }} />
        <button className="dc-search-trigger" onClick={onSearchClick} aria-label="Search the collection">
          <SearchIcon color={C.navy} />
          <span style={{ flex: 1, textAlign: "left" }}>Search the collection</span>
          <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.06em", color: C.tertiary }}>⌘K</span>
        </button>
      </div>
    </header>
  );
}

// ── Shared overlay frame ────────────────────────────────────────
// Map overlays are floating layers — square, hairline-keyed, the one place a shadow is allowed.
const overlay: React.CSSProperties = {
  position: "absolute", zIndex: 4, background: C.canvas,
  border: `1px solid ${C.hairMed}`, boxShadow: SHADOW.overlay,
};

// ── Geolocation ─────────────────────────────────────────────────

function GeolocationPill({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      className={`dc-btn ${active ? "dc-btn--primary" : "dc-btn--ghost"}`}
      style={{ position: "absolute", top: 20, right: 20, zIndex: 4, boxShadow: SHADOW.overlay }}
    >
      <LocationGlyph color={active ? C.onNavy : C.navy} />
      {active ? <>Near you · {NEAR_YOU.label} ✕</> : <>Photos near you →</>}
    </button>
  );
}

function LocationGlyph({ color }: { color: string }) {
  return (
    <svg width="11" height="13" viewBox="0 0 14 16" fill="none" aria-hidden>
      <path d="M7 1c-3.3 0-6 2.6-6 5.8 0 4.4 6 8.7 6 8.7s6-4.3 6-8.7C13 3.6 10.3 1 7 1z" fill={color} />
      <circle cx="7" cy="6.6" r="2" fill={color === C.navy ? C.canvas : C.navy} />
    </svg>
  );
}

// ── Time-range filter (draggable) ───────────────────────────────
// A timeline on a 2px navy baseline (TimelineScrubber's rule); the selected span is the thick
// navy bar, the handles square.

function TimeRangeFilter({
  value, onChange, visibleCount, totalCount, embedded,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
  visibleCount: number;
  totalCount: number;
  /** In the gallery's rail rather than floating on the map — no frame, fills its column. */
  embedded?: boolean;
}) {
  const [lo, hi] = value;
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState<"lo" | "hi" | null>(null);

  const decades = [1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
  const labelDecades = embedded ? [1880, 1920, 1960, 2000] : [1880, 1900, 1920, 1940, 1960, 1980, 2000, 2020];
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

  const handle = (which: "lo" | "hi", at: number): React.ReactNode => (
    <div
      onMouseDown={(e) => { e.preventDefault(); setDragging(which); }}
      role="slider"
      aria-label={which === "lo" ? "Earliest year" : "Latest year"}
      aria-valuemin={MIN_YEAR}
      aria-valuemax={MAX_YEAR}
      aria-valuenow={at}
      style={{
        position: "absolute", top: 4, left: `${pct(at)}%`, transform: "translateX(-50%)",
        width: 12, height: 20, background: C.canvas,
        border: `2px solid ${C.navy}`, boxSizing: "border-box",
        cursor: "ew-resize",
      }}
    />
  );

  return (
    <div style={embedded
      ? { userSelect: "none" }
      : { ...overlay, top: 20, left: 20, width: 440, padding: "14px 20px 14px", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={T.sectionLabel}>Time range</div>
        <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 700, color: C.navy, fontVariantNumeric: "tabular-nums" }}>
          {lo} – {hi}
        </div>
      </div>

      {/* Embedded, the handles and end labels would overhang the rail's edge and be clipped. */}
      <div ref={trackRef} style={{ position: "relative", height: 28, margin: embedded ? "0 14px" : 0 }}>
        <div style={{ position: "absolute", top: 13, left: 0, right: 0, height: 2, background: C.hairMed }} />
        <div style={{
          position: "absolute", top: 12, left: `${pct(lo)}%`,
          width: `${pct(hi) - pct(lo)}%`, height: 4, background: C.navy,
        }} />
        {decades.map((d) => {
          const isLabel = labelDecades.includes(d);
          return (
            <div key={d} style={{
              position: "absolute", left: `${pct(d)}%`, top: 18,
              width: 1, height: isLabel ? 6 : 3, background: isLabel ? C.secondary : C.hairMed,
              transform: "translateX(-50%)", pointerEvents: "none",
            }} />
          );
        })}
        {handle("lo", lo)}
        {handle("hi", hi)}
      </div>

      <div style={{ position: "relative", height: 14, marginTop: 2, margin: embedded ? "2px 14px 0" : undefined }}>
        {labelDecades.map((d) => (
          <div key={d} style={{
            position: "absolute", left: `${pct(d)}%`, transform: "translateX(-50%)",
            ...T.stamp, lineHeight: 1,
          }}>{d}</div>
        ))}
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.hairLight}`,
      }}>
        <div style={{ fontFamily: F.serif, fontSize: 15, color: C.body }}>
          <span style={{ fontWeight: 700, color: C.ink }}>{visibleCount}</span> {embedded ? "in view" : "photographs in range"}
        </div>
        <div style={T.meta}>{totalCount} in the collection</div>
      </div>
    </div>
  );
}

// ── Map controls ────────────────────────────────────────────────

function MapControls({ onZoomIn, onZoomOut, onReset }: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) {
  const sep = { borderTop: `1px solid ${C.hairLight}` };
  return (
    <div style={{ ...overlay, bottom: 24, right: 20, width: 36 }}>
      <button className="dc-mapbtn" onClick={onZoomIn} aria-label="Zoom in"><PlusIcon /></button>
      <button className="dc-mapbtn" onClick={onZoomOut} aria-label="Zoom out" style={sep}><MinusIcon /></button>
      <button className="dc-mapbtn" onClick={onReset} aria-label="Reset the view" style={sep}><ResetIcon /></button>
    </div>
  );
}
function PlusIcon() { return <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" /></svg>; }
function MinusIcon() { return <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden><path d="M1 7h12" stroke="currentColor" strokeWidth="1.6" /></svg>; }
function ResetIcon() { return <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden><path d="M2.5 7a4.5 4.5 0 1 1 1.3 3.2" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M2 4v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>; }

// ── Story of the Week card ──────────────────────────────────────

// The cover is the trail's Rockefeller stop — the one image whose subject and corner match exactly.
const STORY_COVER = MILLIONAIRES_ROW.find((p) => p.id === "mr-5")?.thumb;

function StoryOfTheWeek({ onOpen, onDismiss }: { onOpen: () => void; onDismiss: () => void }) {
  // The card is a button, and a button can't hold another — so the ✕ is a sibling laid over the
  // cover's corner, on an ink square so it reads against any photograph.
  return (
    <div style={{ position: "absolute", bottom: 24, left: 20, width: 300, zIndex: 4 }}>
    <button
      onClick={onOpen}
      className="dc-story"
      style={{
        ...overlay, position: "relative", width: "100%", padding: 0, textAlign: "left",
        cursor: "pointer", borderTop: `3px solid ${C.marigold}`,
      }}
    >
      <div style={{
        height: 124, position: "relative", borderBottom: `1px solid ${C.hairLight}`,
        background: STORY_COVER ? `center 40% / cover no-repeat url(${STORY_COVER}), ${C.sunken}` : HATCH,
      }} />
      <div style={{ padding: "12px 16px 14px" }}>
        <span style={{ ...T.kicker, fontSize: 10.5, display: "inline-block", borderBottom: `3px solid ${C.marigold}`, paddingBottom: 3 }}>
          Featured exhibit
        </span>
        <div className="dc-row__title" style={{ ...T.cardTitle, fontSize: 21, marginTop: 10 }}>Millionaire&apos;s Row</div>
        <div style={{ ...T.snippet, fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>
          The mansions Euclid Avenue lost — and the photographs that remember them.
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12 }}>
          <span className="dc-link" style={{ whiteSpace: "nowrap" }}>Enter the exhibit →</span>
          <span style={{ ...T.stamp, whiteSpace: "nowrap" }}>11 STOPS · 1900–1928</span>
        </div>
      </div>
    </button>
    <button
      className="dc-close"
      onClick={onDismiss}
      aria-label="Close the featured exhibit"
      title="Close"
      style={{ position: "absolute", zIndex: 5, top: 3, right: 0, width: 28, height: 28, fontSize: 13, background: C.ink, color: C.onNavy, borderColor: C.ink }}
    >✕</button>
    </div>
  );
}

// ── Density legend ──────────────────────────────────────────────

function DensityLegend({ left }: { left: number }) {
  const dot = (bg: string, ring?: boolean): React.ReactNode => (
    <span style={{
      width: 8, height: 8, borderRadius: "50%", background: bg, display: "inline-block",
      boxShadow: ring ? `0 0 0 1px ${C.ink}` : undefined,
    }} />
  );
  return (
    <div style={{
      ...overlay, bottom: 24, left, padding: "8px 12px", background: C.glass,
      ...T.meta, color: C.secondary,
      // The legend sits at a fixed left offset, so each item added pushes its right edge toward
      // the viewport. Wrap instead of clipping.
      display: "flex", alignItems: "center", gap: 10,
      flexWrap: "wrap", maxWidth: `calc(100vw - ${left + 80}px)`, rowGap: 6,
    } as React.CSSProperties}>
      {/* A dot is a *place*, not a photograph — corners photographed more than once carry a
          count (lib/patron-places.ts). Saying "1 dot = 1 photo" here would be a plain lie. */}
      <span>1 dot = 1 corner</span>
      <span style={{ color: C.hairMed }}>·</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          minWidth: 14, height: 14, padding: "0 3px", background: C.ink, color: C.onNavy,
          fontSize: 9, fontWeight: 700, lineHeight: "14px", textAlign: "center", display: "inline-block",
          boxSizing: "border-box",
        }}>3</span>
        photos here
      </span>
      <span style={{ color: C.hairMed }}>·</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{dot(C.marigold, true)} featured</span>
      <span style={{ color: C.hairMed }}>·</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{dot(C.navy)} photograph</span>
      <span style={{ color: C.hairMed }}>·</span>
      <span>Zoom all the way in to see the pictures</span>
    </div>
  );
}

// ── Map ↔ gallery ───────────────────────────────────────────────
// Sits where the "showing n of m" pill used to — top centre, over both views — and carries
// that count itself: the Gallery option says how many pictures are waiting in the current view.

function ViewToggle({ mode, onMode, inViewCount }: { mode: "map" | "gallery"; onMode: (m: "map" | "gallery") => void; inViewCount: number }) {
  return (
    <div className="dc-seg" role="group" aria-label="View" style={{
      position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 7,
      boxShadow: SHADOW.overlay,
    }}>
      <button aria-pressed={mode === "map"} onClick={() => onMode("map")} title="Map view (G)" style={{ gap: 8 }}>
        <MapGlyph /> Map
      </button>
      <button aria-pressed={mode === "gallery"} onClick={() => onMode("gallery")} title="Gallery of what's in view (G)" style={{ gap: 8 }}>
        <GridGlyph /> Gallery
        <span style={{
          fontFamily: F.mono, fontSize: 10, fontWeight: 700, padding: "1px 5px", marginLeft: 2,
          background: mode === "gallery" ? "rgba(255,255,255,0.18)" : C.sunken,
        }}>{inViewCount}</span>
      </button>
    </div>
  );
}
function MapGlyph() {
  return <svg width="13" height="12" viewBox="0 0 13 12" fill="none" aria-hidden><path d="M1 2.5 4.5 1l4 1.5L12 1v8.5L8.5 11l-4-1.5L1 11V2.5Z" stroke="currentColor" strokeWidth="1.2" /><path d="M4.5 1v8.5M8.5 2.5V11" stroke="currentColor" strokeWidth="1.2" /></svg>;
}
function GridGlyph() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><rect x="0.6" y="0.6" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.2" /><rect x="6.9" y="0.6" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.2" /><rect x="0.6" y="6.9" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.2" /><rect x="6.9" y="6.9" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1.2" /></svg>;
}

// ── Onboarding whisper (dismissable) ────────────────────────────

function OnboardingWhisper({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      // Above the bottom row of overlays (story card, legend, zoom), not among them.
      position: "absolute", bottom: 76, left: "50%", transform: "translateX(-50%)", zIndex: 4,
      padding: "8px 8px 8px 0", background: C.ink, color: C.onNavy,
      display: "flex", alignItems: "center", gap: 12, maxWidth: 480, boxShadow: SHADOW.popover,
    }}>
      <span style={{
        alignSelf: "stretch", display: "flex", alignItems: "center", padding: "0 10px",
        background: C.marigold, color: C.onMarigold,
        fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        marginTop: -8, marginBottom: -8,
      }}>30 sec</span>
      <span style={{ flex: 1, fontFamily: F.serif, fontSize: 14.5, lineHeight: 1.35 }}>
        Drag the time range. Click a dot. Press G for a gallery of what&rsquo;s in view.
      </span>
      <button onClick={onDismiss} aria-label="Dismiss" className="dc-close" style={{ color: C.onNavy, width: 26, height: 26 }}>✕</button>
    </div>
  );
}
