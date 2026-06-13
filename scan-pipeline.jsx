// Surface A — Pipeline run (deliberately thin).
// A read-only status panel, not a workspace. Reports progress + itemizes failures,
// hands off to Surface B. Also defines window.scanApi — the shared client the three
// scan surfaces use to talk to scan/server.mjs.
//
// Spec: scan-pipeline-ux.md §"Surface A — Pipeline run".

// ── Shared API client (server is scan/server.mjs; falls back loudly under python) ──
const scanApi = {
  async list() {
    const r = await fetch('/api/scan/records');
    if (!r.ok) throw new Error(`records ${r.status}`);
    return r.json();
  },
  async get(id) {
    const r = await fetch(`/api/scan/records/${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error(`record ${r.status}`);
    return r.json();
  },
  async patch(id, patch) {
    const r = await fetch(`/api/scan/records/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`save ${r.status}`);
    return r.json();
  },
  async accuracy() {
    const r = await fetch('/api/scan/accuracy');
    if (!r.ok) throw new Error(`accuracy ${r.status}`);
    return r.json();
  },
  async retry(id) {
    const r = await fetch(`/api/scan/retry/${encodeURIComponent(id)}`, { method: 'POST' });
    return r.json();
  },
  csvUrl: '/api/scan/accuracy?format=csv',
};

// Shared loader hook + a "needs the server" banner used by all three surfaces.
function useScanRecords() {
  const [records, setRecords] = React.useState(null);
  const [error, setError] = React.useState(null);
  const reload = React.useCallback(() => {
    scanApi.list().then(setRecords).catch((e) => setError(e.message));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);
  return { records, error, reload, setRecords };
}

function ServerNeeded({ error }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 24 }}>
        <div style={{ fontFamily: t.serif, fontSize: 22, fontWeight: 500, color: t.ink, marginBottom: 8 }}>
          Scan pipeline needs the write-back server
        </div>
        <div style={{ color: t.inkMuted, fontSize: 13.5, lineHeight: 1.6 }}>
          The review surface reads and saves through a small local server. Start it and reload:
          <pre style={{
            background: t.bgInk, color: '#E8DFCE', fontFamily: t.mono, fontSize: 12.5,
            padding: '10px 14px', borderRadius: 8, marginTop: 12, textAlign: 'left',
          }}>node scan/server.mjs</pre>
          <span style={{ fontSize: 12, color: t.inkFaint }}>then open http://localhost:8000/enrichment-app.html</span>
        </div>
        {error && <div style={{ marginTop: 12, fontFamily: t.mono, fontSize: 11, color: t.terracotta }}>({error})</div>}
      </div>
    </div>
  );
}

function ScanPipeline() {
  const t = STAFF_TOKENS;
  const nav = (typeof useNav === 'function') ? useNav() : { navigate: () => {}, toast: () => {} };
  const { records, error, reload } = useScanRecords();
  const [retrying, setRetrying] = React.useState({});

  if (error) return <ServerNeeded error={error} />;
  if (!records) return <CenterNote text="Loading pipeline…" />;

  const total = records.length;
  const derived = records.filter((r) => r.jpeg_path).length;
  const deriveFailed = records.filter((r) => r.derive?.status === 'failed').length;
  const ready = records.filter((r) => r.status === 'ready').length;
  const failed = records.filter((r) => r.status === 'failed');
  const reviewed = records.filter((r) => r.review?.status === 'reviewed').length;
  const stub = records.some((r) => r.vlm?._stub);

  const onRetry = async (id) => {
    setRetrying((m) => ({ ...m, [id]: true }));
    try {
      await scanApi.retry(id);
      nav.toast(`Re-attempted ${id}`, 'ok');
      reload();
    } catch (e) {
      nav.toast(`Retry failed: ${e.message}`, 'warn');
    } finally {
      setRetrying((m) => ({ ...m, [id]: false }));
    }
  };

  const startReview = () => {
    const first = records.find((r) => r.status === 'ready' && r.review?.status !== 'reviewed')
      || records.find((r) => r.status === 'ready');
    if (!first) return nav.toast('No photos ready to review yet', 'info');
    nav.navigate('scanReview', { id: first.chc_id });
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.bg }}>
      <div style={{ padding: '32px 40px 48px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ fontFamily: t.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', color: t.inkMuted, marginBottom: 4 }}>
          Box: City Hall Neighborhood (CHC)
        </div>
        <div style={{ fontFamily: t.serif, fontSize: 26, fontWeight: 460, color: t.ink, marginBottom: 18 }}>
          Scan pipeline run
        </div>

        {stub && (
          <div style={{
            background: t.draftSoft, border: `1px solid ${t.draft}55`, color: t.draft,
            borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, lineHeight: 1.5,
          }}>
            <strong>Stub mode.</strong> The VLM ran without a key (placeholder reads). Set
            <span style={{ fontFamily: t.mono }}> GEMINI_API_KEY</span> and re-run
            <span style={{ fontFamily: t.mono }}> node scan/run.mjs</span> for real address/year/description.
          </div>
        )}

        <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 20px' }}>
          <StatRow label="Masters found" value={`${total} TIFF`} />
          <StatRow label="Derived to JPEG" value={`${derived} ✓`} note={deriveFailed ? `${deriveFailed} errors` : '0 errors'} bad={deriveFailed > 0} />
          <StatRow label="VLM pass" value={`${ready} ✓`} note="address · year · description" />
          <StatRow label="Failed" value={`${failed.length}`} bad={failed.length > 0} last={!failed.length} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
          <div style={{ fontSize: 14, color: t.ink }}>
            <strong style={{ fontSize: 18 }}>{ready}</strong> ready to review
            <span style={{ color: t.inkMuted, fontSize: 12.5 }}> · {reviewed} reviewed</span>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => nav.navigate('scanAccuracy')} style={pillBtn(t, false)}>Accuracy ▸</button>
          <button onClick={startReview} style={pillBtn(t, true)}>Start review →</button>
        </div>

        {failed.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: t.terracotta, marginBottom: 10 }}>
              {failed.length} failed — re-attempt individually
            </div>
            {failed.map((r) => (
              <div key={r.chc_id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8,
                padding: '8px 12px', marginBottom: 6,
              }}>
                <span style={{ fontFamily: t.mono, fontSize: 12, color: t.ink }}>{r.chc_id}</span>
                <span style={{ flex: 1, fontSize: 12, color: t.inkMuted }}>{r.error || 'unknown error'}</span>
                <button disabled={retrying[r.chc_id]} onClick={() => onRetry(r.chc_id)} style={pillBtn(t, false)}>
                  {retrying[r.chc_id] ? 'retrying…' : 'Re-attempt'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, note, bad, last }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12,
      padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${t.borderSoft}`,
    }}>
      <span style={{ fontSize: 13.5, color: t.inkSubtle, minWidth: 160 }}>{label}</span>
      <span style={{ fontFamily: t.mono, fontSize: 14, color: bad ? t.terracotta : t.ink, fontWeight: 500 }}>{value}</span>
      {note && <span style={{ fontSize: 12, color: bad ? t.terracotta : t.inkMuted }}>{note}</span>}
    </div>
  );
}

function CenterNote({ text }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <div style={{ color: t.inkMuted, fontSize: 13.5 }}>{text}</div>
    </div>
  );
}

Object.assign(window, { ScanPipeline, scanApi, useScanRecords, ServerNeeded, CenterNote });
