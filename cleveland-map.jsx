// ClevelandMap — abstract, stylised street-grid impression of Cleveland.
// Lake Erie up top, Cuyahoga river bend, downtown street grid, Euclid Ave
// running NE from Public Square (Millionaire's Row).

// ── Photo data (single source of truth) ───────────────────────
// Each photo: { id, x, y, title, year, neighborhood, address, photographer,
//   rights, branch, note, featured? }
const CLEVELAND_PHOTOS = [
  // West side market cluster
  { id: 'wsm-1908', x: 360, y: 410, year: 1908, title: 'West Side Market under construction',
    neighborhood: 'Ohio City', address: 'W. 25th & Lorain', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Carnegie West Branch',
    note: 'The cornerstone was laid this year. The clock tower would come last.' },
  { id: 'wsm-1925', x: 380, y: 432, year: 1925, title: 'Market day, W. 25th',
    neighborhood: 'Ohio City', address: 'W. 25th near Lorain', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Carnegie West Branch',
    note: 'Saturday crowds. The streetcar tracks ran right through the entrance.' },
  { id: 'wsm-1932', x: 348, y: 388, year: 1932, title: 'Lorain Ave looking east',
    neighborhood: 'Ohio City', address: 'Lorain & W. 28th', photographer: 'Plain Dealer',
    rights: 'Plain Dealer collection — contact for reuse', branch: 'Carnegie West Branch',
    note: null },

  // Public Square
  { id: 'ps-1903', x: 484, y: 376, year: 1903, title: 'Public Square, trolley turnaround',
    neighborhood: 'Downtown', address: 'Public Square', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Main Library',
    note: 'Three streetcar lines met here. The Soldiers & Sailors Monument is barely a decade old.' },
  { id: 'ps-1928', x: 506, y: 360, year: 1928, title: 'Public Square at dusk',
    neighborhood: 'Downtown', address: 'Public Square', photographer: 'Margaret Bourke-White',
    rights: 'Public Domain (pre-1931)', branch: 'Main Library',
    note: null },

  // Tremont
  { id: 'tr-1915', x: 440, y: 510, year: 1915, title: 'Lincoln Park bandstand',
    neighborhood: 'Tremont', address: 'Kenilworth & W. 11th', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'South Branch',
    note: 'The bandstand stood for another forty years.' },
  { id: 'tr-1922', x: 412, y: 540, year: 1922, title: 'St. Theodosius, dome',
    neighborhood: 'Tremont', address: '733 Starkweather', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'South Branch',
    note: 'Consecrated 1913. The Deer Hunter scenes were shot here fifty-six years later.' },
  { id: 'tr-1934', x: 470, y: 522, year: 1934, title: 'Tremont rooftops',
    neighborhood: 'Tremont', address: 'W. 14th near Auburn', photographer: 'WPA',
    rights: 'CPL — display only', branch: 'South Branch',
    note: 'Depression-era housing survey. The corner is still here.' },

  // Ohio City
  { id: 'oc-1912', x: 332, y: 446, year: 1912, title: 'Bridge Avenue houses',
    neighborhood: 'Ohio City', address: 'Bridge & W. 32nd', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Carnegie West Branch',
    note: null },

  // Lakefront
  { id: 'lf-1918', x: 560, y: 232, year: 1918, title: 'Lakefront docks',
    neighborhood: 'Downtown', address: 'E. 9th Pier', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Main Library',
    note: 'Ore boats from the Mesabi range. The shoreline was four blocks closer then.' },
  { id: 'lf-1924', x: 640, y: 218, year: 1924, title: 'Municipal Stadium site, before',
    neighborhood: 'Downtown', address: 'N. Marginal & E. 9th', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Main Library',
    note: null },

  // East side scatter
  { id: 'es-1905', x: 820, y: 372, year: 1905, title: 'E. 55th streetcar barn',
    neighborhood: 'Midtown', address: 'E. 55th & Quincy', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Sterling Branch',
    note: null },
  { id: 'es-1920', x: 880, y: 410, year: 1920, title: 'Quincy Ave corner store',
    neighborhood: 'Fairfax', address: 'Quincy & E. 79th', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Sterling Branch',
    note: 'Run by the Mihelic family. The building is gone — the corner is still here.' },
  { id: 'es-1910', x: 760, y: 444, year: 1910, title: 'Central Ave row houses',
    neighborhood: 'Central', address: 'Central near E. 40th', photographer: 'Lewis Hine',
    rights: 'Public Domain (pre-1931)', branch: 'Sterling Branch',
    note: 'Hine’s documentation of working-family housing.' },
  { id: 'es-1930', x: 700, y: 478, year: 1930, title: 'Cedar–Central kids',
    neighborhood: 'Central', address: 'E. 30th & Cedar', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Sterling Branch',
    note: null },

  // Hough (sparse, intentional)
  { id: 'ho-1932', x: 820, y: 300, year: 1932, title: 'Hough Avenue, looking east',
    neighborhood: 'Hough', address: 'Hough & E. 79th', photographer: 'WPA',
    rights: 'CPL — display only', branch: 'Hough Branch',
    note: 'We’re still digitizing Hough. If you remember this corner, tell us.' },

  // Detroit-Shoreway
  { id: 'ds-1916', x: 280, y: 360, year: 1916, title: 'Detroit Ave streetcar',
    neighborhood: 'Detroit-Shoreway', address: 'Detroit & W. 65th', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Lorain Branch',
    note: null },
  { id: 'ds-1928', x: 240, y: 384, year: 1928, title: 'Gordon Square theatre',
    neighborhood: 'Detroit-Shoreway', address: 'Detroit & W. 65th', photographer: 'unknown',
    rights: 'Public Domain (pre-1931)', branch: 'Lorain Branch',
    note: null },
];

// Millionaire's Row — featured story along Euclid
const MILLIONAIRES_ROW = [
  { id: 'mr-1', x: 480, y: 380, year: 1900, title: 'Euclid Ave at E. 12th',
    address: 'Euclid & E. 12th', photographer: 'unknown',
    note: 'The Wade mansion stood on the south side of Euclid until 1925.' },
  { id: 'mr-2', x: 540, y: 360, year: 1903, title: 'Stone gate at the Hanna estate',
    address: 'Euclid & E. 18th', photographer: 'unknown',
    note: null },
  { id: 'mr-3', x: 600, y: 340, year: 1906, title: 'Carriage drive, Euclid Ave',
    address: 'Euclid & E. 22nd', photographer: 'unknown',
    note: 'The Avenue was paved with cedar blocks. You can still find them under the asphalt.' },
  { id: 'mr-4', x: 660, y: 320, year: 1909, title: 'Brush mansion front gate',
    address: 'Euclid & E. 30th', photographer: 'unknown',
    note: null },
  { id: 'mr-5', x: 720, y: 300, year: 1912, title: 'Rockefeller house, side view',
    address: 'Euclid & E. 40th', photographer: 'unknown',
    note: 'Demolished 1938. The Cleveland Clinic main campus sits roughly here now.' },
  { id: 'mr-6', x: 780, y: 280, year: 1915, title: 'Mather residence garden',
    address: 'Euclid & E. 46th', photographer: 'unknown',
    note: 'This building is gone. The corner is still here.' },
  { id: 'mr-7', x: 840, y: 260, year: 1918, title: 'Bingham mansion, winter',
    address: 'Euclid & E. 55th', photographer: 'unknown',
    note: null },
  { id: 'mr-8', x: 900, y: 240, year: 1921, title: 'Severance house porch',
    address: 'Euclid & E. 62nd', photographer: 'unknown',
    note: null },
  { id: 'mr-9', x: 960, y: 220, year: 1924, title: 'Last of the Euclid mansions',
    address: 'Euclid & E. 71st', photographer: 'unknown',
    note: 'By 1924 most of the Row was rooming houses or commercial conversions.' },
  { id: 'mr-10', x: 1020, y: 200, year: 1927, title: 'Euclid Ave widening',
    address: 'Euclid & E. 79th', photographer: 'Plain Dealer',
    note: 'The Avenue was widened. Setbacks vanished. The Row vanished with them.' },
  { id: 'mr-11', x: 1080, y: 180, year: 1928, title: 'Vacant lot, former Hay estate',
    address: 'Euclid & E. 86th', photographer: 'Plain Dealer',
    note: null },
];

// Annotate Millionaire's Row entries with shared fields
MILLIONAIRES_ROW.forEach((p) => {
  p.featured = true;
  p.neighborhood = 'Midtown · Euclid Corridor';
  p.rights = p.year < 1931 ? 'Public Domain (pre-1931)' : 'CPL — display only';
  p.branch = 'Main Library';
  p.story = 'Millionaire’s Row';
});

let ALL_PHOTOS = [...CLEVELAND_PHOTOS, ...MILLIONAIRES_ROW];
let HARVESTED_PHOTOS = []; // populated by loadHarvestedPhotos() before first render

// Anchored linear projection: Public Square (lat 41.4995, lng -81.6938) → viewBox (500, 395).
// Scales tuned to fit a multi-neighborhood Cleveland footprint into the 1200×700 viewBox:
// Central (E of downtown), Clark-Fulton (SW), Tremont/Ohio City (W), Hough (NE).
function projectLatLng(lat, lng) {
  return {
    x: 500 + (lng - -81.6938) * 2500,
    y: 395 - (lat - 41.4995) * 5000,
  };
}

function rightsFromUri(uri) {
  if (!uri) return 'CPL — contact for reuse';
  if (/NoC-US|publicdomain|PDM/i.test(uri)) return 'Public Domain';
  if (/InC\b/i.test(uri)) return 'CPL — contact for reuse';
  return 'CPL — contact for reuse';
}

function adaptHarvestedRecord(rec) {
  if (rec.lat == null || rec.lng == null) return null;
  const { x, y } = projectLatLng(rec.lat, rec.lng);
  const year = rec.sort_date ? parseInt(String(rec.sort_date).slice(0, 4), 10) : null;
  if (!Number.isFinite(year)) return null;
  return {
    id: `cdm-${rec.id}`,
    contentdm_id: rec.id,
    x, y, year,
    title: rec.title || 'Untitled',
    neighborhood: rec.neighborhood || 'Central',
    address: rec.title || '',
    photographer: rec.creator || 'unknown',
    rights: rightsFromUri(rec.rights_uri),
    branch: 'Main Library',
    note: null,
    thumb: rec.thumb,
    contentdm_url: rec.contentdm_url,
    sort_date: rec.sort_date,
    date_display: rec.date_display,
  };
}

window.loadHarvestedPhotos = function (records) {
  HARVESTED_PHOTOS = records.map(adaptHarvestedRecord).filter(Boolean);
  ALL_PHOTOS = [...CLEVELAND_PHOTOS, ...HARVESTED_PHOTOS, ...MILLIONAIRES_ROW];
  window.ALL_PHOTOS = ALL_PHOTOS;
  window.HARVESTED_PHOTOS = HARVESTED_PHOTOS;
  return HARVESTED_PHOTOS.length;
};

// ── Inverse of projectLatLng — turn legacy SVG x/y back into lat/lng ─
function unprojectXY(x, y) {
  return {
    lat: 41.4995 - (y - 395) / 5000,
    lng: -81.6938 + (x - 500) / 2500,
  };
}

// ────────────────────────────────────────────────────────────────────
// Leaflet + OpenStreetMap (CARTO Positron) version of the map.
// Drop-in replacement for the previous SVG implementation; preserves the
// same prop surface (yearRange, selectedId, hoveredId, onDotClick,
// onDotHover, nearYou, zoom) so DesktopLanding wires through unchanged.
// ────────────────────────────────────────────────────────────────────
function ClevelandMap({
  width = 1200,
  height = 700,
  density = 'curated',     // unused — kept for compat
  showLabels = true,       // unused — OSM tiles carry their own labels
  pan = { x: 0, y: 0 },    // unused — Leaflet handles panning
  zoom = 1,
  yearRange = [1880, 2020],
  selectedId = null,
  hoveredId = null,
  onDotClick = null,
  onDotHover = null,
  nearYou = null,          // { x, y } legacy OR { lat, lng }
}) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markersRef = React.useRef(new Map()); // photoId → L.circleMarker
  const corridorRef = React.useRef(null);
  const nearYouRef = React.useRef(null);

  // Keep callbacks fresh without retriggering the markers effect.
  const cbRef = React.useRef({ onDotClick, onDotHover });
  cbRef.current = { onDotClick, onDotHover };

  // ── Mount: initialise Leaflet, base tiles, featured corridor ──
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const L = window.L;
    if (!L) {
      console.error('[ClevelandMap] Leaflet not loaded');
      return;
    }

    const map = L.map(containerRef.current, {
      center: [41.4995, -81.6938],   // Public Square
      zoom: 13,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 90,
      preferCanvas: true,            // smoother with many CircleMarkers
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    ).addTo(map);

    // Featured Millionaire's Row corridor — soft glow + crisp dashed line.
    const corridor = MILLIONAIRES_ROW.map((p) => {
      const ll = unprojectXY(p.x, p.y);
      return [ll.lat, ll.lng];
    });
    const corridorGlow = L.polyline(corridor, {
      color: '#C8983A',
      weight: 14,
      opacity: 0.18,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);
    const corridorDash = L.polyline(corridor, {
      color: '#C8983A',
      weight: 2,
      opacity: 0.7,
      dashArray: '1, 7',
      lineCap: 'round',
      interactive: false,
    }).addTo(map);
    corridorRef.current = L.layerGroup([corridorGlow, corridorDash]).addTo(map);

    mapRef.current = map;
    window.clevelandMapInstance = map;

    return () => {
      map.remove();
      mapRef.current = null;
      window.clevelandMapInstance = null;
    };
  }, []);

  // ── Resize when container changes ──
  React.useEffect(() => {
    if (mapRef.current) mapRef.current.invalidateSize();
  }, [width, height]);

  // ── External zoom prop → Leaflet zoom level ──
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = 13 + (zoom - 1) * 2.5;
    if (Math.abs(map.getZoom() - target) > 0.05) {
      map.setZoom(target, { animate: true });
    }
  }, [zoom]);

  // ── Photo markers ──
  const [lo, hi] = yearRange;
  React.useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;

    const pool = (typeof window !== 'undefined' && window.ALL_PHOTOS)
      ? window.ALL_PHOTOS
      : [...CLEVELAND_PHOTOS, ...MILLIONAIRES_ROW];

    // Clear previous
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const esc = (s) => String(s || '').replace(/[<>&"]/g, (c) => (
      { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]
    ));

    pool.forEach((p) => {
      const isIn = p.year >= lo && p.year <= hi;
      const isFeatured = !!p.featured;
      const ll = (p.lat != null && p.lng != null)
        ? { lat: p.lat, lng: p.lng }
        : unprojectXY(p.x, p.y);

      const classes = [
        'cm-dot',
        isFeatured ? 'cm-dot--featured' : '',
        !isIn ? 'cm-dot--dim' : '',
      ].filter(Boolean).join(' ');

      const icon = L.divIcon({
        className: 'cm-dot-wrap',
        html: `<div class="${classes}" data-photo-id="${esc(p.id)}"><span class="cm-dot-ring"></span><span class="cm-dot-core"></span></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([ll.lat, ll.lng], {
        icon,
        interactive: isIn,
        keyboard: false,
        riseOnHover: true,
        riseOffset: 250,
      });

      if (isIn) {
        const yearClass = isFeatured ? 'cm-year cm-year--featured' : 'cm-year';
        const metaParts = [];
        if (p.neighborhood) metaParts.push(p.neighborhood);
        if (p.story) metaParts.push(p.story);
        const metaHtml = metaParts.length
          ? `<span class="cm-meta">${esc(metaParts.join(' · '))}</span>`
          : '';
        marker.bindTooltip(
          `<span class="${yearClass}">${p.year}</span>` +
          `<span class="cm-title">${esc(p.title)}</span>` +
          metaHtml,
          {
            direction: 'top',
            offset: [0, -8],
            className: 'cm-tooltip',
            opacity: 1,
            sticky: false,
          },
        );
        marker.on('click', () => cbRef.current.onDotClick && cbRef.current.onDotClick(p));
        marker.on('mouseover', () => cbRef.current.onDotHover && cbRef.current.onDotHover(p.id));
        marker.on('mouseout', () => cbRef.current.onDotHover && cbRef.current.onDotHover(null));
      }

      marker.addTo(map);
      markersRef.current.set(p.id, marker);
    });
  }, [lo, hi]);

  // ── Highlight selected (CSS class on the div-icon) ──
  React.useEffect(() => {
    const markers = markersRef.current;
    markers.forEach((m, id) => {
      const el = m.getElement && m.getElement();
      if (!el) return;
      const dot = el.querySelector('.cm-dot');
      if (!dot) return;
      dot.classList.toggle('cm-dot--selected', id === selectedId);
    });
  }, [selectedId]);

  // ── "You are here" marker ──
  React.useEffect(() => {
    if (nearYouRef.current) {
      nearYouRef.current.remove();
      nearYouRef.current = null;
    }
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !nearYou) return;
    const ll = (nearYou.lat != null && nearYou.lng != null)
      ? { lat: nearYou.lat, lng: nearYou.lng }
      : unprojectXY(nearYou.x, nearYou.y);
    const icon = L.divIcon({
      className: 'cm-near',
      html: '<div class="cm-near-pulse"></div><div class="cm-near-dot"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    nearYouRef.current = L.marker([ll.lat, ll.lng], { icon, interactive: false, keyboard: false }).addTo(map);
  }, [nearYou]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        background: '#F1ECE2',
      }}
    />
  );
}

// Legacy SVG implementation kept below for reference (unused).
function ClevelandMapSVG_unused({
  width = 1200,
  height = 700,
  density = 'curated',
  showLabels = true,
  pan = { x: 0, y: 0 },
  zoom = 1,
  yearRange = [1880, 2020],
  selectedId = null,
  hoveredId = null,
  onDotClick = null,
  onDotHover = null,
  nearYou = null,
}) {
  const C = {
    land: '#E8E2D6',
    river: '#9AA8B0',
    lake: '#7A8C95',
    dot: '#A8362B',
    hi: '#C8983A',
    hair: '#D6CDBD',
    ink: '#1A1814',
    dim: '#A39684',
  };

  const [lo, hi] = yearRange;
  const inRange = (y) => y >= lo && y <= hi;

  const seededDots = React.useMemo(() => {
    const rng = mulberry32(20260523);
    const out = [];
    const isOnLake = (x, y) => y < lakeY(x) + 30;
    const isOnRiver = (x, y) => {
      const rx = riverX(y);
      return Math.abs(x - rx) < 14 && y > 80 && y < 620;
    };
    for (let i = 0; i < (density === 'dense' ? 360 : 220); i++) {
      const x = 60 + rng() * 1080;
      const y = 120 + rng() * 540;
      if (isOnLake(x, y)) continue;
      if (isOnRiver(x, y)) continue;
      const eastBias = rng() * 0.6 + 0.2;
      const xx = x * eastBias + (1 - eastBias) * (420 + rng() * 480);
      out.push({ x: xx, y, r: 1.6 + rng() * 1.6 });
    }
    return out;
  }, [density]);

  const dotInteractive = (photo, baseR, isFeatured) => {
    const isIn = inRange(photo.year);
    const isHover = hoveredId === photo.id;
    const isSel = selectedId === photo.id;
    const fill = !isIn ? C.dim : isFeatured ? C.hi : C.dot;
    const haloOpacity = !isIn ? 0.06 : isFeatured ? 0.28 : 0.20;
    const r = isHover || isSel ? baseR + 1.2 : baseR;
    return (
      <g
        key={photo.id}
        data-photo-id={photo.id}
        style={{ cursor: isIn ? 'pointer' : 'default' }}
        onClick={isIn && onDotClick ? (e) => { e.stopPropagation(); onDotClick(photo); } : undefined}
        onMouseEnter={isIn && onDotHover ? () => onDotHover(photo.id) : undefined}
        onMouseLeave={isIn && onDotHover ? () => onDotHover(null) : undefined}
      >
        <circle cx={photo.x} cy={photo.y} r={r + 2.5} fill={fill} fillOpacity={haloOpacity} />
        <circle cx={photo.x} cy={photo.y} r={r} fill={fill} fillOpacity={isIn ? 1 : 0.45} />
        <circle cx={photo.x} cy={photo.y} r={r} fill="none"
                stroke={C.ink} strokeOpacity={isIn ? 0.22 : 0.12} strokeWidth="0.5" />
        {(isHover || isSel) && isIn && (
          <circle cx={photo.x} cy={photo.y} r={r + 5} fill="none"
                  stroke={fill} strokeOpacity="0.55" strokeWidth="1.2" />
        )}
      </g>
    );
  };

  const lookupPool = [...CLEVELAND_PHOTOS, ...HARVESTED_PHOTOS, ...MILLIONAIRES_ROW];
  const hoveredPhoto = hoveredId ? lookupPool.find((p) => p.id === hoveredId) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block', background: C.land, fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <defs>
        <pattern id="gridFine" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 0 L24 0 M0 0 L0 24" stroke={C.hair} strokeWidth="0.5" opacity="0.55" />
        </pattern>
        <pattern id="gridCoarse" width="120" height="120" patternUnits="userSpaceOnUse">
          <path d="M0 0 L120 0 M0 0 L0 120" stroke={C.hair} strokeWidth="0.8" opacity="0.85" />
        </pattern>
        <radialGradient id="lakeShade" cx="50%" cy="100%" r="80%">
          <stop offset="0%" stopColor={C.lake} stopOpacity="0.95" />
          <stop offset="100%" stopColor={C.lake} stopOpacity="1" />
        </radialGradient>
        <filter id="paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.6  0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0.04 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        <rect x="0" y="0" width="1200" height="700" fill={C.land} />
        <rect x="0" y="0" width="1200" height="700" fill="url(#gridFine)" />
        <rect x="0" y="0" width="1200" height="700" fill="url(#gridCoarse)" />

        <g stroke={C.hair} strokeWidth="2" fill="none" opacity="0.95">
          <path d="M484 376 L1140 120" />
          <path d="M484 376 L 60 400" />
          <path d="M484 376 L 1160 320" />
          <path d="M484 376 L 1160 560" />
          <path d="M484 376 L 470 700" />
          <path d="M340 80 L 360 700" />
          <path d="M740 80 L 720 700" />
          <path d="M900 80 L 880 700" />
          <path d="M1060 80 L 1040 700" />
          <path d="M40 220 C 280 200, 600 180, 1160 160" />
          <path d="M40 260 C 280 250, 700 240, 1160 230" />
        </g>

        <path d={lakePath()} fill="url(#lakeShade)" />
        <path d={lakePath()} fill="none" stroke={C.ink} strokeOpacity="0.18" strokeWidth="1" />

        <path
          d="M 320 90 C 320 160, 380 200, 360 260 C 340 320, 420 340, 380 400 C 350 460, 430 480, 400 540 C 380 590, 410 640, 420 700"
          fill="none" stroke={C.river} strokeWidth="14" strokeLinecap="round" opacity="0.95"
        />
        <path
          d="M 320 90 C 320 160, 380 200, 360 260 C 340 320, 420 340, 380 400 C 350 460, 430 480, 400 540 C 380 590, 410 640, 420 700"
          fill="none" stroke="#B4BFC6" strokeWidth="3" strokeLinecap="round" opacity="0.65"
        />

        {/* Dimmed background dots */}
        <g fill={C.dot} opacity="0.28">
          {seededDots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} />
          ))}
        </g>

        {/* Featured corridor halo */}
        <path
          d={`M ${MILLIONAIRES_ROW[0].x} ${MILLIONAIRES_ROW[0].y} L ${MILLIONAIRES_ROW[MILLIONAIRES_ROW.length - 1].x} ${MILLIONAIRES_ROW[MILLIONAIRES_ROW.length - 1].y}`}
          stroke={C.hi} strokeWidth="14" strokeOpacity="0.13" strokeLinecap="round" fill="none"
        />

        {/* Millionaire's Row dots */}
        <g>{MILLIONAIRES_ROW.map((p) => dotInteractive(p, 4, true))}</g>

        {/* Curated active dots */}
        <g>{CLEVELAND_PHOTOS.map((p) => dotInteractive(p, 3.4, false))}</g>

        {/* Harvested ContentDM dots (real data) */}
        <g>{HARVESTED_PHOTOS.map((p) => dotInteractive(p, 2.8, false))}</g>

        {/* "You are here" marker */}
        {nearYou && (
          <g>
            <circle cx={nearYou.x} cy={nearYou.y} r="22" fill="#1F5963" fillOpacity="0.08">
              <animate attributeName="r" from="14" to="28" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="fill-opacity" from="0.22" to="0" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={nearYou.x} cy={nearYou.y} r="7" fill="#1F5963" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        )}

        {showLabels && (
          <g
            fontFamily='"JetBrains Mono", ui-monospace, monospace'
            fontSize="11"
            fill={C.ink}
            fillOpacity="0.55"
            style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            <text x="900" y="120">LAKE ERIE</text>
            <text x="350" y="110" transform="rotate(-78 350 110)">CUYAHOGA</text>
            <text x="500" y="395">PUBLIC SQ.</text>
            <text x="820" y="190">EUCLID AVE</text>
            <text x="260" y="350">OHIO CITY</text>
            <text x="430" y="555">TREMONT</text>
            <text x="780" y="320" fillOpacity="0.4">HOUGH</text>
            <text x="950" y="430">UNIVERSITY CIRCLE</text>
            <text x="170" y="430">DETROIT–SHOREWAY</text>
          </g>
        )}

        <rect x="0" y="0" width="1200" height="700" filter="url(#paper)" pointerEvents="none" />

        {/* Hover tooltip — rendered in SVG so it tracks zoom/pan */}
        {hoveredPhoto && (
          <g pointerEvents="none" transform={`translate(${hoveredPhoto.x} ${hoveredPhoto.y - 16})`}>
            <rect
              x={-Math.max(60, hoveredPhoto.title.length * 3.4)}
              y={-26} rx="3" ry="3"
              width={Math.max(120, hoveredPhoto.title.length * 6.8)}
              height="22"
              fill={C.ink}
            />
            <text
              x="0" y="-11" textAnchor="middle"
              fontFamily="'Work Sans', sans-serif"
              fontSize="11" fill="#F6F2EB"
            >
              <tspan fontFamily='"JetBrains Mono", ui-monospace, monospace' fill={hoveredPhoto.featured ? C.hi : '#F6F2EB'} opacity="0.9">{hoveredPhoto.year}</tspan>
              <tspan dx="6">{hoveredPhoto.title}</tspan>
            </text>
            <polygon points="-4,-4 4,-4 0,0" fill={C.ink} />
          </g>
        )}
      </g>
    </svg>
  );
}

function lakePath() {
  return `
    M 0 0
    L 1200 0
    L 1200 195
    C 1000 230, 700 170, 500 200
    C 320 225, 160 175, 0 220
    Z
  `;
}
function lakeY(x) {
  if (x < 200) return 215;
  if (x < 500) return 195 + (x - 200) * 0.04;
  if (x < 800) return 200 - (x - 500) * 0.05;
  return 185;
}
function riverX(y) {
  if (y < 200) return 330;
  if (y < 320) return 370;
  if (y < 420) return 390;
  if (y < 540) return 400;
  return 415;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

Object.assign(window, { ClevelandMap, ALL_PHOTOS, MILLIONAIRES_ROW, CLEVELAND_PHOTOS });
