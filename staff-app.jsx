// Staff App — functional MVP routing/state on top of the existing staff screens.
// Provides NavContext (currentView, navigate, toast) consumed via window.useNav().
// Falls back to no-ops when the screens are rendered inside the DesignCanvas mockup.

const VIEWS = {
  home:    { section: 'home',    title: 'Home',           meta: 'WELCOME · BRIAN MEGGITT' },
  photos:  { section: 'photos',  title: 'Photos',         meta: '22 MATCHING · TREMONT · MISSING GEO' },
  record:  { section: 'photos',  title: '',               meta: 'EDIT · TREMONT WORKLIST' },
  stories: { section: 'stories', title: 'Stories',        meta: 'DRAFTS · CO-AUTHORED' },
  story:   { section: 'stories', title: '',               meta: 'DRAFT · CO-AUTHORED' },
  contrib: { section: 'contrib', title: 'Contributions',  meta: '8 PENDING · PATRON' },
  vocab:   { section: 'vocab',   title: 'Vocabularies',   meta: '6 LISTS' },
};

// Sample records — drives both the photos sheet and the record edit screen.
const SAMPLE_RECORDS = [
  { id: 'cpl_011_4738', thumb: 1, title: 'Euclid Ave looking east', year: 'c.1915', nbhd: '—', themes: ['streetcars'], geo: 'missing', conf: '—', caption: 'good', status: 'draft', alt: '—', notes: 2, selected: false, captionText: "Streetcars rounding the curve near East 9th; the Statler Hotel anchors the block. Look for the bowler-hatted businessmen waiting at the corner.", noteText: "Compare to cpl_011_4742 — same block, ~6 months later, streetcar livery has changed." },
  { id: 'cpl_011_4742', thumb: 2, title: 'Euclid Ave, same block, ~6mo later', year: 'c.1915', nbhd: '—', themes: ['streetcars'], geo: 'missing', conf: '—', caption: 'placeholder', status: 'draft', alt: '—', notes: 0, selected: false },
  { id: 'cpl_011_5108', thumb: 3, title: 'Statler Hotel, Lobby', year: '1912', nbhd: 'Downtown', themes: ['hotels','interiors'], geo: 'missing', conf: '—', caption: 'good', status: 'review', alt: '—', notes: 1, selected: false },
  { id: 'cpl_011_3994', thumb: 4, title: 'Streetcars at Public Square', year: '1916', nbhd: 'Downtown', themes: ['streetcars','public-space'], geo: 'missing', conf: '—', caption: 'good', status: 'draft', alt: 'ok', notes: 0, selected: false },
  { id: 'cpl_011_3995', thumb: 5, title: 'Cleveland Trust Rotunda', year: '1907', nbhd: 'Downtown', themes: ['banks','architecture'], geo: 'block', conf: '2', caption: 'good', status: 'ready', alt: 'ok', notes: 0, selected: false, doneGeo: true },
  { id: 'cpl_011_4101', thumb: 6, title: '(no caption — cataloger fields only)', year: 'c.1910', nbhd: '—', themes: [], geo: 'missing', conf: '—', caption: 'rewrite', status: 'draft', alt: '—', notes: 3, selected: false, needsRewrite: true },
  { id: 'cpl_011_4205', thumb: 7, title: 'Detroit Ave at W 25th, looking south', year: '1922', nbhd: 'Ohio City', themes: ['streetcars','commerce'], geo: 'missing', conf: '—', caption: 'good', status: 'review', alt: 'ok', notes: 1, selected: false },
  { id: 'cpl_011_4506', thumb: 8, title: 'West Side Market, exterior', year: 'c.1920', nbhd: 'Ohio City', themes: ['markets'], geo: 'block', conf: '2', caption: 'good', status: 'ready', alt: 'ok', notes: 0, selected: false, doneGeo: true },
  { id: 'cpl_011_4607', thumb: 9, title: 'Tremont Methodist, Lincoln Park', year: '1908', nbhd: 'Tremont', themes: ['religion'], geo: 'missing', conf: '—', caption: 'placeholder', status: 'draft', alt: '—', notes: 0, selected: false },
  { id: 'cpl_011_4711', thumb: 10, title: 'Lincoln Park Bandstand, summer evening', year: '1910', nbhd: 'Tremont', themes: ['public-space','music'], geo: 'inter', conf: '3', caption: 'good', status: 'review', alt: 'ok', notes: 2, selected: false, doneGeo: true },
  { id: 'cpl_011_4720', thumb: 11, title: 'Pilgrim Church, southwest corner', year: 'c.1912', nbhd: 'Tremont', themes: ['religion','architecture'], geo: 'missing', conf: '—', caption: 'good', status: 'draft', alt: '—', notes: 0, selected: false },
  { id: 'cpl_011_4801', thumb: 12, title: 'Steel mill workers, Tremont overlook', year: '1919', nbhd: 'Tremont', themes: ['industry','labor'], geo: 'missing', conf: '—', caption: 'rewrite', status: 'draft', alt: '—', notes: 1, selected: false, needsRewrite: true },
];

const NavContext = React.createContext(null);
function useNav() {
  return React.useContext(NavContext) || {
    view: 'home', recordId: null, savedView: null,
    navigate: () => {}, toast: () => {},
    selection: new Set(), toggleSelect: () => {}, clearSelection: () => {},
    records: SAMPLE_RECORDS,
  };
}

function Toaster({ toasts }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          minWidth: 240, maxWidth: 380,
          padding: '10px 14px',
          background: '#221F1B', color: '#F6F2EB',
          border: '1px solid rgba(246,242,235,0.15)',
          borderLeft: `3px solid ${t.tone === 'ok' ? '#5C7A4F' : t.tone === 'warn' ? '#C8983A' : '#1F5963'}`,
          borderRadius: 6, fontSize: 12.5, lineHeight: 1.4,
          fontFamily: "'Work Sans', sans-serif",
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          animation: 'slideUp 180ms ease-out',
        }}>{t.text}</div>
      ))}
    </div>
  );
}

// Adapt a harvested Tier 3 record (from data/tier3-central/records.json)
// into the shape the staff screens consume. Preserves the SAMPLE_RECORDS
// schema (id/title/year/nbhd/themes/geo/conf/caption/status/alt/notes/...)
// and adds `thumbUrl`/`contentdmUrl`/`captionText` from ContentDM fields.
function adaptHarvestedToStaff(r, i) {
  const year = r.sort_date ? String(r.sort_date).slice(0, 4) : (r.date_display || '—');
  const themes = r.subject
    ? String(r.subject).split(';').map(s => s.trim()).filter(Boolean).slice(0, 3)
    : [];
  const hasGeo = r.lat != null && r.lng != null;
  return {
    id: String(r.id),
    thumb: (i % 12) + 1,             // legacy stripe-pattern seed (used when image fails)
    thumbUrl: r.thumb || null,        // IIIF URL — preferred when present
    contentdmUrl: r.contentdm_url || null,
    title: r.title || '(untitled)',
    year,
    nbhd: r.neighborhood || '—',
    themes,
    geo: hasGeo ? 'exact' : 'missing',
    conf: hasGeo ? '1' : '—',
    caption: 'placeholder',           // nothing enriched yet
    status: 'draft',
    alt: '—',
    notes: 0,
    selected: false,
    doneGeo: hasGeo,
    captionText: '',                  // librarian-authored, empty for fresh harvest
    noteText: '',
    physicalLocation: r.physical_location || null,
    creator: r.creator || null,
    rights: r.rights || null,
    rightsUri: r.rights_uri || null,
  };
}

function StaffApp() {
  const [view, setView] = React.useState('home');
  const [savedView, setSavedView] = React.useState('All harvested');
  const [selection, setSelection] = React.useState(() => new Set());
  const [toasts, setToasts] = React.useState([]);
  const [records, setRecords] = React.useState(SAMPLE_RECORDS);
  const [recordId, setRecordId] = React.useState(SAMPLE_RECORDS[0].id);

  React.useEffect(() => {
    let cancelled = false;
    fetch('data/tier3-all/records.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('records.json missing')))
      .then(raw => {
        if (cancelled) return;
        const adapted = raw.map(adaptHarvestedToStaff);
        setRecords(adapted);
        if (adapted.length) setRecordId(adapted[0].id);
        console.log(`[harvest] loaded ${adapted.length} records into the enrichment app`);
      })
      .catch(err => console.warn('[harvest] using SAMPLE_RECORDS fallback:', err.message));
    return () => { cancelled = true; };
  }, []);

  const toast = React.useCallback((text, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, text, tone }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600);
  }, []);

  const navigate = React.useCallback((target, opts = {}) => {
    if (target === 'record' && opts.id) setRecordId(opts.id);
    if (target === 'photos' && opts.savedView) setSavedView(opts.savedView);
    setView(target);
  }, []);

  const toggleSelect = React.useCallback((id) => {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => setSelection(new Set()), []);

  const ctx = { view, recordId, savedView, selection, navigate, toast, toggleSelect, clearSelection, records };
  const viewMeta = VIEWS[view] || VIEWS.home;
  const currentRec = records.find(r => r.id === recordId) || records[0];

  // Dynamic screen title/meta per view
  let screenTitle = viewMeta.title;
  let screenMeta = viewMeta.meta;
  if (view === 'record') {
    screenTitle = currentRec.id + '.tif';
    screenMeta = 'EDIT · ' + savedView.toUpperCase();
  } else if (view === 'story') {
    screenTitle = 'Streetcars of Detroit Avenue';
  } else if (view === 'photos') {
    const n = records.filter(r => savedView.includes('Tremont') ? r.nbhd === 'Tremont' || r.geo === 'missing' : true).length;
    screenMeta = `${n} MATCHING · ${savedView.toUpperCase()}`;
  }

  return (
    <NavContext.Provider value={ctx}>
      <StaffShell
        activeSection={viewMeta.section}
        screenTitle={screenTitle}
        screenMeta={screenMeta}
      >
        {view === 'home' && <StaffHome />}
        {view === 'photos' && <StaffPhotosList />}
        {view === 'record' && <StaffRecordEdit />}
        {view === 'stories' && <StoriesIndex />}
        {view === 'story' && <StaffStoryAuthor />}
        {view === 'contrib' && <StubView title="Contributions queue" body="Patron-suggested fixes land here. Triage UI not built in this MVP." />}
        {view === 'vocab' && <StubView title="Vocabularies" body="Controlled lists for neighborhoods, themes, places. Not built in this MVP." />}
      </StaffShell>
      <Toaster toasts={toasts} />
    </NavContext.Provider>
  );
}

function StoriesIndex() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const stories = [
    { id: 'streetcars-detroit', title: 'Streetcars of Detroit Avenue', dek: 'From horse-drawn cars to the last electric line: forty years of one street\'s spine.', stops: 5, status: 'draft', authors: '@brian, @lisa' },
    { id: 'millionaires-row', title: "Millionaire's Row", dek: 'The mansions Euclid Ave lost — and the photographs that remember them.', stops: 8, status: 'published', authors: '@olivia' },
    { id: 'tremont-churches', title: 'Steeples of Tremont', dek: 'Six congregations within walking distance, six different decades.', stops: 6, status: 'draft', authors: '@brian' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.bg }}>
      <div style={{ padding: '32px 40px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontFamily: t.serif, fontSize: 26, fontWeight: 460, color: t.ink }}>Stories</div>
          <button
            onClick={() => nav.toast('Stub — new story creation not built in MVP', 'info')}
            style={{ height: 32, padding: '0 14px', background: t.ink, color: '#F6F2EB', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New story
          </button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {stories.map(s => (
            <div key={s.id}
              onClick={() => s.id === 'streetcars-detroit' ? nav.navigate('story', { id: s.id }) : nav.toast(`"${s.title}" — preview not built in MVP`, 'info')}
              style={{
                background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10,
                padding: '16px 20px', cursor: 'pointer',
                display: 'flex', gap: 18, alignItems: 'center',
              }}>
              <div style={{
                width: 80, height: 60, borderRadius: 5,
                background: `repeating-linear-gradient(${30 + s.stops * 22}deg, #C8B68F 0 6px, #B8A37A 6px 12px)`,
                flexShrink: 0,
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                  <span style={{ fontFamily: t.serif, fontSize: 17, fontWeight: 500, color: t.ink }}>{s.title}</span>
                  <span style={{
                    background: s.status === 'published' ? t.sageSoft : t.draftSoft,
                    color: s.status === 'published' ? t.sage : t.draft,
                    fontFamily: t.mono, fontSize: 10, letterSpacing: 0.6,
                    textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, fontWeight: 500,
                  }}>{s.status}</span>
                </div>
                <div style={{ color: t.inkMuted, fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>{s.dek}</div>
                <div style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint, letterSpacing: 0.3 }}>
                  {s.stops} stops · {s.authors}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StubView({ title, body }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontFamily: t.serif, fontSize: 22, fontWeight: 500, color: t.ink, marginBottom: 6 }}>{title}</div>
        <div style={{ color: t.inkMuted, fontSize: 13.5, lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}

// Animations
const __styleEl = document.createElement('style');
__styleEl.textContent = `
@keyframes slideUp {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
`;
document.head.appendChild(__styleEl);

Object.assign(window, { StaffApp, NavContext, useNav, SAMPLE_RECORDS });
