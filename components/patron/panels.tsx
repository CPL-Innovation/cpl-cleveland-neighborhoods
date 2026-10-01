"use client";
// Patron overlays: the search panel and the photo detail (drawer · expanded · 3D world). Ported
// from desktop-landing.jsx. The photo pool arrives as props (was window.ALL_PHOTOS). The story
// trail that used to live here is now a full exhibit page (./exhibits.tsx).
import React from "react";
import { thumbUrl, type Photo } from "./data";
import { siblingsOf, yearSpan } from "@/lib/patron-places";
import { autoStreetViewUrl } from "@/lib/rephoto";
import { C, F, T, SHADOW, HATCH } from "./theme";
import { demo3DFor, type Photo3DDemo } from "./demos";

export function SearchIcon({ size = 14, color = C.body }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={color} strokeWidth="1.5" />
      <path d="M9.5 9.5 L13 13" stroke={color} strokeWidth="1.5" />
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
        position: "absolute", inset: 0, zIndex: 50, background: C.scrim,
        display: "flex", justifyContent: "center", paddingTop: 92,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search the collection"
        style={{
          width: 640, background: C.canvas, border: `1px solid ${C.hairMed}`,
          borderTop: `3px solid ${C.navy}`, boxShadow: SHADOW.panel, overflow: "hidden",
          height: "fit-content",
        }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px", borderBottom: `1px solid ${C.hairMed}`,
        }}>
          <SearchIcon size={16} color={C.navy} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Try a place, a year, or an address…"
            aria-label="Search"
            className="dc-bare-input"
            style={{
              flex: 1, border: "none", outline: "none",
              fontFamily: F.serif, fontSize: 19, color: C.ink, background: "transparent",
            }}
          />
          <span style={T.stamp}>ESC</span>
        </div>

        {!q && (
          <div style={{ padding: "16px 18px 18px" }}>
            <div style={{ ...T.sectionLabel, marginBottom: 10 }}>Try</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXEMPLAR_PROMPTS.map((p) => (
                <button key={p} className="dc-tag" onClick={() => onQuery(p)}>{p}</button>
              ))}
            </div>
            <div style={{ ...T.meta, marginTop: 14 }}>
              Matches titles, places, addresses and years — not what&rsquo;s in the picture
            </div>
          </div>
        )}

        {q && results.length === 0 && (
          <div style={{ padding: "28px 18px 26px", textAlign: "center" }}>
            <div style={{ ...T.empty, fontSize: 22 }}>Nothing filed under that — yet.</div>
            <div style={{ ...T.meta, marginTop: 10 }}>Try a neighborhood, a street, or a year</div>
          </div>
        )}

        {q && results.length > 0 && (
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {results.map((p) => (
              <button key={p.id} className="dc-row" onClick={() => onPick(p)} style={{
                display: "flex", alignItems: "baseline", gap: 12, padding: "12px 18px",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0, alignSelf: "center",
                  background: p.featured ? C.marigold : C.navy,
                  boxShadow: p.featured ? `0 0 0 1px ${C.ink}` : undefined,
                }} />
                <span className="dc-row__title" style={{ flex: 1, fontFamily: F.serif, fontSize: 16, fontWeight: 600, color: C.ink }}>{p.title}</span>
                <span style={{ ...T.meta, color: C.secondary }}>{p.neighborhood}</span>
                <span style={{ ...T.stamp, fontSize: 11, minWidth: 34, textAlign: "right" }}>{p.year > 0 ? p.year : "—"}</span>
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
  // The 3D demo (one photograph only — components/patron/demos.ts). The model is a fourth VIEW
  // of the picture, beside then and now; the world is a PLACE you step into, so it takes the
  // whole panel over rather than sharing a pane — a third shell on top of drawer and expanded.
  const demo = demo3DFor(photo);
  const [world, setWorld] = React.useState(false);
  React.useEffect(() => { setWorld(false); }, [photo.id]);
  React.useEffect(() => { if (view === "model" && !demo) setView("then"); }, [view, demo]);
  const vw = useViewportWidth();
  // Below this two image panes side by side are each too narrow to read, so "both" stacks them.
  const stackCompare = vw < 660;

  React.useEffect(() => { if (!rephotoUrl) setView("then"); }, [rephotoUrl, photo.id]);
  // Side-by-side only exists in the expanded shell; collapsing has to land somewhere real.
  React.useEffect(() => { if (!expanded && view === "both") setView("then"); }, [expanded, view]);

  // Esc peels one layer at a time — world → expanded → drawer → closed. The landing has its own
  // window Esc handler that closes the panel outright, so this one listens in the CAPTURE phase
  // and stops the event when there's still a layer to peel.
  React.useEffect(() => {
    if (!expanded && !world) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (world) setWorld(false);
      else setExpanded(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [expanded, world]);

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
      demo={demo}
      onWorld={() => setWorld(true)}
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
      lead={demo ? <WorldEntry demo={demo} onOpen={() => setWorld(true)} /> : null}
    />
  );

  // BackBar-style chrome: what this is on the left, the two ways out on the right.
  const chrome = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      padding: "12px 14px 12px 20px", borderBottom: `1px solid ${C.hairMed}`, flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 9, height: 9, background: C.catPhoto, display: "inline-block" }} />
        <span style={{ fontFamily: F.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: C.secondary }}>
          Photograph
        </span>
        <span style={{ ...T.stamp, fontSize: 10.5, marginLeft: 6 }}>{dated ? photo.year : "DATE UNKNOWN"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          className="dc-btn dc-btn--ghost dc-btn--sm"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Back to the map (esc)" : "Open larger"}
        >
          {expanded ? "Back to the map ←" : "Expand ⤢"}
        </button>
        <button className="dc-close" onClick={onClose} aria-label="Close" title="Close">✕</button>
      </div>
    </div>
  );

  if (world && demo) {
    return <WorldView demo={demo} photo={photo} onBack={() => setWorld(false)} onClose={onClose} />;
  }

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
          background: C.scrim,
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
            background: C.canvas, border: `1px solid ${C.hairMed}`,
            boxShadow: SHADOW.panel, overflow: "hidden",
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
            display: "flex", flexDirection: "column", background: C.sunken,
            borderRight: narrow ? "none" : `1px solid ${C.hairMed}`,
            borderBottom: narrow ? `1px solid ${C.hairMed}` : "none",
          }}>
            {media}
          </div>

          <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", background: C.canvas }}>
            {chrome}
            <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 4 }}>{facts}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 59, background: "rgba(15, 18, 21, 0.18)" }} />
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: 480, zIndex: 60, background: C.canvas,
        borderLeft: `1px solid ${C.hairMed}`, boxShadow: SHADOW.panel,
        display: "flex", flexDirection: "column",
        animation: "patronSlideIn 260ms cubic-bezier(.2,.8,.2,1)",
      }}>
        <style>{`@keyframes patronSlideIn { from { transform: translateX(40px); opacity: 0;} to { transform: translateX(0); opacity:1;} }`}</style>
        {chrome}
        <div ref={railRef} style={{ flex: 1, overflowY: "auto" }}>
          {/* The toggle row now sits *under* the image rather than floating over it (it has three
              segments and an attribution line to carry), so the block is taller than the old 280. */}
          <div style={{ margin: "18px 20px 0", height: 344, display: "flex" }}>{media}</div>
          {facts}
        </div>
      </div>
    </>
  );
}

type PhotoView = "then" | "now" | "both" | "model";

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
  photo, dated, rephotoUrl, framedNow, demo, onWorld, view, onView, expanded, stackCompare, onExpand,
}: {
  photo: Photo;
  dated: boolean;
  rephotoUrl: string | null;
  /** True only when a librarian framed this viewpoint; false for the address-derived default. */
  framedNow: boolean;
  /** The one-off 3D demo, when this is the photograph that has one. */
  demo: Photo3DDemo | null;
  /** Step into the 3D world — it takes the panel over, so it's a button beside the switch, not a view in it. */
  onWorld: () => void;
  view: PhotoView;
  onView: (v: PhotoView) => void;
  expanded: boolean;
  stackCompare: boolean;
  onExpand: () => void;
}) {
  const compare = view === "both";
  const showNow = (view === "now" || compare) && !!rephotoUrl;
  const showThen = view === "then" || compare;
  const showModel = view === "model" && !!demo;

  const frame: React.CSSProperties = {
    position: "relative", overflow: "hidden",
    border: `1px solid ${C.hairMed}`, minHeight: 0, minWidth: 0, flex: 1,
    // Expanded, panes take the landscape shape of the photographs themselves and are centred in
    // whatever room is left. Stretching them to the full height of a tall dialog just grows the
    // black letterbox bars above and below the print — more pane, no more picture. (In the drawer
    // the block is a fixed height, so there they stretch.)
    ...(expanded ? { aspectRatio: "4 / 3", maxHeight: "100%", width: "100%", flex: "0 1 auto" } : null),
  };
  // The print sits on ink so a letterboxed photograph reads as a print, not as a page; no
  // scan yet is the hatched placeholder, never a grey box.
  const thenBg = photo.thumb ? C.ink : HATCH;

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
      {!photo.thumb && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...T.meta }}>
          [ No scan yet ]
        </div>
      )}
      {/* Solo only — in the comparison each pane is captioned above the frame instead. */}
      {!compare && <PaneLabel>{dated ? `Then · ${photo.year}` : "Then"}</PaneLabel>}
    </div>
  );

  const nowPane = rephotoUrl ? (
    <div style={{ ...frame, background: HATCH }}>
      {/* Behind the iframe, and only ever seen through it. The keyless Street View endpoint
          throttles — load a handful of embeds in a couple of minutes and it starts returning a
          blank document, then recovers on its own. Nothing is catchable: the iframe is
          cross-origin, so there is no error, no onError, no failed request. A loaded panorama is
          opaque and hides this; a throttled one leaves the reader looking at a grey rectangle
          with no idea whether the street is gone or the page is broken. Say which. */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, textAlign: "center", pointerEvents: "none",
        fontFamily: F.mono, fontSize: 11, lineHeight: 1.8, letterSpacing: "0.04em", color: C.secondary,
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

  const modelPane = demo ? (
    <div style={{ ...frame, background: C.ink }}>
      <DemoMedia
        kind="video"
        src={demo.modelVideo}
        alt={`3D model of ${photo.address || photo.title}, ${demo.year}`}
        fit="contain"
      />
      <PaneLabel>3D model · {demo.year}</PaneLabel>
    </div>
  ) : null;

  // In the comparison the captions sit ABOVE the frames, not on them: Google's embed parks its own
  // address card in the top-left corner, and an overlay chip lands right on top of it.
  const captioned = (caption: string, pane: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0, minWidth: 0, height: "100%", justifyContent: "center" }}>
      <div style={{ ...T.sectionLabel, fontSize: 10.5, color: C.secondary, flexShrink: 0 }}>{caption}</div>
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
        {showModel && modelPane}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="dc-seg" role="group" aria-label="View">
          {([
            "then",
            ...(rephotoUrl ? (["now", "both"] as const) : []),
            ...(demo ? (["model"] as const) : []),
          ] as PhotoView[]).map((m) => (
            <button key={m} onClick={() => onView(m)} aria-pressed={view === m} title={
              m === "then" ? undefined
                : m === "model" ? "A 3D reconstruction of this corner — demonstration"
                : framedNow ? "Street View, framed by CPL staff to match the photograph"
                : "Street View near this address — not matched to the photograph"
            }>{m === "both" ? "Side by side" : m === "then" ? "Then" : m === "now" ? "Now" : "3D model"}</button>
          ))}
        </div>

        {demo && (
          <button
            className="dc-btn dc-btn--primary"
            onClick={onWorld}
            title={`Step into a 3D world of ${demo.place} in ${demo.year}`}
            style={{ height: 34, padding: "0 14px", boxSizing: "border-box", letterSpacing: "0.1em" }}
          >
            3D world ⤢
          </button>
        )}

        {/* The old "scroll to zoom" was a promise nothing kept. Expand is the real one. */}
        {!expanded && !showModel && (
          <button className="dc-link" onClick={onExpand}>
            {rephotoUrl ? (framedNow ? "Expand to compare ⤢" : "See the street today ⤢") : "Expand the photograph ⤢"}
          </button>
        )}

        {/* Whose image is this? The archival print is CPL's; the "now" is Google's, and the
            viewpoint is a librarian's judgement about where the photographer stood. Say so —
            the same contract the AI-extracted label keeps elsewhere in this panel. */}
        {showModel && demo && (
          <div style={{ flex: "1 1 260px", minWidth: 200 }}>
            <a className="dc-link" href={demo.modelUrl} target="_blank" rel="noopener noreferrer">
              Turn the model in {demo.modelHost} ↗
            </a>
            <div style={{ ...T.meta, fontSize: 10, lineHeight: 1.6, color: C.infoInk, marginTop: 6 }}>
              ✦ {demo.credit}
            </div>
          </div>
        )}

        {showNow && (
          <div style={{
            flex: "1 1 260px", minWidth: 200,
            ...T.meta, fontSize: 10, lineHeight: 1.6, color: C.infoInk,
          }}>
            Imagery &copy; Google Street View
            {framedNow
              ? " · viewpoint matched by CPL staff"
              : " · viewpoint not matched — placed automatically from the address"}
            {framedNow && photo.rephotoBearing != null
              ? ` · facing ${Math.round(((photo.rephotoBearing % 360) + 360) % 360)}°`
              : ""}
            <div style={{ fontFamily: F.serif, fontSize: 13, lineHeight: 1.5, letterSpacing: 0, textTransform: "none", fontStyle: "italic", color: C.secondary, marginTop: 4 }}>
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
      position: "absolute", top: 0, left: 0,
      fontFamily: F.mono, fontSize: 10, fontWeight: 700, color: C.onNavy, background: C.navy,
      padding: "4px 8px", letterSpacing: "0.1em", textTransform: "uppercase",
      pointerEvents: "none",
    }}>{children}</div>
  );
}

// ── The 3D demo: the world's door, the world, and media that admit they're missing ────

/** The way into the walkable world — a card, not a fifth toggle: it leaves the picture. */
function WorldEntry({ demo, onOpen }: { demo: Photo3DDemo; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="dc-story"
      style={{
        display: "grid", gridTemplateColumns: "112px 1fr", gap: 14, alignItems: "center",
        width: "100%", marginTop: 16, padding: 10, textAlign: "left", cursor: "pointer",
        background: C.canvas, border: `1px solid ${C.hairMed}`, borderTop: `3px solid ${C.marigold}`,
      }}
    >
      <div style={{ position: "relative", height: 72, background: C.ink, overflow: "hidden" }}>
        <DemoMedia kind="image" src={demo.worldImage} alt="" fit="cover" compact />
      </div>
      <div>
        <div style={{ ...T.kicker, fontSize: 10 }}>This corner in 3D</div>
        <div className="dc-row__title" style={{ ...T.cardTitle, fontSize: 17, marginTop: 4 }}>
          Walk {demo.place} in {demo.year}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <span className="dc-link">Step into the street ⤢</span>
          <span style={T.stamp}>DEMO</span>
        </div>
      </div>
    </button>
  );
}

/** The world takes the whole panel over: just the image, a thin bar, two ways back. */
function WorldView({ demo, photo, onBack, onClose }: { demo: Photo3DDemo; photo: Photo; onBack: () => void; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 59, background: C.scrim }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Explore ${demo.place} in ${demo.year}, in 3D`}
        style={{
          position: "absolute", zIndex: 60, top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(1800px, 96%)", height: "min(1100px, 94%)",
          background: C.ink, boxShadow: SHADOW.panel, display: "flex", flexDirection: "column",
          animation: "patronWorldIn 220ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        <style>{`@keyframes patronWorldIn { from { transform: translate(-50%,-50%) scale(.98); opacity: 0;} to { transform: translate(-50%,-50%) scale(1); opacity: 1;} }`}</style>
        <div style={{
          display: "flex", alignItems: "center", gap: 16, padding: "10px 12px 10px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.14)", flexShrink: 0,
        }}>
          <span style={{
            fontFamily: F.sans, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
            color: C.onNavy, borderBottom: `3px solid ${C.marigold}`, paddingBottom: 3,
          }}>Explore in 3D</span>
          <span style={{ fontFamily: F.serif, fontSize: 19, fontWeight: 700, color: C.onNavy }}>
            {demo.place}, <em>{demo.year}</em>
          </span>
          <span style={{ ...T.stamp, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {photo.address || photo.title}
          </span>
          <div style={{ flex: 1 }} />
          <a
            className="dc-btn dc-btn--sm dc-btn--primary"
            href={demo.worldUrl} target="_blank" rel="noopener noreferrer"
          >
            Walk it in {demo.worldHost} ↗
          </a>
          <button className="dc-btn dc-btn--sm" onClick={onBack} style={{ background: "transparent", color: C.onNavy, borderColor: "rgba(255,255,255,0.4)" }}>
            Back to the photograph ←
          </button>
          <button className="dc-close" onClick={onClose} aria-label="Close" style={{ color: C.onNavy }}>✕</button>
        </div>
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          {/* The still is a window onto the real thing — clicking it goes there too. */}
          <a
            href={demo.worldUrl} target="_blank" rel="noopener noreferrer"
            title={`Open the walkable world in ${demo.worldHost} (new tab)`}
            style={{ position: "absolute", inset: 0, display: "block", cursor: "pointer" }}
          >
            <DemoMedia kind="image" src={demo.worldImage} alt={`A view inside the 3D world of ${demo.place}, ${demo.year}`} fit="contain" />
          </a>
          <div style={{
            position: "absolute", left: 0, bottom: 0, padding: "6px 10px",
            background: C.marigold, color: C.onMarigold,
            fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
          }}>
            Preview · a still from the walkable world — {demo.worldCredit} · click to walk it ↗
          </div>
        </div>
      </div>
    </>
  );
}

/** A demo video or image that, when its file hasn't been dropped in yet, says so — and where. */
function DemoMedia({ kind, src, alt, fit, compact }: {
  kind: "video" | "image"; src: string; alt: string; fit: "contain" | "cover"; compact?: boolean;
}) {
  const [missing, setMissing] = React.useState(false);
  React.useEffect(() => { setMissing(false); }, [src]);
  const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, display: "block" };
  if (missing) {
    return (
      <div style={{
        ...fill, boxSizing: "border-box", background: HATCH, display: "flex", alignItems: "center", justifyContent: "center",
        padding: compact ? 4 : 24, textAlign: "center", ...T.stamp, fontSize: compact ? 8.5 : 10.5, color: C.secondary,
      }}>
        {compact ? "[ preview ]" : <>[ {kind === "video" ? "3D model video" : "3D world image"} not added yet — public{src} ]</>}
      </div>
    );
  }
  return kind === "video" ? (
    <video
      src={src} aria-label={alt} style={fill}
      autoPlay muted loop playsInline controls preload="metadata"
      onError={() => setMissing(true)}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} style={fill} onError={() => setMissing(true)} />
  );
}

// ── Everything under the image: the corner sequence, the facts, the asks ────

function PhotoFacts({
  photo, corner, hasSequence, neighbors, dated, onOpenPhoto, lead,
}: {
  photo: Photo;
  corner: Photo[];
  hasSequence: boolean;
  neighbors: Photo[];
  dated: boolean;
  onOpenPhoto: (p: Photo) => void;
  /** Rendered first, directly under the image — the 3D world's door, when there is one. */
  lead?: React.ReactNode;
}) {
  const facts: [string, React.ReactNode][] = [
    ["Date", photo.date_display || (dated ? `c. ${photo.year}` : "No legible date stamp")],
    ["Photographer", photo.photographer],
    ["Address", photo.address],
    ["Neighborhood", photo.neighborhood],
    ["Held at", photo.branch],
    ["Rights", photo.rights],
  ];
  return (
    <div style={{ padding: "0 20px 28px" }}>
      {lead}
      {hasSequence && (
        <div style={{ marginTop: 18 }}>
          <SectionHead
            label="This corner"
            note={`${corner.length} photographs${yearSpan(corner) ? ` · ${yearSpan(corner)}` : ""}`}
          />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, paddingTop: 10 }}>
            {corner.map((c) => {
              const isCurrent = c.id === photo.id;
              return (
                <button
                  key={c.id}
                  className="dc-tile"
                  aria-current={isCurrent}
                  onClick={() => !isCurrent && onOpenPhoto(c)}
                  title={c.year > 0 ? String(c.year) : "date unknown"}
                  style={{ flex: "0 0 auto", width: 76, cursor: isCurrent ? "default" : "pointer" }}
                >
                  <div className="dc-tile__frame" style={{
                    position: "relative", height: 52, background: c.thumb ? C.ink : HATCH,
                    borderTopColor: isCurrent ? C.navy : C.hairMed,
                  }}>
                    {c.thumb && (
                      <img src={thumbUrl(c.thumb, 256)} alt="" loading="lazy" style={{
                        position: "absolute", inset: 0, width: "100%", height: "100%",
                        objectFit: "cover", display: "block", opacity: isCurrent ? 1 : 0.85,
                      }} />
                    )}
                    {/* a sibling that already has a modern viewpoint framed */}
                    {c.rephotoEmbedUrl && (
                      <span title="then & now available" style={{
                        position: "absolute", top: 3, right: 3, width: 7, height: 7,
                        background: C.marigold, boxShadow: `0 0 0 1px ${C.ink}`,
                      }} />
                    )}
                  </div>
                  <div style={{
                    ...T.stamp, fontSize: 10, padding: "3px 1px 0",
                    color: isCurrent ? C.navy : C.tertiary, fontWeight: isCurrent ? 700 : 400,
                  }}>{c.year > 0 ? c.year : "—"}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <h2 style={{ ...T.detailTitle, fontSize: 28, margin: "20px 0 0" } as React.CSSProperties}>{photo.title}</h2>
      {photo.featured && photo.story && (
        <div style={{ marginTop: 10 }}>
          <span style={{ ...T.kicker, fontSize: 10.5, display: "inline-block", borderBottom: `3px solid ${C.marigold}`, paddingBottom: 3 }}>
            Featured in {photo.story}
          </span>
        </div>
      )}

      {/* FactsTable — a ledger: body-coloured rule on top, hairline under each row, only the
          facts we have. */}
      <dl style={{ margin: "18px 0 0", borderTop: `1px solid ${C.body}` }}>
        {facts.filter(([, v]) => v != null && v !== "" && v !== "—").map(([k, v]) => (
          <div key={k} style={{
            display: "grid", gridTemplateColumns: "112px 1fr", gap: 14,
            padding: "9px 0", borderBottom: `1px solid ${C.hairMed}`,
          }}>
            <dt style={{ ...T.meta, color: C.tertiary, paddingTop: 2 }}>{k}</dt>
            <dd style={{ margin: 0, fontFamily: F.serif, fontSize: 15, lineHeight: 1.45, color: C.body }}>{v}</dd>
          </div>
        ))}
      </dl>

      {photo.facets && <FacetsBlock photo={photo} />}

      {photo.note && (
        <div style={{
          marginTop: 22, padding: "11px 13px 12px",
          background: C.sunken, borderLeft: `3px solid ${C.navy}`,
        }}>
          <div style={{ ...T.fine, fontSize: 9.5, letterSpacing: "0.1em", color: C.navy, marginBottom: 6 }}>
            Librarian&apos;s note · Brian K.
          </div>
          <div style={{ fontFamily: F.serif, fontSize: 15.5, lineHeight: 1.55, color: C.body }}>{photo.note}</div>
        </div>
      )}

      {neighbors.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <SectionHead label="Neighbors in time" note="Nearby · within 8 years" />
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingTop: 10, paddingBottom: 4 }}>
            {neighbors.map((n) => (
              <button key={n.id} className="dc-tile" onClick={() => onOpenPhoto(n)} style={{ flexShrink: 0, width: 132 }}>
                <div className="dc-tile__frame" style={{
                  height: 76,
                  background: n.thumb ? `center / cover no-repeat url(${thumbUrl(n.thumb, 256)}), ${C.sunken}` : HATCH,
                }} />
                <div className="dc-tile__title" style={{
                  fontFamily: F.serif, fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: 1.2, marginTop: 6,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{n.title}</div>
                <div style={{ ...T.stamp, marginTop: 3 }}>
                  {n.year} · {n.neighborhood.split("·")[0].trim().toUpperCase()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 26, padding: "16px 18px 18px", border: `1px solid ${C.hairMed}` }}>
        <div style={{ fontFamily: F.serif, fontSize: 19, fontWeight: 700, color: C.ink }}>Do you remember this corner?</div>
        <div style={{ ...T.snippet, fontSize: 14.5, marginTop: 4, marginBottom: 14 }}>
          Tell us what you know — a name, a date, a story. CPL staff review every note before it appears here.
        </div>
        <button className="dc-btn dc-btn--primary">Add a memory →</button>
      </div>

      <div style={{ marginTop: 22, display: "flex", gap: 18, flexWrap: "wrap", rowGap: 10 }}>
        <button className="dc-link">Cite ⤢</button>
        <button className="dc-link">Share ↗</button>
        <button className="dc-link">Request a scan →</button>
        <button className="dc-link">Visit {photo.branch} ↗</button>
      </div>
    </div>
  );
}

/** A small section label with a mono note, over a 1px body-coloured rule (FacetRail's group head). */
function SectionHead({ label, note }: { label: string; note?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 10,
      borderBottom: `1px solid ${C.body}`, paddingBottom: 6,
    }}>
      <span style={T.groupLabel}>{label}</span>
      {note && <span style={{ ...T.stamp, letterSpacing: "0.06em", textTransform: "uppercase" }}>{note}</span>}
    </div>
  );
}

// ── Tier 1.5 facets block (convergence slice) ───────────────────
// Renders the AI-extracted facets beside the photo, grouped by axis, closed by a HonestyNote
// — the visible-only contract: method · review state · epistemic status, in the info ink.
// scene_text shows the transcribed signage verbatim (the payoff the catalog can't surface).
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
    <div style={{ marginTop: 26 }}>
      <SectionHead label="What's in the picture" note="✦ AI-extracted" />

      {photo.caption && (
        <div style={{ ...T.dek, fontSize: 16, color: C.body, marginTop: 12 }}>{photo.caption}</div>
      )}

      {buildingBits.length > 0 && (
        <FacetRow label="Building">
          <span style={{ fontFamily: F.serif, fontSize: 15, color: C.body }}>{buildingBits.join(" · ")}</span>
        </FacetRow>
      )}

      {chipGroups.filter(([, v]) => v.length).map(([label, vals]) => (
        <FacetRow key={label} label={label}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {vals.map((v) => <span key={v} className="dc-tag">{v}</span>)}
          </div>
        </FacetRow>
      ))}

      {f.scene_text?.length ? (
        <FacetRow label="Signage">
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {f.scene_text.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: F.serif, fontSize: 15, fontWeight: 600, color: C.ink, background: C.marigoldMark, padding: "0 3px" }}>
                  “{s.text}”
                </span>
                <span style={T.stamp}>{FL(s.kind).toUpperCase()}</span>
              </div>
            ))}
          </div>
        </FacetRow>
      ) : null}

      <div style={{
        marginTop: 14, padding: "10px 12px", border: `1px solid ${C.hairMed}`,
        ...T.meta, lineHeight: 1.7, color: C.infoInk,
      }}>
        Attributes machine-extracted · curator-reviewable · not catalog fact
      </div>
    </div>
  );
}

function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "112px 1fr", gap: 14, alignItems: "baseline",
      padding: "9px 0", borderBottom: `1px solid ${C.hairLight}`,
    }}>
      <div style={T.meta}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
