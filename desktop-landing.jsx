// DesktopLanding — interactive landing. Map hero with overlays:
// header (wordmark + nav + search), time-range filter (draggable),
// geolocation pill, zoom controls, story-of-the-week card, density legend,
// onboarding whisper. Clicking a dot opens the photo detail panel.

const MIN_YEAR = 1880;
const MAX_YEAR = 2020;
// Public Square — used as the synthetic "near you" point for the demo.
const NEAR_YOU = { x: 484, y: 376, label: 'Public Square' };

function DesktopLanding() {
  // ── State ───────────────────────────────────────────────────
  const [yearRange, setYearRange] = React.useState([1880, 2025]);
  const [hoveredId, setHoveredId] = React.useState(null);
  const [selected, setSelected] = React.useState(null);   // photo or null
  const [zoom, setZoom] = React.useState(1);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [nearYouActive, setNearYouActive] = React.useState(false);
  const [storyOpen, setStoryOpen] = React.useState(false);
  const [whisperOpen, setWhisperOpen] = React.useState(true);

  // ── Map sizing ──────────────────────────────────────────────
  const mapRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 1280, h: 780 });
  React.useLayoutEffect(() => {
    const el = mapRef.current;
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

  // ── Derived counts ──────────────────────────────────────────
  const allPhotos = (typeof window !== 'undefined' && window.ALL_PHOTOS) || [];
  const visibleCount = allPhotos.filter((p) => p.year >= yearRange[0] && p.year <= yearRange[1]).length;
  const totalCount = allPhotos.length;

  // ── Keyboard ────────────────────────────────────────────────
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (selected) setSelected(null);
        else if (storyOpen) setStoryOpen(false);
        else if (searchOpen) setSearchOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, storyOpen, searchOpen]);

  // ── Map controls ────────────────────────────────────────────
  const zoomIn = () => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)));
  const resetView = () => { setZoom(1); setYearRange([1880, 2020]); setNearYouActive(false); };

  // ── Pan offset to keep the map centered when zoomed ─────────
  // viewBox is 1200×700. Zooming around the centre: pan = (1 - zoom) * centre.
  const pan = { x: (1 - zoom) * 600, y: (1 - zoom) * 350 };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#F6F2EB',
      color: '#1A1814',
      fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      WebkitFontSmoothing: 'antialiased',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <DesktopHeader onSearchClick={() => setSearchOpen(true)} />
      <div ref={mapRef} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <ClevelandMap
          width={size.w}
          height={size.h}
          yearRange={yearRange}
          hoveredId={hoveredId}
          selectedId={selected ? selected.id : null}
          onDotHover={setHoveredId}
          onDotClick={(p) => setSelected(p)}
          zoom={zoom}
          pan={pan}
          nearYou={nearYouActive ? NEAR_YOU : null}
        />

        <GeolocationPill active={nearYouActive} onToggle={() => setNearYouActive((v) => !v)} />
        <TimeRangeFilter value={yearRange} onChange={setYearRange}
                         visibleCount={visibleCount} totalCount={totalCount} />
        <MapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetView} />
        <StoryOfTheWeek onOpen={() => setStoryOpen(true)} />
        <DensityLegend />
        <AttributionPill visibleCount={visibleCount} totalCount={totalCount} yearRange={yearRange} />

        {whisperOpen && (
          <OnboardingWhisper onDismiss={() => setWhisperOpen(false)} />
        )}
      </div>

      {searchOpen && (
        <SearchPanel
          query={searchQuery}
          onQuery={setSearchQuery}
          onClose={() => setSearchOpen(false)}
          onPick={(p) => { setSelected(p); setSearchOpen(false); }}
        />
      )}

      {selected && (
        <PhotoDetailPanel
          photo={selected}
          onClose={() => setSelected(null)}
          onOpenPhoto={(p) => setSelected(p)}
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

function DesktopHeader({ onSearchClick }) {
  return (
    <div style={{
      height: 72,
      borderBottom: '1px solid #D6CDBD',
      display: 'flex',
      alignItems: 'center',
      padding: '0 32px',
      gap: 32,
      background: 'rgba(246,242,235,0.92)',
      backdropFilter: 'blur(6px)',
      zIndex: 5,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
          fontWeight: 460,
          fontSize: 24,
          letterSpacing: -0.4,
          lineHeight: 1,
          color: '#1A1814',
        }}>
          Cleveland&nbsp;Neighborhoods
        </div>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, serif",
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 12.5,
          letterSpacing: 0.1,
          lineHeight: 1,
          color: '#6B6359',
        }}>
          A century of Cleveland, mapped to the corner.
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <nav style={{
        display: 'flex', gap: 28, fontSize: 14, letterSpacing: 0.1, color: '#1A1814',
      }}>
        <NavLink>Stories</NavLink>
        <NavLink>Browse</NavLink>
        <NavLink>About</NavLink>
      </nav>
      <div style={{ width: 1, height: 22, background: '#D6CDBD', marginLeft: 4 }} />
      <button
        onClick={onSearchClick}
        style={{
          height: 36, padding: '0 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent',
          border: '1px solid #D6CDBD',
          borderRadius: 18,
          color: '#1A1814',
          fontSize: 13,
          fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          cursor: 'pointer',
        }}>
        <SearchIcon />
        <span style={{ color: '#6B6359' }}>Search the collection</span>
        <span style={{
          marginLeft: 14,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11,
          color: '#A39684',
          letterSpacing: 0,
        }}>⌘ K</span>
      </button>
    </div>
  );
}

function NavLink({ children, active }) {
  const [hov, setHov] = React.useState(false);
  return (
    <a
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        color: active ? '#1A1814' : '#3D3833',
        textDecoration: 'none',
        fontWeight: 500,
        padding: '6px 0',
        borderBottom: (active || hov) ? '1.5px solid #1F5963' : '1.5px solid transparent',
        cursor: 'pointer',
        transition: 'border-color 120ms',
      }}>{children}</a>
  );
}

function SearchIcon({ size = 14, color = '#3D3833' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={color} strokeWidth="1.4" />
      <path d="M9.5 9.5 L13 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Geolocation pill ────────────────────────────────────────────

function GeolocationPill({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'absolute', top: 24, right: 24, zIndex: 4,
        display: 'flex', alignItems: 'center', gap: 8,
        height: 40, padding: '0 16px 0 14px',
        background: active ? '#1F5963' : '#FFFFFF',
        color: active ? '#F6F2EB' : '#1A1814',
        border: '1px solid ' + (active ? '#1F5963' : '#D6CDBD'),
        borderRadius: 999,
        boxShadow: '0 2px 12px rgba(26,24,20,0.06)',
        fontSize: 13.5,
        cursor: 'pointer',
        fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
      <LocationGlyph color={active ? '#F6F2EB' : '#A8362B'} />
      <span>{active ? `Near you · ${NEAR_YOU.label}` : 'Photos near you'}</span>
    </button>
  );
}

function LocationGlyph({ color = '#A8362B' }) {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
      <path d="M7 1c-3.3 0-6 2.6-6 5.8 0 4.4 6 8.7 6 8.7s6-4.3 6-8.7C13 3.6 10.3 1 7 1z"
        fill={color} stroke="#1A1814" strokeOpacity="0.2" strokeWidth="0.6" />
      <circle cx="7" cy="6.6" r="2" fill="#fff" />
    </svg>
  );
}

// ── Time-range filter (draggable) ───────────────────────────────

function TimeRangeFilter({ value, onChange, visibleCount, totalCount }) {
  const [lo, hi] = value;
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(null); // 'lo' | 'hi' | null

  const decades = [1880, 1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
  const labelDecades = [1880, 1900, 1920, 1940, 1960, 1980, 2000, 2020];
  const pct = (y) => ((y - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const track = trackRef.current;
      if (!track) return;
      const r = track.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
      const yr = Math.round(MIN_YEAR + (x / r.width) * (MAX_YEAR - MIN_YEAR));
      if (dragging === 'lo') {
        onChange([Math.min(yr, hi - 1), hi]);
      } else {
        onChange([lo, Math.max(yr, lo + 1)]);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, lo, hi, onChange]);

  return (
    <div style={{
      position: 'absolute', top: 24, left: 24, zIndex: 4,
      width: 460, padding: '14px 22px 14px',
      background: '#FFFFFF',
      border: '1px solid #D6CDBD',
      borderRadius: 12,
      boxShadow: '0 2px 12px rgba(26,24,20,0.06)',
      userSelect: 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase',
          color: '#6B6359',
        }}>Time range</div>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
          fontSize: 16, fontWeight: 600, color: '#1A1814', letterSpacing: 0.2,
        }}>
          {lo} — {hi}
        </div>
      </div>

      <div ref={trackRef} style={{ position: 'relative', height: 30 }}>
        <div style={{
          position: 'absolute', top: 13, left: 0, right: 0, height: 1.5,
          background: '#D6CDBD', borderRadius: 1,
        }} />
        <div style={{
          position: 'absolute', top: 12, left: `${pct(lo)}%`,
          width: `${pct(hi) - pct(lo)}%`,
          height: 3, background: '#1F5963', borderRadius: 2,
        }} />

        {/* Left handle */}
        <div
          onMouseDown={(e) => { e.preventDefault(); setDragging('lo'); }}
          style={{
            position: 'absolute', top: 5, left: `${pct(lo)}%`,
            transform: 'translateX(-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: '#FFFFFF',
            border: '2px solid #1F5963',
            boxShadow: '0 1px 4px rgba(26,24,20,0.18)',
            cursor: 'ew-resize',
          }} />

        {/* Right handle */}
        <div
          onMouseDown={(e) => { e.preventDefault(); setDragging('hi'); }}
          style={{
            position: 'absolute', top: 5, left: `${pct(hi)}%`,
            transform: 'translateX(-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: '#FFFFFF',
            border: '2px solid #1F5963',
            boxShadow: '0 1px 4px rgba(26,24,20,0.18)',
            cursor: 'ew-resize',
          }} />

        {decades.map((d) => {
          const x = pct(d);
          const isLabel = labelDecades.includes(d);
          return (
            <div key={d} style={{
              position: 'absolute',
              left: `${x}%`, top: 21,
              width: 1, height: isLabel ? 5 : 3,
              background: '#1A1814',
              opacity: isLabel ? 0.55 : 0.3,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }} />
          );
        })}
      </div>

      <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
        {labelDecades.map((d) => {
          const x = pct(d);
          const yy = String(d).slice(-2);
          return (
            <div key={d} style={{
              position: 'absolute',
              left: `${x}%`,
              transform: 'translateX(-50%)',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10.5,
              color: '#A39684',
              letterSpacing: 0.2,
              lineHeight: 1,
            }}>’{yy}</div>
          );
        })}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginTop: 10, fontSize: 12, color: '#3D3833',
      }}>
        <div>
          <span style={{
            fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
            fontWeight: 600, color: '#1A1814',
          }}>{visibleCount}</span>
          <span style={{ color: '#6B6359' }}> photographs visible</span>
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, color: '#A39684', letterSpacing: 0.2,
        }}>{totalCount} total in collection</div>
      </div>
    </div>
  );
}

// ── Map controls ────────────────────────────────────────────────

function MapControls({ onZoomIn, onZoomOut, onReset }) {
  const btn = (children, onClick, last) => (
    <button
      onClick={onClick}
      style={{
        width: 40, height: 40,
        background: '#FFFFFF',
        border: 'none',
        borderBottom: last ? 'none' : '1px solid #EEE6D6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#1A1814',
      }}>{children}</button>
  );
  return (
    <div style={{
      position: 'absolute', bottom: 28, right: 24, zIndex: 4,
      width: 40, borderRadius: 10, overflow: 'hidden',
      border: '1px solid #D6CDBD',
      boxShadow: '0 2px 12px rgba(26,24,20,0.06)',
    }}>
      {btn(<PlusIcon />, onZoomIn)}
      {btn(<MinusIcon />, onZoomOut)}
      {btn(<ResetIcon />, onReset, true)}
    </div>
  );
}
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="#1A1814" strokeWidth="1.6" strokeLinecap="round"/></svg>; }
function MinusIcon() { return <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7h12" stroke="#1A1814" strokeWidth="1.6" strokeLinecap="round"/></svg>; }
function ResetIcon() { return <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 7a4.5 4.5 0 1 1 1.3 3.2" stroke="#1A1814" strokeWidth="1.4" fill="none" strokeLinecap="round"/><path d="M2 4v3h3" stroke="#1A1814" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

// ── Story of the Week card ──────────────────────────────────────

function StoryOfTheWeek({ onOpen }) {
  return (
    <div
      onClick={onOpen}
      style={{
        position: 'absolute', bottom: 28, left: 24, zIndex: 4,
        width: 312,
        background: '#FFFFFF',
        border: '1px solid #D6CDBD',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(26,24,20,0.06)',
        cursor: 'pointer',
        transition: 'transform 120ms, box-shadow 120ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(26,24,20,0.14)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,24,20,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        height: 132,
        background: 'repeating-linear-gradient(135deg, #C8B68F 0 8px, #B8A37A 8px 16px)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(26,24,20,0) 40%, rgba(26,24,20,0.55) 100%)',
        }} />
        <div style={{
          position: 'absolute', top: 10, left: 12,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
          color: '#fff', opacity: 0.92,
          background: 'rgba(26,24,20,0.55)',
          padding: '4px 8px', borderRadius: 3,
        }}>Story of the week</div>
        <div style={{
          position: 'absolute', bottom: 8, right: 10,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, color: '#fff', opacity: 0.85,
        }}>[ archival photo ]</div>
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
          fontWeight: 500, fontSize: 20, lineHeight: 1.15, letterSpacing: -0.2,
          color: '#1A1814', marginBottom: 6,
        }}>Millionaire's Row</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: '#3D3833', marginBottom: 12 }}>
          The mansions Euclid Avenue lost — and the photographs that remember them.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#1F5963', fontSize: 13, fontWeight: 500 }}>Read story →</span>
          <span style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, color: '#A39684',
          }}>11 photos · 1900–1928</span>
        </div>
      </div>
    </div>
  );
}

// ── Density legend ──────────────────────────────────────────────

function DensityLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: 28, left: 360, zIndex: 4,
      padding: '10px 14px',
      background: 'rgba(255,255,255,0.86)',
      border: '1px solid #D6CDBD',
      borderRadius: 10,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 11, color: '#6B6359',
      display: 'flex', alignItems: 'center', gap: 10,
      letterSpacing: 0.4, textTransform: 'uppercase',
    }}>
      <span>1 dot = 1 photo</span>
      <span style={{ color: '#D6CDBD' }}>·</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8983A', display: 'inline-block' }} />
        featured
      </span>
      <span style={{ color: '#D6CDBD' }}>·</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#A8362B', display: 'inline-block' }} />
        photo
      </span>
    </div>
  );
}

function AttributionPill({ visibleCount, totalCount, yearRange }) {
  return (
    <div style={{
      position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 3,
      padding: '7px 14px',
      background: 'rgba(255,255,255,0.86)',
      border: '1px solid #D6CDBD',
      borderRadius: 999,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 11, color: '#6B6359', letterSpacing: 0.4,
      textTransform: 'uppercase',
      pointerEvents: 'none',
    }}>
      Showing {visibleCount} of {totalCount} photographs · {yearRange[0]}–{yearRange[1]}
    </div>
  );
}

// ── Onboarding whisper (dismissable) ────────────────────────────

function OnboardingWhisper({ onDismiss }) {
  return (
    <div style={{
      position: 'absolute', bottom: 28, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 4,
      padding: '10px 14px 10px 14px',
      background: 'rgba(26,24,20,0.88)',
      color: '#F6F2EB',
      borderRadius: 10,
      fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 12,
      maxWidth: 480,
      boxShadow: '0 4px 18px rgba(26,24,20,0.22)',
    }}>
      <span style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
        color: '#C8983A',
      }}>30 sec</span>
      <span style={{ flex: 1, lineHeight: 1.35 }}>
        Drag the time slider. Click a dot. Find your street.
      </span>
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', color: '#F6F2EB', opacity: 0.7,
        fontSize: 18, lineHeight: 1, padding: 0, cursor: 'pointer',
      }}>×</button>
    </div>
  );
}

// ── Search panel (inline expand) ────────────────────────────────

const EXEMPLAR_PROMPTS = [
  'Public Square 1930',
  'West Side Market',
  "Millionaire's Row",
  'Detroit Ave streetcar',
  '1234 Detroit Ave.',
];

function SearchPanel({ query, onQuery, onClose, onPick }) {
  const inputRef = React.useRef(null);
  React.useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const all = (typeof window !== 'undefined' && window.ALL_PHOTOS) || [];
  const q = query.trim().toLowerCase();
  const results = q
    ? all.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.neighborhood || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q) ||
        String(p.year).includes(q)
      ).slice(0, 8)
    : [];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(26,24,20,0.32)',
        display: 'flex', justifyContent: 'center',
        paddingTop: 92,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          background: '#FFFFFF',
          border: '1px solid #D6CDBD',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(26,24,20,0.22)',
          overflow: 'hidden',
        }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderBottom: '1px solid #EEE6D6',
        }}>
          <SearchIcon size={16} color="#6B6359" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Try a place, year, or address…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontFamily: "'Work Sans', sans-serif",
              fontSize: 16, color: '#1A1814',
              background: 'transparent',
            }}
          />
          <span style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, color: '#A39684',
          }}>esc</span>
        </div>

        {!q && (
          <div style={{ padding: '14px 18px' }}>
            <div style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
              color: '#A39684', marginBottom: 10,
            }}>Try</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EXEMPLAR_PROMPTS.map((p) => (
                <button key={p} onClick={() => onQuery(p)} style={{
                  background: '#F6F2EB',
                  border: '1px solid #E6DECC',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 13, color: '#3D3833',
                  cursor: 'pointer',
                  fontFamily: "'Work Sans', sans-serif",
                }}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {q && results.length === 0 && (
          <div style={{ padding: '24px 18px', color: '#6B6359', fontSize: 14 }}>
            No matches. Try a neighborhood or a year.
          </div>
        )}

        {q && results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.map((p) => (
              <button key={p.id} onClick={() => onPick(p)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', textAlign: 'left',
                padding: '10px 18px',
                background: 'transparent', border: 'none',
                borderBottom: '1px solid #F0EADC',
                cursor: 'pointer',
                fontFamily: "'Work Sans', sans-serif",
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#FAF6EE'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: p.featured ? '#C8983A' : '#A8362B',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, color: '#1A1814', fontSize: 14 }}>{p.title}</span>
                <span style={{ color: '#6B6359', fontSize: 12 }}>{p.neighborhood}</span>
                <span style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 12, color: '#A39684',
                }}>{p.year}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Photo detail panel (slides in from right) ───────────────────

function PhotoDetailPanel({ photo, onClose, onOpenPhoto }) {
  const all = (typeof window !== 'undefined' && window.ALL_PHOTOS) || [];

  // Neighbors-in-time: within ±60 viewBox units AND ±5 years.
  const neighbors = all.filter((p) =>
    p.id !== photo.id &&
    Math.hypot(p.x - photo.x, p.y - photo.y) < 80 &&
    Math.abs(p.year - photo.year) <= 8
  ).slice(0, 5);

  const [view, setView] = React.useState('then'); // 'then' | 'now'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(26,24,20,0.18)',
        }} />
      {/* Panel */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 480, zIndex: 31,
        background: '#FFFFFF',
        borderLeft: '1px solid #D6CDBD',
        boxShadow: '-10px 0 40px rgba(26,24,20,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 260ms cubic-bezier(.2,.8,.2,1)',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity: 0;} to { transform: translateX(0); opacity:1;} }`}</style>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid #EEE6D6',
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase',
            color: '#6B6359',
          }}>Photo · {photo.year}</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, lineHeight: 1, color: '#6B6359',
          }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Image with Then/Now toggle */}
          <div style={{
            position: 'relative',
            margin: 18,
            borderRadius: 8,
            overflow: 'hidden',
            height: 280,
            background: view === 'then'
              ? (photo.thumb ? '#1A1814' : 'repeating-linear-gradient(135deg, #C8B68F 0 8px, #B8A37A 8px 16px)')
              : 'repeating-linear-gradient(135deg, #C8C3B6 0 8px, #B0AC9F 8px 16px)',
            border: '1px solid #D6CDBD',
          }}>
            {view === 'then' && photo.thumb && (
              <img
                src={photo.thumb}
                alt={photo.title}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            )}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(26,24,20,0) 50%, rgba(26,24,20,0.45) 100%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', top: 10, left: 12,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, color: '#fff', opacity: 0.92,
              background: 'rgba(26,24,20,0.55)',
              padding: '4px 8px', borderRadius: 3, letterSpacing: 1,
              textTransform: 'uppercase',
            }}>{view === 'then' ? `Then · ${photo.year}` : 'Now · 2026'}</div>

            {/* Then/Now segmented control */}
            <div style={{
              position: 'absolute', bottom: 12, left: 12,
              display: 'flex',
              background: '#FFFFFF',
              border: '1px solid #D6CDBD',
              borderRadius: 999,
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(26,24,20,0.15)',
            }}>
              {['then', 'now'].map((m) => (
                <button key={m} onClick={() => setView(m)} style={{
                  padding: '6px 14px',
                  background: view === m ? '#1A1814' : 'transparent',
                  color: view === m ? '#F6F2EB' : '#1A1814',
                  border: 'none',
                  fontSize: 12, fontWeight: 500,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  fontFamily: "'Work Sans', sans-serif",
                }}>{m}</button>
              ))}
            </div>

            {/* Zoom hint */}
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, color: '#fff', opacity: 0.85,
            }}>scroll to zoom</div>
          </div>

          {/* Title + provenance pill */}
          <div style={{ padding: '0 18px 0' }}>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontWeight: 500, fontSize: 24, lineHeight: 1.15, letterSpacing: -0.2,
              color: '#1A1814', marginBottom: 10,
            }}>{photo.title}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <Pill tone={photo.rights.startsWith('Public') ? 'good' : 'warn'}>{photo.rights}</Pill>
              {photo.featured && <Pill tone="featured">Featured in {photo.story}</Pill>}
            </div>
          </div>

          {/* Metadata table */}
          <div style={{
            padding: '0 18px',
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            rowGap: 8, columnGap: 12,
            fontSize: 13,
            color: '#3D3833',
          }}>
            <MetaLabel>Date</MetaLabel><MetaValue>{photo.date_display || `c. ${photo.year}`}</MetaValue>
            <MetaLabel>Photographer</MetaLabel><MetaValue>{photo.photographer}</MetaValue>
            <MetaLabel>Address</MetaLabel><MetaValue>{photo.address}</MetaValue>
            <MetaLabel>Neighborhood</MetaLabel><MetaValue>{photo.neighborhood}</MetaValue>
            <MetaLabel>Held at</MetaLabel><MetaValue>{photo.branch}</MetaValue>
          </div>

          {/* Librarian's note */}
          {photo.note && (
            <div style={{
              margin: '18px 18px 0',
              padding: '14px 16px',
              background: '#FAF6EE',
              border: '1px solid #EEE6D6',
              borderLeft: '3px solid #1F5963',
              borderRadius: 6,
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
                color: '#1F5963', marginBottom: 6,
              }}>Librarian's Note · Brian K.</div>
              <div style={{
                fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
                fontSize: 15, lineHeight: 1.45, color: '#1A1814',
              }}>{photo.note}</div>
            </div>
          )}

          {/* Neighbors in time */}
          {neighbors.length > 0 && (
            <div style={{ marginTop: 24, padding: '0 18px' }}>
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
                color: '#6B6359', marginBottom: 10,
              }}>Neighbors in time</div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {neighbors.map((n) => (
                  <button key={n.id} onClick={() => onOpenPhoto(n)} style={{
                    flexShrink: 0, width: 132,
                    background: 'none', border: '1px solid #EEE6D6',
                    borderRadius: 8, padding: 0,
                    textAlign: 'left', cursor: 'pointer',
                    overflow: 'hidden',
                    fontFamily: "'Work Sans', sans-serif",
                  }}>
                    <div style={{
                      height: 76,
                      background: 'repeating-linear-gradient(135deg, #C8B68F 0 6px, #B8A37A 6px 12px)',
                    }} />
                    <div style={{ padding: 8 }}>
                      <div style={{
                        fontSize: 12, color: '#1A1814', fontWeight: 500,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{n.title}</div>
                      <div style={{
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        fontSize: 10, color: '#A39684', marginTop: 3,
                      }}>{n.year} · {n.neighborhood.split('·')[0].trim()}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Memory thread invitation */}
          <div style={{
            margin: '22px 18px 0',
            padding: '14px 16px',
            background: '#FFFFFF',
            border: '1px dashed #D6CDBD',
            borderRadius: 6,
          }}>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontSize: 16, color: '#1A1814', marginBottom: 4,
            }}>Do you remember this corner?</div>
            <div style={{ fontSize: 13, color: '#3D3833', lineHeight: 1.45, marginBottom: 10 }}>
              Tell us what you know — a name, a date, a story. CPL staff review every note.
            </div>
            <button style={{
              padding: '8px 14px',
              background: '#1A1814', color: '#F6F2EB',
              border: 'none', borderRadius: 6,
              fontSize: 13, cursor: 'pointer',
              fontFamily: "'Work Sans', sans-serif",
            }}>Add a memory →</button>
          </div>

          {/* Footer actions */}
          <div style={{
            margin: '22px 18px 24px',
            display: 'flex', gap: 8, flexWrap: 'wrap',
          }}>
            <ActionLink>Cite</ActionLink>
            <ActionLink>Share</ActionLink>
            <ActionLink>Request a scan</ActionLink>
            <ActionLink>Visit {photo.branch}</ActionLink>
          </div>
        </div>
      </div>
    </>
  );
}

function MetaLabel({ children }) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
      color: '#A39684',
    }}>{children}</div>
  );
}
function MetaValue({ children }) {
  return <div style={{ color: '#1A1814' }}>{children}</div>;
}

function Pill({ children, tone }) {
  const tones = {
    good:     { bg: '#EAF0EF', fg: '#1F5963', bd: '#CBD9D8' },
    warn:     { bg: '#FBEFE2', fg: '#8B5E1F', bd: '#E9D6B4' },
    featured: { bg: '#FBF1DC', fg: '#8B6E1F', bd: '#E9D6A0' },
  };
  const t = tones[tone] || tones.good;
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10.5, letterSpacing: 0.4, textTransform: 'uppercase',
      padding: '4px 9px', borderRadius: 999,
      background: t.bg, color: t.fg, border: '1px solid ' + t.bd,
    }}>{children}</span>
  );
}

function ActionLink({ children }) {
  return (
    <button style={{
      background: 'transparent',
      border: '1px solid #D6CDBD',
      borderRadius: 999,
      padding: '7px 14px',
      fontSize: 13, color: '#1A1814',
      cursor: 'pointer',
      fontFamily: "'Work Sans', sans-serif",
    }}>{children}</button>
  );
}

// ── Story panel (Millionaire's Row map-trail) ───────────────────

function StoryPanel({ onClose, onOpenPhoto }) {
  const stops = (typeof window !== 'undefined' && window.MILLIONAIRES_ROW) || [];

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(26,24,20,0.55)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      padding: '64px 32px',
      overflowY: 'auto',
    }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(880px, 100%)',
          background: '#F6F2EB',
          border: '1px solid #D6CDBD',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(26,24,20,0.32)',
          padding: '32px 40px 40px',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
              color: '#A8362B', marginBottom: 6,
            }}>Story of the week · Map trail</div>
            <h1 style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontWeight: 500, fontSize: 40, letterSpacing: -0.6,
              margin: '0 0 12px', color: '#1A1814',
            }}>Millionaire's Row</h1>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontSize: 18, lineHeight: 1.45, color: '#3D3833', maxWidth: 620,
            }}>
              Between 1880 and 1930, four miles of Euclid Avenue held some of the largest private
              fortunes in the country. By the time anyone thought to save it, almost all of it was gone.
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 24, lineHeight: 1, color: '#6B6359',
          }}>×</button>
        </div>

        <div style={{
          marginTop: 18, paddingTop: 14, borderTop: '1px solid #D6CDBD',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, color: '#6B6359', letterSpacing: 0.4,
          display: 'flex', gap: 18,
        }}>
          <span>Curated by Brian K.</span>
          <span>·</span>
          <span>{stops.length} stops</span>
          <span>·</span>
          <span>1900–1928</span>
        </div>

        <div style={{ marginTop: 28, display: 'grid', gap: 16 }}>
          {stops.map((s, i) => (
            <button key={s.id} onClick={() => onOpenPhoto(s)} style={{
              display: 'grid', gridTemplateColumns: '36px 120px 1fr',
              gap: 18, alignItems: 'center',
              background: '#FFFFFF',
              border: '1px solid #E6DECC',
              borderRadius: 10,
              padding: 12,
              textAlign: 'left', cursor: 'pointer',
              fontFamily: "'Work Sans', sans-serif",
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#C8983A'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E6DECC'}
            >
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 14, color: '#A8362B', textAlign: 'center',
              }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{
                width: 120, height: 78,
                background: 'repeating-linear-gradient(135deg, #C8B68F 0 8px, #B8A37A 8px 16px)',
                borderRadius: 6,
              }} />
              <div>
                <div style={{
                  fontFamily: "Spectral, serif", fontWeight: 500,
                  fontSize: 18, color: '#1A1814', marginBottom: 4,
                }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#3D3833', lineHeight: 1.4 }}>
                  {s.note || s.address}
                </div>
                <div style={{
                  marginTop: 6,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 11, color: '#A39684',
                }}>{s.year} · {s.address}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DesktopLanding });
