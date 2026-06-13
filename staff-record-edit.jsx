// Record Edit View — THE screen. 80% of the work.
// Three columns: photo + annotations · enrichment fields · ContentDM source + map.

function StaffRecordEdit() {
  const t = STAFF_TOKENS;
  const nav = (typeof useNav === 'function') ? useNav() : null;
  const records = nav?.records || [];
  const idx = nav ? Math.max(0, records.findIndex(r => r.id === nav.recordId)) : 0;
  const cur = records[idx] || { id: 'cpl_011_4738', title: 'Euclid Ave looking east', year: 'c.1915' };
  const total = records.length || 22;

  React.useEffect(() => {
    if (!nav) return;
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'j' || e.key === 'J') {
        const prev = records[(idx - 1 + records.length) % records.length];
        if (prev) nav.navigate('record', { id: prev.id });
      } else if (e.key === 'k' || e.key === 'K') {
        const next = records[(idx + 1) % records.length];
        if (next) nav.navigate('record', { id: next.id });
      } else if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        nav.toast('Audit log — opens here. Not built in MVP.', 'info');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        nav.toast(`Saved ${cur.id} — moving to next`, 'ok');
        const next = records[(idx + 1) % records.length];
        if (next) nav.navigate('record', { id: next.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, idx, records, cur]);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: t.bg, overflow: 'hidden',
    }}>
      <RecordSubBar cur={cur} idx={idx} total={total} />
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 420px 320px',
        gap: 0,
      }}>
        <RecordPhotoPane cur={cur} />
        <RecordFieldsPane cur={cur} />
        <RecordContextPane cur={cur} />
      </div>
    </div>
  );
}

// ── Sub-bar (record nav + hotkey hints) ─────────────────────

function RecordSubBar({ cur, idx, total }) {
  const t = STAFF_TOKENS;
  const nav = (typeof useNav === 'function') ? useNav() : { navigate: () => {}, toast: () => {}, savedView: 'Tremont · missing geo', records: [] };
  const records = nav.records || [];
  return (
    <div style={{
      height: 44, padding: '0 24px',
      background: t.bgSurface,
      borderBottom: `1px solid ${t.borderSoft}`,
      display: 'flex', alignItems: 'center', gap: 14,
      flexShrink: 0,
      fontSize: 12.5,
    }}>
      <a
        onClick={() => nav.navigate('photos')}
        style={{ color: t.teal, cursor: 'pointer', textDecoration: 'none' }}>← {nav.savedView || 'Photos'}</a>
      <span style={{ color: t.borderSoft }}>·</span>
      <span style={{ color: t.inkMuted }}>Record <span style={{ fontFamily: t.mono, color: t.ink }}>{idx + 1} / {total}</span></span>
      <span style={{
        background: t.terracotta + '15', color: t.terracotta,
        fontFamily: t.mono, fontSize: 10, letterSpacing: 0.6,
        textTransform: 'uppercase', fontWeight: 500,
        padding: '2px 7px', borderRadius: 3,
      }}>Draft</span>

      <div style={{ flex: 1 }}/>

      <div style={{
        fontFamily: t.mono, fontSize: 10.5,
        color: t.inkFaint, letterSpacing: 0.4,
        display: 'flex', gap: 14,
      }}>
        <span><Kbd>J</Kbd> prev</span>
        <span><Kbd>K</Kbd> next</span>
        <span><Kbd>G</Kbd> geo</span>
        <span><Kbd>1</Kbd>–<Kbd>5</Kbd> confidence</span>
        <span><Kbd>⌘ ↵</Kbd> save & next</span>
      </div>

      <button
        onClick={() => {
          nav.toast(`Saved ${cur?.id || ''} — moving to next`, 'ok');
          const next = records[(idx + 1) % records.length];
          if (next) nav.navigate('record', { id: next.id });
        }}
        style={pillBtn(t, true)}>
        <Kbd small>K</Kbd> Save & next
      </button>
    </div>
  );
}

function Kbd({ children, small }) {
  const t = STAFF_TOKENS;
  return (
    <span style={{
      display: 'inline-block',
      padding: small ? '1px 4px' : '1px 5px',
      background: '#fff',
      border: `1px solid ${t.border}`,
      borderRadius: 3,
      fontFamily: t.mono,
      fontSize: small ? 9.5 : 10,
      color: t.ink,
      letterSpacing: 0,
      lineHeight: 1.3,
      marginRight: 2,
    }}>{children}</span>
  );
}

function pillBtn(t, primary) {
  return {
    height: 28, padding: '0 12px',
    background: primary ? t.ink : t.bgPanel,
    color: primary ? '#F6F2EB' : t.ink,
    border: primary ? 'none' : `1px solid ${t.border}`,
    borderRadius: 6,
    fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };
}

// ── Left: photo pane ────────────────────────────────────────

function RecordPhotoPane({ cur }) {
  const t = STAFF_TOKENS;
  const filename = (cur?.id || 'cpl_011_4738') + '.tif';
  const caption = cur?.title || 'Euclid Ave looking east';
  return (
    <div style={{
      padding: 20,
      borderRight: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column', gap: 12,
      minHeight: 0, overflow: 'hidden',
    }}>
      {/* Photo with annotations */}
      <div style={{
        flex: 1, minHeight: 0,
        background: '#1A1814',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '100%', height: '100%',
          background: cur.thumbUrl ? '#1A1814' : 'repeating-linear-gradient(135deg, #C8B68F 0 12px, #B8A37A 12px 24px)',
          opacity: 0.95,
          position: 'relative',
        }}>
          {cur.thumbUrl && (
            <img src={cur.thumbUrl} alt={cur.title} style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain', display: 'block',
            }}/>
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 60% 45%, rgba(255,255,255,0.18), transparent 70%)',
            pointerEvents: 'none',
          }}/>
          {/* Annotations — only show for the original Statler Hotel mock record */}
          {cur.id === 'cpl_011_4738' && <>
            <Annotation x="32%" y="42%" n="1" note="Statler Hotel — built 1912, 700 Euclid" />
            <Annotation x="68%" y="58%" n="2" note="streetcar visible — Euclid Ave line" below />
            <Annotation x="48%" y="22%" n="3" collapsed />
          </>}

          {/* Bottom-left toolbox */}
          <div style={{
            position: 'absolute', bottom: 14, left: 14,
            display: 'flex', gap: 6, alignItems: 'center',
            background: 'rgba(26,24,20,0.72)',
            backdropFilter: 'blur(4px)',
            borderRadius: 6, padding: '5px 6px',
          }}>
            <IconBtn glyph="zoom-in" />
            <IconBtn glyph="zoom-out" />
            <IconBtn glyph="fit" />
            <span style={{
              width: 1, height: 14, background: 'rgba(255,255,255,0.18)', margin: '0 2px',
            }}/>
            <IconBtn glyph="pin" active />
            <span style={{
              color: 'rgba(255,255,255,0.7)',
              fontFamily: t.mono, fontSize: 10.5, marginLeft: 4, marginRight: 4,
            }}>Annotate</span>
          </div>

          {/* Top-right placeholder caption */}
          <div style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(26,24,20,0.6)',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: t.mono, fontSize: 10.5,
            letterSpacing: 0.5, textTransform: 'uppercase',
            padding: '5px 9px', borderRadius: 4,
          }}>
            [ photo · 3200 × 2400 · TIFF ]
          </div>
        </div>
      </div>

      {/* Caption / filename strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 12, color: t.inkMuted,
      }}>
        <span style={{ fontFamily: t.mono }}>{filename}</span>
        <span style={{ color: t.borderSoft }}>·</span>
        <span>{caption}{cur?.year && !String(caption).includes(String(cur.year)) ? `, ${cur.year}` : ''}</span>
        <div style={{ flex: 1 }}/>
        <a style={{ color: t.teal, fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>Open full-res ↗</a>
      </div>
    </div>
  );
}

function Annotation({ x, y, n, note, below, collapsed }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: t.terracotta,
        border: '2px solid #fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        color: '#fff', fontFamily: t.mono, fontSize: 11, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>{n}</div>
      {!collapsed && (
        <div style={{
          position: 'absolute',
          left: 30, [below ? 'top' : 'bottom']: -4,
          background: 'rgba(26,24,20,0.92)',
          color: '#F6F2EB',
          fontSize: 11.5, lineHeight: 1.35,
          padding: '6px 9px', borderRadius: 5,
          whiteSpace: 'nowrap',
        }}>{note}</div>
      )}
    </div>
  );
}

function IconBtn({ glyph, active }) {
  const t = STAFF_TOKENS;
  const inner = {
    'zoom-in':  <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M4.5 3v3M3 4.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M7 7L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
    'zoom-out': <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M3 4.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M7 7L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
    'fit':      <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 3V1H3 M8 1H10V3 M10 8V10H8 M3 10H1V8" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>,
    'pin':      <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1C3.5 1 2 2.4 2 4.3c0 2.6 3.5 5.5 3.5 5.5S9 6.9 9 4.3C9 2.4 7.5 1 5.5 1z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="5.5" cy="4.2" r="1.1" fill="currentColor"/></svg>,
  }[glyph];
  return (
    <button style={{
      width: 24, height: 24, borderRadius: 4,
      background: active ? 'rgba(246,242,235,0.15)' : 'transparent',
      border: 'none', cursor: 'pointer',
      color: active ? '#F6F2EB' : 'rgba(255,255,255,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{inner}</button>
  );
}

// ── Middle: enrichment fields pane ──────────────────────────

function RecordFieldsPane({ cur }) {
  const t = STAFF_TOKENS;
  const title = cur?.title || 'Euclid Ave looking east';
  const year = cur?.year || 'c.1915';
  // Drop a trailing year from titles like "2175 Ashland Road, 2022" so it isn't duplicated.
  const titleClean = String(title).replace(/,\s*\d{4}\s*$/, '');
  const creator = cur?.creator || 'Bain News Service';
  const accession = cur?.id || '1972045';
  // Some titles are address-shaped; pre-fill the locator with the title minus year.
  const addressGuess = titleClean;
  const themesFromSubject = (cur?.themes && cur.themes.length)
    ? cur.themes
    : ['streetcars', 'commerce', 'hotels'];
  const neighborhoodChips = cur?.nbhd && cur.nbhd !== '—' ? [cur.nbhd] : ['Downtown'];
  const physChips = cur?.physicalLocation ? [cur.physicalLocation] : ['Statler Hotel'];
  return (
    <div key={cur?.id || 'empty'} style={{
      borderRight: `1px solid ${t.border}`,
      background: t.bgPanel,
      overflow: 'auto',
      padding: '20px 22px 32px',
    }}>
      {/* Title block */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontFamily: t.mono, fontSize: 10.5,
          letterSpacing: 1.2, textTransform: 'uppercase',
          color: t.inkMuted, marginBottom: 4,
        }}>ContentDM · locked</div>
        <div style={{
          fontFamily: t.serif, fontSize: 21, fontWeight: 500,
          letterSpacing: -0.2, color: t.ink, lineHeight: 1.2,
        }}>{titleClean}, {year}</div>
        <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 4 }}>
          {creator} · accession <span style={{ fontFamily: t.mono }}>{accession}</span>
        </div>
      </div>

      <FieldGroup label="Enrichment">
        <Field label="Patron caption" provenance={cur?.captionText
          ? { who: 'Tyla', when: '3 weeks ago' }
          : { who: '—', when: 'not yet written' }}>
          <textarea
            defaultValue={cur?.captionText || ''}
            placeholder="One-line summary for patrons — what they're looking at."
            style={textareaStyle(t)}
          />
          <FieldFoot t={t}>One-line summary preferred. Markdown OK.</FieldFoot>
        </Field>

        <Field label="Librarian note" provenance={cur?.noteText
          ? { who: 'you', when: 'just now' }
          : { who: '—', when: 'not yet written' }} dirty={!!cur?.noteText}>
          <textarea
            defaultValue={cur?.noteText || ''}
            placeholder="Curatorial context — provenance, related records, story-worthy detail."
            style={textareaStyle(t)}
          />
        </Field>

        <Field label="Date / period" provenance={{ who: 'cataloger', when: 'import' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input defaultValue={year} style={inputStyle(t, { flex: 1 })}/>
            <select style={selectStyle(t)} defaultValue={/^\d{4}$/.test(String(year)) ? 'exact' : 'approx'}>
              <option value="exact">exact</option>
              <option value="approx">approximate</option>
              <option value="range">range</option>
              <option value="unknown">unknown</option>
            </select>
          </div>
        </Field>
      </FieldGroup>

      <FieldGroup label="Location & geo">
        <Field label="Pin" provenance={{ who: 'you', when: '2 min ago' }} dirty>
          <div style={{
            height: 140,
            background: '#E8DFCE',
            borderRadius: 6,
            position: 'relative',
            overflow: 'hidden',
            border: `1px solid ${t.borderSoft}`,
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: `
                linear-gradient(90deg, transparent 49.7%, rgba(26,24,20,0.08) 49.7%, rgba(26,24,20,0.08) 50.3%, transparent 50.3%),
                linear-gradient(0deg, transparent 49.7%, rgba(26,24,20,0.08) 49.7%, rgba(26,24,20,0.08) 50.3%, transparent 50.3%),
                radial-gradient(circle at 50% 50%, #DDD0B3 0%, #C8B68F 100%)
              `,
            }}/>
            {/* Existing pins faintly */}
            <SmallPin x="38%" y="44%" muted/>
            <SmallPin x="56%" y="51%" muted/>
            <SmallPin x="44%" y="62%" muted/>
            {/* Current pin */}
            <SmallPin x="49%" y="48%" active/>
            <div style={{
              position: 'absolute', bottom: 6, right: 8,
              fontFamily: t.mono, fontSize: 10,
              color: t.inkMuted, background: 'rgba(255,255,255,0.85)',
              padding: '2px 6px', borderRadius: 3,
            }}>3 adjacent</div>
            <div style={{
              position: 'absolute', top: 6, left: 8,
              fontFamily: t.mono, fontSize: 10,
              color: t.ink, background: 'rgba(255,255,255,0.85)',
              padding: '2px 6px', borderRadius: 3,
              letterSpacing: 0.3,
            }}>41.5008° N · 81.6905° W</div>
          </div>
        </Field>

        <Field label="Address / locator">
          <input defaultValue={addressGuess} style={inputStyle(t)}/>
        </Field>

        <Field label="Geo confidence" provenance={{ who: cur?.doneGeo ? 'ContentDM' : '—', when: cur?.doneGeo ? 'on import' : 'no pin' }}>
          <ConfidenceSegmented value={cur?.doneGeo ? 'exact' : 'unknown'}/>
          <FieldFoot t={t}>Derived from pin precision · override allowed</FieldFoot>
        </Field>
      </FieldGroup>

      <FieldGroup label="Taxonomy">
        <Field label="Neighborhood">
          <ChipInput chips={neighborhoodChips} placeholder="Add neighborhood…"/>
        </Field>
        <Field label="Themes">
          <ChipInput chips={themesFromSubject} placeholder="Add theme…"/>
        </Field>
        <Field label="Physical locations">
          <ChipInput chips={physChips} placeholder="Link a building or place…"/>
        </Field>
      </FieldGroup>

      <FieldGroup label="Status" tight>
        <Field label="Public status">
          <StatusSegmented value={cur?.status || 'draft'}/>
        </Field>
        <Field label="Caption quality">
          <StatusSegmented kind="quality" value={cur?.caption || 'placeholder'}/>
        </Field>
        <Field label="Alt text" provenance={{ who: '—', when: 'not yet written' }}>
          <textarea
            defaultValue=""
            placeholder="Describe the image for screen readers."
            style={textareaStyle(t, 60)}
          />
        </Field>
      </FieldGroup>
    </div>
  );
}

function FieldGroup({ label, children, tight }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      paddingBottom: tight ? 0 : 14,
      marginBottom: tight ? 4 : 14,
      borderBottom: tight ? 'none' : `1px solid ${t.borderSoft}`,
    }}>
      <div style={{
        fontFamily: t.mono, fontSize: 10,
        letterSpacing: 1.4, textTransform: 'uppercase',
        color: t.inkMuted, marginBottom: 10,
      }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, provenance, dirty, ai, children }) {
  const t = STAFF_TOKENS;
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: t.ink }}>{label}</span>
          {dirty && (
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: t.draft,
            }} title="unsaved changes"/>
          )}
          {ai && (
            <span style={{
              fontFamily: t.mono, fontSize: 9, letterSpacing: 0.6,
              textTransform: 'uppercase', color: t.teal,
              background: t.tealSoft, padding: '1px 5px', borderRadius: 3,
            }}>AI · reviewed</span>
          )}
        </div>
        {provenance && (
          <span style={{
            fontFamily: t.mono, fontSize: 10,
            color: t.inkFaint, letterSpacing: 0.2,
          }} title={`Edited by ${provenance.who} ${provenance.when}`}>
            {provenance.who} · {provenance.when}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldFoot({ children, t }) {
  return (
    <div style={{
      fontSize: 11, color: t.inkFaint,
      marginTop: 4, fontStyle: 'italic',
    }}>{children}</div>
  );
}

function inputStyle(t, extra = {}) {
  return {
    height: 30, padding: '0 10px',
    background: '#fff',
    border: `1px solid ${t.border}`,
    borderRadius: 5,
    fontFamily: t.sans, fontSize: 13, color: t.ink,
    width: '100%', boxSizing: 'border-box',
    outline: 'none',
    ...extra,
  };
}
function textareaStyle(t, height = 64) {
  return {
    minHeight: height,
    padding: 10,
    background: '#fff',
    border: `1px solid ${t.border}`,
    borderRadius: 5,
    fontFamily: t.sans, fontSize: 13, color: t.ink,
    lineHeight: 1.45,
    width: '100%', boxSizing: 'border-box',
    outline: 'none', resize: 'vertical',
  };
}
function selectStyle(t) {
  return {
    height: 30, padding: '0 8px',
    background: '#fff',
    border: `1px solid ${t.border}`,
    borderRadius: 5,
    fontFamily: t.sans, fontSize: 12.5, color: t.ink,
  };
}

function SmallPin({ x, y, active, muted }) {
  const t = STAFF_TOKENS;
  const color = active ? t.terracotta : muted ? '#9A8E76' : t.terracotta;
  const size = active ? 13 : 8;
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: 'translate(-50%,-100%)',
    }}>
      <div style={{
        width: size, height: size,
        background: color,
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        border: active ? '2px solid #fff' : 'none',
        boxShadow: active ? '0 2px 6px rgba(0,0,0,0.3)' : 'none',
        opacity: muted ? 0.7 : 1,
      }}/>
    </div>
  );
}

function ConfidenceSegmented({ value }) {
  const t = STAFF_TOKENS;
  const levels = [
    { id: 'exact', label: 'Exact', n: '1' },
    { id: 'block', label: 'Block', n: '2' },
    { id: 'inter', label: 'Intersection', n: '3' },
    { id: 'nbhd',  label: 'Neighborhood', n: '4' },
    { id: 'unknown', label: 'Unknown', n: '5' },
  ];
  return (
    <div style={{
      display: 'flex',
      border: `1px solid ${t.border}`,
      borderRadius: 5, overflow: 'hidden',
      background: '#fff',
    }}>
      {levels.map((l, i) => (
        <div key={l.id} style={{
          flex: 1,
          padding: '6px 0',
          textAlign: 'center',
          fontSize: 11.5,
          background: l.id === value ? t.teal : 'transparent',
          color: l.id === value ? '#fff' : t.ink,
          borderRight: i < levels.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
          cursor: 'pointer',
          position: 'relative',
          fontWeight: l.id === value ? 500 : 400,
        }}>
          <span>{l.label}</span>
          <span style={{
            position: 'absolute', top: 2, right: 4,
            fontFamily: t.mono, fontSize: 9,
            color: l.id === value ? 'rgba(255,255,255,0.7)' : t.inkFaint,
          }}>{l.n}</span>
        </div>
      ))}
    </div>
  );
}

function StatusSegmented({ value, kind = 'public' }) {
  const t = STAFF_TOKENS;
  const opts = kind === 'public'
    ? [
        { id: 'draft',  label: 'Draft',    color: t.draft },
        { id: 'review', label: 'For review', color: t.ochre },
        { id: 'ready',  label: 'Public-ready', color: t.sage },
        { id: 'hidden', label: 'Hidden',   color: t.inkFaint },
      ]
    : [
        { id: 'placeholder', label: 'Placeholder', color: t.inkFaint },
        { id: 'rewrite',     label: 'Needs rewrite', color: t.terracotta },
        { id: 'ok',          label: 'OK',  color: t.ochre },
        { id: 'good',        label: 'Good', color: t.sage },
      ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opts.map(o => (
        <button key={o.id} style={{
          padding: '5px 10px',
          fontSize: 11.5,
          background: o.id === value ? o.color : '#fff',
          color: o.id === value ? '#fff' : t.ink,
          border: `1px solid ${o.id === value ? o.color : t.border}`,
          borderRadius: 4,
          cursor: 'pointer',
          fontWeight: o.id === value ? 500 : 400,
          fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {o.id !== value && <span style={{ width: 6, height: 6, borderRadius: '50%', background: o.color }}/>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChipInput({ chips, placeholder, suggested }) {
  const t = STAFF_TOKENS;
  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 5,
        padding: '6px 6px 6px 8px',
        minHeight: 30,
        background: '#fff',
        border: `1px solid ${t.border}`,
        borderRadius: 5,
        alignItems: 'center',
      }}>
        {chips.map(c => (
          <span key={c} style={{
            background: t.bg,
            color: t.ink, fontSize: 11.5,
            padding: '3px 7px', borderRadius: 12,
            border: `1px solid ${t.borderSoft}`,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {c}
            <span style={{ color: t.inkFaint, cursor: 'pointer', marginLeft: 2 }}>×</span>
          </span>
        ))}
        <input placeholder={placeholder} style={{
          flex: 1, minWidth: 80, border: 'none', outline: 'none',
          background: 'transparent', fontSize: 12, color: t.ink,
          fontFamily: t.sans,
          padding: '3px 4px',
        }}/>
      </div>
      {suggested && (
        <div style={{
          fontSize: 11, color: t.teal,
          marginTop: 5, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{
            fontFamily: t.mono, fontSize: 9,
            letterSpacing: 0.5, textTransform: 'uppercase',
            background: t.tealSoft, padding: '1px 5px', borderRadius: 3,
          }}>AI</span>
          {suggested}
        </div>
      )}
    </div>
  );
}

// ── Right: ContentDM + comments + suggested-next pane ───────

function RecordContextPane({ cur }) {
  const t = STAFF_TOKENS;
  const nav = (typeof useNav === 'function') ? useNav() : { records: [], navigate: () => {} };
  const records = nav.records || [];
  // Suggest next = same neighborhood, different record, similar year window
  const suggestions = cur ? records
    .filter(r => r.id !== cur.id && r.nbhd === cur.nbhd)
    .slice(0, 3) : [];
  const titleClean = String(cur?.title || 'Euclid Avenue, looking east').replace(/,\s*\d{4}\s*$/, '');
  return (
    <div style={{
      background: t.bgSurface,
      overflow: 'auto',
      padding: '18px 18px 28px',
    }}>
      {/* ContentDM source */}
      <div style={{
        background: '#fff',
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{
            fontFamily: t.mono, fontSize: 9.5,
            letterSpacing: 1.2, textTransform: 'uppercase',
            color: t.inkMuted,
          }}>ContentDM · source</div>
          <a href={cur?.contentdmUrl || undefined} target="_blank" rel="noreferrer" style={{
            color: t.teal, fontSize: 11.5,
            textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 3,
            pointerEvents: cur?.contentdmUrl ? 'auto' : 'none',
            opacity: cur?.contentdmUrl ? 1 : 0.4,
          }}>Open ↗</a>
        </div>
        <div style={{ fontSize: 12.5, color: t.ink, lineHeight: 1.5 }}>
          <SrcRow label="Title" value={titleClean}/>
          <SrcRow label="Creator" value={cur?.creator || cur?.captionText || 'unknown'}/>
          <SrcRow label="Date orig." value={cur?.year || 'unknown'}/>
          <SrcRow label="Format" value="JP2 (digital)"/>
          <SrcRow label="Rights" value={cur?.rights || 'No known restrictions'} mono/>
          <SrcRow label="Accession" value={cur?.id || '—'} mono last/>
        </div>
      </div>

      {/* Suggested next */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: t.mono, fontSize: 10,
          letterSpacing: 1.4, textTransform: 'uppercase',
          color: t.inkMuted, marginBottom: 8,
        }}>You might enrich next</div>
        {suggestions.length ? suggestions.map(s => (
          <SuggestNext
            key={s.id}
            id={s.id}
            caption={String(s.title).replace(/,\s*\d{4}\s*$/, '')}
            reason={`${s.nbhd} · ${s.year}`}
          />
        )) : (
          <div style={{ fontSize: 12, color: t.inkFaint, fontStyle: 'italic' }}>
            No nearby records found.
          </div>
        )}
      </div>

      {/* AI assist drawer */}
      <div style={{
        background: '#fff',
        border: `1px dashed ${t.teal}55`,
        borderRadius: 8,
        padding: '12px 14px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 8,
        }}>
          <span style={{
            fontFamily: t.mono, fontSize: 9, letterSpacing: 0.8,
            textTransform: 'uppercase', color: t.teal,
            background: t.tealSoft, padding: '2px 6px', borderRadius: 3,
          }}>AI assist</span>
          <span style={{ fontSize: 11, color: t.inkMuted }}>Suggestions, never auto-fills</span>
        </div>
        <AiSugg label="Alt text" status="accepted" body="Black-and-white photograph of Euclid Avenue looking east…"/>
        <AiSugg label="Themes" status="open" body="Add ‘public-square-radius’? Used on 23 photos within 0.4 mi."/>
        <AiSugg label="Geo" status="dismissed" body="‘Statler Hotel, 700 Euclid Ave’ → suggests 41.5006°, 81.6907°"/>
      </div>
    </div>
  );
}

function SrcRow({ label, value, mono, last }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      display: 'flex', gap: 8,
      padding: '4px 0',
      borderBottom: last ? 'none' : `1px solid ${t.borderSoft}`,
    }}>
      <span style={{
        color: t.inkMuted, fontSize: 11.5,
        minWidth: 64, fontFamily: t.sans,
      }}>{label}</span>
      <span style={{
        flex: 1, color: t.ink,
        fontFamily: mono ? t.mono : t.sans,
        fontSize: mono ? 11.5 : 12.5,
      }}>{value}</span>
    </div>
  );
}

function SuggestNext({ id, caption, reason }) {
  const t = STAFF_TOKENS;
  const nav = (typeof useNav === 'function') ? useNav() : { navigate: () => {} };
  return (
    <div
      onClick={() => nav.navigate('record', { id })}
      style={{
        background: '#fff',
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
      }}>
      <div style={{
        width: 40, height: 40, borderRadius: 4,
        background: 'repeating-linear-gradient(135deg, #C8B68F 0 4px, #B8A37A 4px 8px)',
        flexShrink: 0,
      }}/>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{
          fontSize: 12, color: t.ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{caption}</div>
        <div style={{
          fontFamily: t.mono, fontSize: 10,
          color: t.inkFaint,
          marginTop: 2,
        }}>{id} · {reason}</div>
      </div>
    </div>
  );
}

function Comment({ who, when, body, self }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      background: self ? t.tealSoft : '#fff',
      border: `1px solid ${self ? t.teal + '30' : t.border}`,
      borderRadius: 6,
      padding: '8px 10px',
      marginBottom: 6,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, marginBottom: 4,
      }}>
        <span style={{ color: t.ink, fontWeight: 500 }}>{who}</span>
        <span style={{ color: t.inkFaint, fontFamily: t.mono, fontSize: 10 }}>{when}</span>
      </div>
      <div style={{ color: t.inkSubtle, fontSize: 12.5, lineHeight: 1.45 }}>{body}</div>
    </div>
  );
}

function AiSugg({ label, status, body }) {
  const t = STAFF_TOKENS;
  const nav = (typeof useNav === 'function') ? useNav() : { toast: () => {} };
  const statusMap = {
    accepted: { color: t.sage, label: 'accepted' },
    open: { color: t.ochre, label: 'open' },
    dismissed: { color: t.inkFaint, label: 'dismissed' },
  };
  const s = statusMap[status];
  return (
    <div style={{
      padding: '8px 0',
      borderTop: `1px solid ${t.borderSoft}`,
      opacity: status === 'dismissed' ? 0.55 : 1,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 3,
      }}>
        <span style={{ fontSize: 11.5, color: t.ink, fontWeight: 500 }}>{label}</span>
        <span style={{
          fontFamily: t.mono, fontSize: 9.5,
          color: s.color, letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}>{s.label}</span>
      </div>
      <div style={{
        fontSize: 11.5, color: t.inkMuted, lineHeight: 1.4,
      }}>{body}</div>
      {status === 'open' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button
            onClick={() => nav.toast(`AI suggestion accepted: ${label}`, 'ok')}
            style={{
              padding: '3px 9px', fontSize: 11, fontFamily: 'inherit',
              background: t.ink, color: '#F6F2EB', border: 'none',
              borderRadius: 4, cursor: 'pointer',
            }}>Accept</button>
          <button
            onClick={() => nav.toast(`Dismissed: ${label}`, 'info')}
            style={{
              padding: '3px 9px', fontSize: 11, fontFamily: 'inherit',
              background: 'transparent', color: t.inkMuted,
              border: `1px solid ${t.border}`,
              borderRadius: 4, cursor: 'pointer',
            }}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { StaffRecordEdit });
