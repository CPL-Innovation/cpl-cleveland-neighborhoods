"use client";
// Patron overlays: search panel, photo detail (slide-in), and the Millionaire's Row
// story trail. Ported from desktop-landing.jsx. The photo pool arrives as props (was
// window.ALL_PHOTOS); the story trail reads MILLIONAIRES_ROW directly.
import React from "react";
import { MILLIONAIRES_ROW, type Photo } from "./data";
import { siblingsOf, yearSpan } from "@/lib/patron-places";
import { autoStreetViewUrl } from "@/lib/rephoto";

export function SearchIcon({ size = 14, color = "#3D3833" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={color} strokeWidth="1.4" />
      <path d="M9.5 9.5 L13 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Search panel (inline expand) ────────────────────────────────

const EXEMPLAR_PROMPTS = [
  "Public Square 1930",
  "West Side Market",
  "Millionaire's Row",
  "Detroit Ave streetcar",
  "1234 Detroit Ave.",
];

export function SearchPanel({
  query, onQuery, onClose, onPick, photos,
}: {
  query: string;
  onQuery: (q: string) => void;
  onClose: () => void;
  onPick: (p: Photo) => void;
  photos: Photo[];
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? photos.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.neighborhood || "").toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q) ||
        String(p.year).includes(q)
      ).slice(0, 8)
    : [];

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: "rgba(26,24,20,0.32)",
        display: "flex", justifyContent: "center", paddingTop: 92,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640, background: "#FFFFFF", border: "1px solid #D6CDBD",
          borderRadius: 14, boxShadow: "0 24px 60px rgba(26,24,20,0.22)", overflow: "hidden",
          height: "fit-content",
        }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px", borderBottom: "1px solid #EEE6D6",
        }}>
          <SearchIcon size={16} color="#6B6359" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Try a place, year, or address…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontFamily: "'Work Sans', sans-serif", fontSize: 16, color: "#1A1814",
              background: "transparent",
            }}
          />
          <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, color: "#A39684" }}>esc</span>
        </div>

        {!q && (
          <div style={{ padding: "14px 18px" }}>
            <div style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
              color: "#A39684", marginBottom: 10,
            }}>Try</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXEMPLAR_PROMPTS.map((p) => (
                <button key={p} onClick={() => onQuery(p)} style={{
                  background: "#F6F2EB", border: "1px solid #E6DECC", borderRadius: 999,
                  padding: "6px 12px", fontSize: 13, color: "#3D3833", cursor: "pointer",
                  fontFamily: "'Work Sans', sans-serif",
                }}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {q && results.length === 0 && (
          <div style={{ padding: "24px 18px", color: "#6B6359", fontSize: 14 }}>
            No matches. Try a neighborhood or a year.
          </div>
        )}

        {q && results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {results.map((p) => (
              <button key={p.id} onClick={() => onPick(p)} style={{
                display: "flex", alignItems: "center", gap: 12,
                width: "100%", textAlign: "left", padding: "10px 18px",
                background: "transparent", border: "none",
                borderBottom: "1px solid #F0EADC", cursor: "pointer",
                fontFamily: "'Work Sans', sans-serif",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF6EE")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: p.featured ? "#C8983A" : "#A8362B", flexShrink: 0,
                }} />
                <span style={{ flex: 1, color: "#1A1814", fontSize: 14 }}>{p.title}</span>
                <span style={{ color: "#6B6359", fontSize: 12 }}>{p.neighborhood}</span>
                <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, color: "#A39684" }}>{p.year}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Photo detail panel (slides in from right) ───────────────────

export function PhotoDetailPanel({
  photo, onClose, onOpenPhoto, photos,
}: {
  photo: Photo;
  onClose: () => void;
  onOpenPhoto: (p: Photo) => void;
  photos: Photo[];
}) {
  // Neighbors-in-time: within ~80 viewBox units AND ±8 years. Skipped for the faceted 99
  // (they aren't map-placed — the convergence slice opens them from the browse grid).
  // Repeat visits to this exact corner. Grouping is by coordinate rather than by proximity —
  // these are the *same address* photographed again, which is a stronger claim than "nearby",
  // and it's what the map now puts behind a single dot (lib/patron-places.ts).
  const corner = siblingsOf(photo, photos);
  const hasSequence = corner.length > 1;

  // Proximity neighbours are a weaker relation than the corner sequence above — suppress them
  // when this photo already has one, so the panel doesn't show two overlapping "related" lists.
  const neighbors = (photo.facets || hasSequence) ? [] : photos.filter((p) =>
    p.id !== photo.id &&
    Math.hypot(p.x - photo.x, p.y - photo.y) < 80 &&
    Math.abs(p.year - photo.year) <= 8
  ).slice(0, 5);

  // Then-and-now, in two strengths. A FRAMED viewpoint is one a librarian walked to and matched
  // against the print — the real thing, and the only one we call a then-and-now. Failing that, a
  // photo with real coordinates gets an UNFRAMED default: Street View dropped at the address,
  // aimed wherever Google aims it (lib/rephoto.ts explains why we can't aim it ourselves).
  //
  // The unframed one is worth showing — most of the collection would otherwise have no "now" at
  // all despite our knowing exactly where it is — but only because it is labelled as what it is
  // everywhere it appears, and the embed is pannable, so "look around" is a real instruction and
  // not an excuse. `framedNow` is the flag the labels key off; nothing downstream may treat the
  // two as interchangeable.
  //
  // Real coordinates only: `photoLatLng` would happily unproject the curated demo photos' legacy
  // viewBox x/y into a plausible-looking Cleveland point, and dropping a patron on a street we
  // merely inferred from a mock-up coordinate is exactly the false promise this is avoiding.
  const framedNow = photo.rephotoEmbedUrl || null;
  const autoNow = framedNow ? null : autoStreetViewUrl(photo.lat, photo.lng);
  const rephotoUrl = framedNow ?? autoNow;
  // `year` is 0 for an undated box-scan (the adapters' sentinel — Photo.year is a number the
  // map filters on, so it can't be null). Never print the sentinel: an undated print must read
  // as undated, not as the year zero.
  const dated = Number.isFinite(photo.year) && photo.year > 0;

  // Two shells, one content. The drawer is the reading view — it sits beside the map so you keep
  // your place in the city. Expanded is the LOOKING view: the whole point of a then-and-now is
  // comparing two images, and 480px of drawer can't hold both at a size worth comparing.
  const [expanded, setExpanded] = React.useState(false);
  const [view, setView] = React.useState<PhotoView>("then");
  const vw = useViewportWidth();
  // Below this two image panes side by side are each too narrow to read, so "both" stacks them.
  const stackCompare = vw < 660;

  React.useEffect(() => { if (!rephotoUrl) setView("then"); }, [rephotoUrl, photo.id]);
  // Side-by-side only exists in the expanded shell; collapsing has to land somewhere real.
  React.useEffect(() => { if (!expanded && view === "both") setView("then"); }, [expanded, view]);

  // Esc peels one layer at a time — expanded → drawer → closed. The landing has its own window
  // Esc handler that closes the panel outright, so this one listens in the CAPTURE phase and
  // stops the event when there's still a layer to peel.
  React.useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [expanded]);

  // Open the rail at the top: expanding, or stepping to another photograph in the corner
  // sequence, should not land you halfway down the last one's metadata.
  const railRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => { if (railRef.current) railRef.current.scrollTop = 0; }, [expanded, photo.id]);

  const media = (
    <PhotoMedia
      photo={photo}
      dated={dated}
      rephotoUrl={rephotoUrl}
      framedNow={!!framedNow}
      view={view}
      onView={(v) => {
        // Asking for the comparison in the drawer is asking for the room to do it.
        if (v === "both" && !expanded) setExpanded(true);
        setView(v);
      }}
      expanded={expanded}
      stackCompare={stackCompare}
      onExpand={() => setExpanded(true)}
    />
  );

  const facts = (
    <PhotoFacts
      photo={photo}
      corner={corner}
      hasSequence={hasSequence}
      neighbors={neighbors}
      dated={dated}
      onOpenPhoto={onOpenPhoto}
    />
  );

  const chrome = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      padding: "14px 18px", borderBottom: "1px solid #EEE6D6", flexShrink: 0,
    }}>
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: "#6B6359",
      }}>{dated ? `Photo · ${photo.year}` : "Photo · date unknown"}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Back to the map (esc)" : "Open larger"}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "1px solid #EEE6D6", borderRadius: 6,
            padding: "5px 9px", cursor: "pointer", color: "#3D3833",
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase",
          }}
        >
          <ExpandGlyph collapsed={expanded} />
          {expanded ? "Close up" : "Expand"}
        </button>
        <button onClick={onClose} title="Close" style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 20, lineHeight: 1, color: "#6B6359", padding: "0 4px",
        }}>×</button>
      </div>
    </div>
  );

  if (expanded) {
    // One rail, two columns: the image gets the room, the words stay legible beside it. Under
    // ~1100px the rail drops below the image rather than squeezing both.
    const narrow = vw < 1100;
    // The comparison needs roughly twice the picture width of a single image, so the shell grows
    // for it — capped at a single archival print's worth of enlargement rather than the whole
    // monitor, and the metadata rail gives back 40px, because the two photographs are the reason
    // you opened this view. Under the single-image cap it stays the calmer reading-sized dialog.
    const wide = view === "both";
    // Fit the shell to the pictures rather than the other way round: the panes are 4:3, so the
    // width this monitor allows implies a height — anything past it is empty dialog under the
    // photographs. The comparison needs roughly twice the picture width, hence the wider cap.
    const dialogW = wide ? Math.min(2000, vw * 0.96) : Math.min(1240, vw * 0.94);
    const railW = narrow ? 0 : wide ? 380 : 420;
    const paneW = (dialogW - railW - 36 - (wide ? 10 : 0)) / (wide ? 2 : 1);
    const fitH = Math.round(paneW * 0.75 + (wide ? 150 : 128)); // panes + caption + toggle + padding
    return (
      <>
        <div onClick={onClose} style={{
          position: "absolute", inset: 0, zIndex: 59,
          background: "rgba(26,24,20,0.55)", backdropFilter: "blur(2px)",
        }} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={photo.title}
          style={{
            position: "absolute", zIndex: 60,
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: wide ? "min(2000px, 96%)" : "min(1240px, 94%)",
            height: `min(${fitH}px, ${wide ? 94 : 92}%)`,
            transition: "width 220ms cubic-bezier(.2,.8,.2,1), height 220ms cubic-bezier(.2,.8,.2,1)",
            background: "#FFFFFF", border: "1px solid #D6CDBD", borderRadius: 12,
            boxShadow: "0 24px 80px rgba(26,24,20,0.35)", overflow: "hidden",
            display: "grid",
            gridTemplateColumns: narrow ? "1fr" : `1fr ${wide ? 380 : 420}px`,
            // Narrow: the image keeps the larger share and the rail scrolls in what's left —
            // an `auto` second row lets the text push the photograph off the top of the dialog.
            gridTemplateRows: narrow ? "minmax(0,1.15fr) minmax(0,1fr)" : "1fr",
            animation: "patronZoomIn 200ms cubic-bezier(.2,.8,.2,1)",
          }}
        >
          <style>{`@keyframes patronZoomIn { from { transform: translate(-50%,-50%) scale(.97); opacity: 0;} to { transform: translate(-50%,-50%) scale(1); opacity: 1;} }`}</style>

          <div style={{
            minWidth: 0, minHeight: 0, padding: 18,
            display: "flex", flexDirection: "column", background: "#F6F2EB",
            borderRight: narrow ? "none" : "1px solid #EEE6D6",
            borderBottom: narrow ? "1px solid #EEE6D6" : "none",
          }}>
            {media}
          </div>

          <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
            {chrome}
            <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 4 }}>{facts}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 59, background: "rgba(26,24,20,0.18)" }} />
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: 480, zIndex: 60, background: "#FFFFFF",
        borderLeft: "1px solid #D6CDBD", boxShadow: "-10px 0 40px rgba(26,24,20,0.12)",
        display: "flex", flexDirection: "column",
        animation: "patronSlideIn 260ms cubic-bezier(.2,.8,.2,1)",
      }}>
        <style>{`@keyframes patronSlideIn { from { transform: translateX(40px); opacity: 0;} to { transform: translateX(0); opacity:1;} }`}</style>
        {chrome}
        <div ref={railRef} style={{ flex: 1, overflowY: "auto" }}>
          {/* The toggle row now sits *under* the image rather than floating over it (it has three
              segments and an attribution line to carry), so the block is taller than the old 280. */}
          <div style={{ margin: 18, height: 344, display: "flex" }}>{media}</div>
          {facts}
        </div>
      </div>
    </>
  );
}

type PhotoView = "then" | "now" | "both";

/** Window width, for the two layout thresholds the panel can't express in inline styles. */
function useViewportWidth(): number {
  const [w, setW] = React.useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  React.useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

// ── The image itself: then · now · side by side ─────────────────

function PhotoMedia({
  photo, dated, rephotoUrl, framedNow, view, onView, expanded, stackCompare, onExpand,
}: {
  photo: Photo;
  dated: boolean;
  rephotoUrl: string | null;
  /** True only when a librarian framed this viewpoint; false for the address-derived default. */
  framedNow: boolean;
  view: PhotoView;
  onView: (v: PhotoView) => void;
  expanded: boolean;
  stackCompare: boolean;
  onExpand: () => void;
}) {
  const compare = view === "both";
  const showNow = (view === "now" || compare) && !!rephotoUrl;
  const showThen = view === "then" || compare;

  const frame: React.CSSProperties = {
    position: "relative", borderRadius: 8, overflow: "hidden",
    border: "1px solid #D6CDBD", minHeight: 0, minWidth: 0, flex: 1,
    // Expanded, panes take the landscape shape of the photographs themselves and are centred in
    // whatever room is left. Stretching them to the full height of a tall dialog just grows the
    // black letterbox bars above and below the print — more pane, no more picture. (In the drawer
    // the block is a fixed height, so there they stretch.)
    ...(expanded ? { aspectRatio: "4 / 3", maxHeight: "100%", width: "100%", flex: "0 1 auto" } : null),
  };
  const thenBg = photo.thumb ? "#1A1814" : "repeating-linear-gradient(135deg, #C8B68F 0 8px, #B8A37A 8px 16px)";

  const thenPane = (
    <div
      style={{ ...frame, background: thenBg, cursor: expanded ? "default" : "zoom-in" }}
      onClick={expanded ? undefined : onExpand}
    >
      {photo.thumb && (
        <img src={photo.thumb} alt={photo.title} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "contain", display: "block",
        }} />
      )}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(26,24,20,0) 55%, rgba(26,24,20,0.45) 100%)",
      }} />
      {/* Solo only — in the comparison each pane is captioned above the frame instead. */}
      {!compare && <PaneLabel>{dated ? `Then · ${photo.year}` : "Then"}</PaneLabel>}
    </div>
  );

  const nowPane = rephotoUrl ? (
    <div style={{ ...frame, background: "repeating-linear-gradient(135deg, #C8C3B6 0 8px, #B0AC9F 8px 16px)" }}>
      {/* Behind the iframe, and only ever seen through it. The keyless Street View endpoint
          throttles — load a handful of embeds in a couple of minutes and it starts returning a
          blank document, then recovers on its own. Nothing is catchable: the iframe is
          cross-origin, so there is no error, no onError, no failed request. A loaded panorama is
          opaque and hides this; a throttled one leaves the reader looking at a grey rectangle
          with no idea whether the street is gone or the page is broken. Say which. */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, textAlign: "center", pointerEvents: "none",
        fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, lineHeight: 1.6, color: "#4A453D",
      }}>
        Street View isn&rsquo;t loading just now — it limits how often it can be asked.
        <br />The photograph is unaffected; try &ldquo;Now&rdquo; again in a minute.
      </div>
      <iframe
        key={`${photo.id}-${compare ? "cmp" : "solo"}`}
        src={rephotoUrl}
        title={framedNow
          ? `Street View looking at ${photo.address || photo.title} today`
          : `Street View near ${photo.address || photo.title} today`}
        loading="lazy"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </div>
  ) : null;

  // In the comparison the captions sit ABOVE the frames, not on them: Google's embed parks its own
  // address card in the top-left corner, and an overlay chip lands right on top of it.
  const captioned = (caption: string, pane: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0, minWidth: 0, height: "100%", justifyContent: "center" }}>
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10,
        letterSpacing: 1, textTransform: "uppercase", color: "#6B6359", flexShrink: 0,
      }}>{caption}</div>
      {pane}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
      <div style={{
        flex: 1, minHeight: 0, display: "grid", gap: 10,
        gridTemplateColumns: compare && !stackCompare ? "1fr 1fr" : "1fr",
        gridTemplateRows: compare && stackCompare ? "1fr 1fr" : "1fr",
        alignItems: expanded ? "center" : "stretch",
      }}>
        {showThen && (compare ? captioned(dated ? `Then · ${photo.year}` : "Then", thenPane) : thenPane)}
        {showNow && (compare
          ? captioned(framedNow ? "Now · Street View" : "Now · Street View, near this address", nowPane)
          : nowPane)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{
          display: "flex", background: "#FFFFFF", border: "1px solid #D6CDBD",
          borderRadius: 999, overflow: "hidden", boxShadow: "0 2px 8px rgba(26,24,20,0.10)",
        }}>
          {(rephotoUrl ? (["then", "now", "both"] as const) : (["then"] as const)).map((m) => (
            <button key={m} onClick={() => onView(m)} title={
              m === "then" ? undefined
                : framedNow ? "Street View, framed by CPL staff to match the photograph"
                : "Street View near this address — not matched to the photograph"
            } style={{
              padding: "6px 14px",
              background: view === m ? "#1A1814" : "transparent",
              color: view === m ? "#F6F2EB" : "#1A1814",
              border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer",
              fontFamily: "'Work Sans', sans-serif",
            }}>{m === "both" ? "Side by side" : m === "then" ? "Then" : "Now"}</button>
          ))}
        </div>

        {/* The old "scroll to zoom" was a promise nothing kept. Expand is the real one. */}
        {!expanded && (
          <button onClick={onExpand} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: "#6B6359",
          }}>{rephotoUrl ? (framedNow ? "Expand to compare" : "Expand to see the street today") : "Click the photo to expand"}</button>
        )}

        {/* Whose image is this? The archival print is CPL's; the "now" is Google's, and the
            viewpoint is a librarian's judgement about where the photographer stood. Say so —
            the same contract the AI-extracted label keeps elsewhere in this panel. */}
        {showNow && (
          <div style={{
            flex: "1 1 260px", minWidth: 200,
            fontSize: 11, lineHeight: 1.45, color: "#6B6359",
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          }}>
            Imagery &copy; Google Street View
            {framedNow
              ? " · viewpoint matched by CPL staff"
              : " · viewpoint not matched — placed automatically from the address"}
            {framedNow && photo.rephotoBearing != null
              ? ` · facing ${Math.round(((photo.rephotoBearing % 360) + 360) % 360)}°`
              : ""}
            <div style={{ fontFamily: "'Work Sans', sans-serif", fontStyle: "italic", marginTop: 2 }}>
              {framedNow
                ? "Street View is photographed periodically — “now” is the most recent pass down this street, not today."
                : "Nobody has matched this to the photographer’s viewpoint yet — Google dropped the camera near the address, facing whichever way it happened to face. Drag to look around. Street View is photographed periodically, so “now” is the most recent pass down this street, not today."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaneLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", top: 10, left: 12,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10, color: "#fff", opacity: 0.92, background: "rgba(26,24,20,0.55)",
      padding: "4px 8px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase",
      pointerEvents: "none",
    }}>{children}</div>
  );
}

function ExpandGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      {collapsed ? (
        <>
          <path d="M5 1v4H1" stroke="#3D3833" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 11V7h4" stroke="#3D3833" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M1 5V1h4" stroke="#3D3833" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 7v4H7" stroke="#3D3833" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

// ── Everything under the image: the corner sequence, the facts, the asks ────

function PhotoFacts({
  photo, corner, hasSequence, neighbors, dated, onOpenPhoto,
}: {
  photo: Photo;
  corner: Photo[];
  hasSequence: boolean;
  neighbors: Photo[];
  dated: boolean;
  onOpenPhoto: (p: Photo) => void;
}) {
  return (
    <>
      {hasSequence && (
        <div style={{ margin: "14px 18px 0" }}>
          <div style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10,
            letterSpacing: 1, textTransform: "uppercase", color: "#6B6359", marginBottom: 8,
          }}>
            This corner · {corner.length} photographs{yearSpan(corner) ? ` · ${yearSpan(corner)}` : ""}
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {corner.map((c) => {
              const isCurrent = c.id === photo.id;
              return (
                <button
                  key={c.id}
                  onClick={() => !isCurrent && onOpenPhoto(c)}
                  title={c.year > 0 ? String(c.year) : "date unknown"}
                  style={{
                    flex: "0 0 auto", width: 78, padding: 0, cursor: isCurrent ? "default" : "pointer",
                    background: "transparent", textAlign: "left",
                    border: isCurrent ? "2px solid #1A1814" : "1px solid #D6CDBD",
                    borderRadius: 5, overflow: "hidden", opacity: isCurrent ? 1 : 0.82,
                  }}
                >
                  <div style={{ position: "relative", height: 52, background: "#1A1814" }}>
                    {c.thumb && (
                      <img src={c.thumb} alt="" style={{
                        position: "absolute", inset: 0, width: "100%", height: "100%",
                        objectFit: "cover", display: "block",
                      }} />
                    )}
                    {/* a sibling that already has a modern viewpoint framed */}
                    {c.rephotoEmbedUrl && (
                      <span title="then & now available" style={{
                        position: "absolute", top: 3, right: 3, width: 6, height: 6,
                        borderRadius: "50%", background: "#E9E186", boxShadow: "0 0 0 1.5px rgba(26,24,20,0.5)",
                      }} />
                    )}
                  </div>
                  <div style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 9.5,
                    padding: "3px 5px", color: isCurrent ? "#1A1814" : "#6B6359",
                    background: isCurrent ? "#F1ECE2" : "#fff",
                  }}>{c.year > 0 ? c.year : "—"}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: "14px 18px 0" }}>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
          fontWeight: 500, fontSize: 24, lineHeight: 1.15, letterSpacing: -0.2,
          color: "#1A1814", marginBottom: 10,
        }}>{photo.title}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Pill tone={photo.rights.startsWith("Public") ? "good" : "warn"}>{photo.rights}</Pill>
          {photo.featured && photo.story && <Pill tone="featured">Featured in {photo.story}</Pill>}
        </div>
      </div>

      <div style={{
        padding: "0 18px", display: "grid", gridTemplateColumns: "110px 1fr",
        rowGap: 8, columnGap: 12, fontSize: 13, color: "#3D3833",
      }}>
        <MetaLabel>Date</MetaLabel><MetaValue>{photo.date_display || (dated ? `c. ${photo.year}` : "no legible date stamp")}</MetaValue>
        <MetaLabel>Photographer</MetaLabel><MetaValue>{photo.photographer}</MetaValue>
        <MetaLabel>Address</MetaLabel><MetaValue>{photo.address}</MetaValue>
        <MetaLabel>Neighborhood</MetaLabel><MetaValue>{photo.neighborhood}</MetaValue>
        <MetaLabel>Held at</MetaLabel><MetaValue>{photo.branch}</MetaValue>
      </div>

      {photo.facets && <FacetsBlock photo={photo} />}

      {photo.note && (
        <div style={{
          margin: "18px 18px 0", padding: "14px 16px",
          background: "#FAF6EE", border: "1px solid #EEE6D6",
          borderLeft: "3px solid #1F5963", borderRadius: 6,
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
            color: "#1F5963", marginBottom: 6,
          }}>Librarian&apos;s Note · Brian K.</div>
          <div style={{
            fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
            fontSize: 15, lineHeight: 1.45, color: "#1A1814",
          }}>{photo.note}</div>
        </div>
      )}

      {neighbors.length > 0 && (
        <div style={{ marginTop: 24, padding: "0 18px" }}>
          <div style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
            color: "#6B6359", marginBottom: 10,
          }}>Neighbors in time</div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {neighbors.map((n) => (
              <button key={n.id} onClick={() => onOpenPhoto(n)} style={{
                flexShrink: 0, width: 132, background: "none",
                border: "1px solid #EEE6D6", borderRadius: 8, padding: 0,
                textAlign: "left", cursor: "pointer", overflow: "hidden",
                fontFamily: "'Work Sans', sans-serif",
              }}>
                <div style={{
                  height: 76,
                  background: n.thumb
                    ? `center / cover no-repeat url(${n.thumb})`
                    : "repeating-linear-gradient(135deg, #C8B68F 0 6px, #B8A37A 6px 12px)",
                }} />
                <div style={{ padding: 8 }}>
                  <div style={{
                    fontSize: 12, color: "#1A1814", fontWeight: 500, lineHeight: 1.2,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{n.title}</div>
                  <div style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 10, color: "#A39684", marginTop: 3,
                  }}>{n.year} · {n.neighborhood.split("·")[0].trim()}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{
        margin: "22px 18px 0", padding: "14px 16px",
        background: "#FFFFFF", border: "1px dashed #D6CDBD", borderRadius: 6,
      }}>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
          fontSize: 16, color: "#1A1814", marginBottom: 4,
        }}>Do you remember this corner?</div>
        <div style={{ fontSize: 13, color: "#3D3833", lineHeight: 1.45, marginBottom: 10 }}>
          Tell us what you know — a name, a date, a story. CPL staff review every note.
        </div>
        <button style={{
          padding: "8px 14px", background: "#1A1814", color: "#F6F2EB",
          border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer",
          fontFamily: "'Work Sans', sans-serif",
        }}>Add a memory →</button>
      </div>

      <div style={{ margin: "22px 18px 24px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionLink>Cite</ActionLink>
        <ActionLink>Share</ActionLink>
        <ActionLink>Request a scan</ActionLink>
        <ActionLink>Visit {photo.branch}</ActionLink>
      </div>
    </>
  );
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "#A39684",
    }}>{children}</div>
  );
}
function MetaValue({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#1A1814" }}>{children}</div>;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "good" | "warn" | "featured" }) {
  const tones = {
    good: { bg: "#EAF0EF", fg: "#1F5963", bd: "#CBD9D8" },
    warn: { bg: "#FBEFE2", fg: "#8B5E1F", bd: "#E9D6B4" },
    featured: { bg: "#FBF1DC", fg: "#8B6E1F", bd: "#E9D6A0" },
  };
  const t = tones[tone] || tones.good;
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase",
      padding: "4px 9px", borderRadius: 999,
      background: t.bg, color: t.fg, border: "1px solid " + t.bd,
    }}>{children}</span>
  );
}

// ── Tier 1.5 facets block (convergence slice) ───────────────────
// Renders the AI-extracted facets beside the photo, grouped by axis. Honesty-labeled
// "AI-extracted (staff-reviewable)" — the visible-only contract. scene_text shows the
// transcribed signage verbatim (the payoff the catalog can't surface).
const FL = (s: string) => s.replace(/_/g, " ");

function FacetsBlock({ photo }: { photo: Photo }) {
  const f = photo.facets;
  if (!f) return null;

  // Building summary line (decomposed structure facets).
  const buildingBits = [
    f.building_type && FL(f.building_type),
    f.stories && f.stories !== "unknown" && `${f.stories}-story`,
    f.has_porch && "porch",
    f.roof_form?.length && `${f.roof_form.map(FL).join(" / ")} roof`,
  ].filter(Boolean) as string[];

  const chipGroups: [string, string[]][] = [
    ["Materials", (f.materials ?? []).map(FL)],
    ["Street & ground", (f.street_and_ground ?? []).map(FL)],
    ["Transport", (f.transport ?? []).map(FL)],
    ["Vegetation", (f.vegetation ?? []).map(FL)],
    ["Accessory", (f.accessory_structures ?? []).map(FL)],
    ["Change", (f.condition_and_change ?? []).map(FL)],
    ["People", (f.people_present ?? []).map(FL)],
  ];

  return (
    <div style={{ margin: "20px 18px 0", padding: "14px 16px", background: "#FAF6EE", border: "1px solid #EEE6D6", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 9.5, letterSpacing: 0.6,
          textTransform: "uppercase", color: "#8B6E1F", background: "#FBF1DC", border: "1px solid #E9D6A0",
          padding: "2px 7px", borderRadius: 3,
        }}>AI-extracted · staff-reviewable</span>
      </div>

      {photo.caption && (
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, serif", fontSize: 14.5, lineHeight: 1.45,
          color: "#1A1814", marginBottom: 12, fontStyle: "italic",
        }}>“{photo.caption}”</div>
      )}

      {buildingBits.length > 0 && (
        <FacetRow label="Building">{buildingBits.join(" · ")}</FacetRow>
      )}

      {chipGroups.filter(([, v]) => v.length).map(([label, vals]) => (
        <div key={label} style={{ marginBottom: 8 }}>
          <FacetRowLabel>{label}</FacetRowLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 3 }}>
            {vals.map((v) => <FacetChip key={v}>{v}</FacetChip>)}
          </div>
        </div>
      ))}

      {f.scene_text?.length ? (
        <div style={{ marginTop: 10 }}>
          <FacetRowLabel>Signage in the photo</FacetRowLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            {f.scene_text.map((s, i) => (
              <div key={i} style={{ fontSize: 13.5, color: "#1A1814" }}>
                <span style={{ fontWeight: 600 }}>“{s.text}”</span>
                <span style={{ color: "#A39684", fontSize: 11.5, marginLeft: 6, fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>{FL(s.kind)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <FacetRowLabel>{label}</FacetRowLabel>
      <div style={{ fontSize: 13.5, color: "#1A1814", marginTop: 2 }}>{children}</div>
    </div>
  );
}
function FacetRowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10, letterSpacing: 0.6,
      textTransform: "uppercase", color: "#A39684",
    }}>{children}</div>
  );
}
function FacetChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 12, color: "#1F5963", background: "#EAF0EF", border: "1px solid #CBD9D8",
      padding: "3px 9px", borderRadius: 999,
    }}>{children}</span>
  );
}

function ActionLink({ children }: { children: React.ReactNode }) {
  return (
    <button style={{
      background: "transparent", border: "1px solid #D6CDBD", borderRadius: 999,
      padding: "7px 14px", fontSize: 13, color: "#1A1814", cursor: "pointer",
      fontFamily: "'Work Sans', sans-serif",
    }}>{children}</button>
  );
}

// ── Story panel (Millionaire's Row map-trail) ───────────────────

export function StoryPanel({
  onClose, onOpenPhoto,
}: {
  onClose: () => void;
  onOpenPhoto: (p: Photo) => void;
}) {
  const stops = MILLIONAIRES_ROW;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 40,
        background: "rgba(26,24,20,0.55)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        padding: "64px 32px", overflowY: "auto",
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, 100%)", background: "#F6F2EB",
          border: "1px solid #D6CDBD", borderRadius: 14,
          boxShadow: "0 24px 60px rgba(26,24,20,0.32)", padding: "32px 40px 40px",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
              color: "#A8362B", marginBottom: 6,
            }}>Story of the week · Map trail</div>
            <h1 style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontWeight: 500, fontSize: 40, letterSpacing: -0.6,
              margin: "0 0 12px", color: "#1A1814",
            }}>Millionaire&apos;s Row</h1>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontSize: 18, lineHeight: 1.45, color: "#3D3833", maxWidth: 620,
            }}>
              Between 1880 and 1930, four miles of Euclid Avenue held some of the largest private
              fortunes in the country. By the time anyone thought to save it, almost all of it was gone.
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 24, lineHeight: 1, color: "#6B6359",
          }}>×</button>
        </div>

        <div style={{
          marginTop: 18, paddingTop: 14, borderTop: "1px solid #D6CDBD",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, color: "#6B6359", letterSpacing: 0.4, display: "flex", gap: 18,
        }}>
          <span>Curated by Brian K.</span><span>·</span>
          <span>{stops.length} stops</span><span>·</span><span>1900–1928</span>
        </div>

        <div style={{ marginTop: 28, display: "grid", gap: 16 }}>
          {stops.map((s, i) => (
            <button key={s.id} onClick={() => onOpenPhoto(s)} style={{
              display: "grid", gridTemplateColumns: "36px 120px 1fr",
              gap: 18, alignItems: "center", background: "#FFFFFF",
              border: "1px solid #E6DECC", borderRadius: 10, padding: 12,
              textAlign: "left", cursor: "pointer", fontFamily: "'Work Sans', sans-serif",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C8983A")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E6DECC")}
            >
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 14, color: "#A8362B", textAlign: "center",
              }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{
                width: 120, height: 78,
                background: s.thumb
                  ? `center / cover no-repeat url(${s.thumb}), #1A1814`
                  : "repeating-linear-gradient(135deg, #C8B68F 0 8px, #B8A37A 8px 16px)",
                borderRadius: 6,
              }} />
              <div>
                <div style={{
                  fontFamily: "Spectral, serif", fontWeight: 500,
                  fontSize: 18, color: "#1A1814", marginBottom: 4,
                }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#3D3833", lineHeight: 1.4 }}>
                  {s.note || s.address}
                </div>
                <div style={{
                  marginTop: 6, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 11, color: "#A39684",
                }}>{s.year} · {s.address}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
