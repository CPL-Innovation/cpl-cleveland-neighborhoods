// Story authoring — sequence editor with per-photo notes, comments, preview-as-patron.

function StaffStoryAuthor() {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: t.bg, overflow: 'hidden',
    }}>
      <StorySubBar />
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '280px 1fr 340px',
      }}>
        <StoryMetaPane />
        <StorySequencePane />
        <StoryPreviewPane />
      </div>
    </div>
  );
}

function StorySubBar() {
  const t = STAFF_TOKENS;
  const nav = (typeof useNav === 'function') ? useNav() : { navigate: () => {}, toast: () => {} };
  return (
    <div style={{
      height: 44, padding: '0 24px',
      background: t.bgSurface,
      borderBottom: `1px solid ${t.borderSoft}`,
      display: 'flex', alignItems: 'center', gap: 14,
      flexShrink: 0,
      fontSize: 12.5,
    }}>
      <a onClick={() => nav.navigate('stories')} style={{ color: t.teal, cursor: 'pointer', textDecoration: 'none' }}>← Stories</a>
      <span style={{ color: t.borderSoft }}>·</span>
      <span style={{ color: t.ink }}>Streetcars of Detroit Avenue</span>
      <span style={{
        background: t.draftSoft, color: t.draft,
        fontFamily: t.mono, fontSize: 10, letterSpacing: 0.6,
        textTransform: 'uppercase', fontWeight: 500,
        padding: '2px 7px', borderRadius: 3,
      }}>Draft</span>
      <span style={{
        fontFamily: t.mono, fontSize: 11, color: t.inkFaint,
      }}>co-authored with Lisa Sanchez</span>

      <div style={{ flex: 1 }}/>

      <button
        onClick={() => nav.toast('Opens sandbox.oldcleveland.org in new tab — stub in MVP', 'info')}
        style={{
          height: 28, padding: '0 12px',
          background: '#fff', border: `1px solid ${t.border}`,
          borderRadius: 5, fontSize: 12, color: t.ink,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 5.5C2.5 3 4.5 1.5 5.5 1.5S8.5 3 10 5.5C8.5 8 6.5 9.5 5.5 9.5S2.5 8 1 5.5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="5.5" cy="5.5" r="1.4" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
        Preview as patron
      </button>
      <button
        onClick={() => nav.toast('Story published — patrons can see it now', 'ok')}
        style={{
          height: 28, padding: '0 14px',
          background: t.teal, color: '#fff',
          border: 'none', borderRadius: 5,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>Publish…</button>
    </div>
  );
}

// ── Left: metadata pane ─────────────────────────────────────

function StoryMetaPane() {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      borderRight: `1px solid ${t.border}`,
      background: t.bgPanel,
      overflow: 'auto',
      padding: '20px 18px 28px',
    }}>
      <FieldGroup label="Story">
        <Field label="Title">
          <input defaultValue="Streetcars of Detroit Avenue" style={inputStyle(t)}/>
        </Field>
        <Field label="Dek">
          <textarea
            defaultValue="From horse-drawn cars to the last electric line: forty years of one street's spine."
            style={textareaStyle(t, 56)}
          />
        </Field>
        <Field label="Format">
          <FormatSegmented value="map_trail"/>
        </Field>
        <Field label="Authors">
          <ChipInput chips={['@brian', '@lisa']} placeholder="Add author…"/>
        </Field>
      </FieldGroup>

      <FieldGroup label="Publication">
        <Field label="Featured weight">
          <FeaturedSlider value={3}/>
          <FieldFoot t={t}>Olivia picks Story of the Week from top-weighted stories.</FieldFoot>
        </Field>
        <Field label="Theme">
          <ChipInput chips={['streetcars', 'transit']} placeholder="Add theme…"/>
        </Field>
        <Field label="Neighborhood span">
          <ChipInput chips={['Ohio City', 'Detroit-Shoreway', 'Edgewater']} placeholder="Add neighborhood…"/>
        </Field>
        <Field label="Year range">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input defaultValue="1882" style={inputStyle(t, { width: 70 })}/>
            <span style={{ color: t.inkMuted }}>—</span>
            <input defaultValue="1953" style={inputStyle(t, { width: 70 })}/>
          </div>
        </Field>
      </FieldGroup>

      <div style={{
        background: t.bgSurface,
        border: `1px solid ${t.borderSoft}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginTop: 6,
      }}>
        <div style={{
          fontFamily: t.mono, fontSize: 10,
          letterSpacing: 1.4, textTransform: 'uppercase',
          color: t.inkMuted, marginBottom: 6,
        }}>Sandbox URL</div>
        <div style={{
          fontFamily: t.mono, fontSize: 11.5,
          color: t.teal, wordBreak: 'break-all',
        }}>sandbox.oldcleveland.org/<br/>s/detroit-streetcars-Wx7</div>
        <button style={{
          marginTop: 8,
          background: 'transparent', border: 'none',
          color: t.teal, fontSize: 11.5, cursor: 'pointer',
          fontFamily: 'inherit', padding: 0,
        }}>Copy link →</button>
      </div>
    </div>
  );
}

function FormatSegmented({ value }) {
  const t = STAFF_TOKENS;
  const opts = [
    { id: 'article', label: 'Article' },
    { id: 'map_trail', label: 'Map trail' },
    { id: 'hybrid', label: 'Hybrid' },
  ];
  return (
    <div style={{
      display: 'flex',
      border: `1px solid ${t.border}`,
      borderRadius: 5, overflow: 'hidden',
      background: '#fff',
    }}>
      {opts.map((o, i) => (
        <div key={o.id} style={{
          flex: 1, padding: '6px 0',
          textAlign: 'center', fontSize: 12,
          background: o.id === value ? t.ink : 'transparent',
          color: o.id === value ? '#F6F2EB' : t.ink,
          borderRight: i < opts.length - 1 ? `1px solid ${t.borderSoft}` : 'none',
          cursor: 'pointer',
          fontWeight: o.id === value ? 500 : 400,
        }}>{o.label}</div>
      ))}
    </div>
  );
}

function FeaturedSlider({ value }) {
  const t = STAFF_TOKENS;
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        {[0,1,2,3,4,5].map(n => (
          <div key={n} style={{
            width: 22, height: 22, borderRadius: '50%',
            background: n <= value ? (n === value ? t.ochre : t.ochreSoft) : '#fff',
            border: `1px solid ${n <= value ? t.ochre : t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: t.mono, fontSize: 10,
            color: n === value ? '#fff' : (n < value ? t.ochre : t.inkFaint),
            cursor: 'pointer',
            fontWeight: 600,
          }}>{n}</div>
        ))}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: t.mono, fontSize: 10, color: t.inkFaint,
        letterSpacing: 0.4, textTransform: 'uppercase',
      }}>
        <span>hidden</span>
        <span>standard</span>
        <span>featured</span>
      </div>
    </div>
  );
}

// ── Middle: sequence pane ───────────────────────────────────

function StorySequencePane() {
  const t = STAFF_TOKENS;
  const stops = [
    { n: 1, id: 'cpl_007_2201', title: '1882 — Horse cars on Detroit', loc: 'W 25th & Detroit', dist: '0.0 mi', note: 'The line begins as a horse car spur. Pay attention to the cobble surface — visible faintly in the foreground.', transition: null, conf: 'block' },
    { n: 2, id: 'cpl_007_2245', title: 'Electrification, 1894', loc: 'W 28th & Detroit', dist: '0.2 mi', note: 'Twelve years later: overhead wires, but the same curb line.', transition: 'Walk west along Detroit. The buildings on the north side date to this period.', conf: 'block', comment: { who: 'Lisa', body: 'add a note about the powerhouse here?' } },
    { n: 3, id: 'cpl_007_2310', title: 'West Boulevard interchange, 1903', loc: 'W 65th & Detroit', dist: '1.4 mi', note: 'this corner is actually a block east — want me to re-geo?', transition: null, conf: 'inter', comment: { who: 'Brian', body: '@lisa — re-pinned. confidence: block.', resolved: true } },
    { n: 4, id: 'cpl_007_2401', title: 'Peak service, c. 1920', loc: 'W 117th & Detroit', dist: '3.8 mi', note: 'Three cars in frame; rush-hour density that won\'t survive the auto age.', transition: 'A long walk — the trail jumps you here to keep the rhythm.', conf: 'exact' },
    { n: 5, id: 'cpl_007_2588', title: 'The last line, 1953', loc: 'Edgewater terminus', dist: '5.2 mi', note: 'Conductors posing on the final run. The rails would be pulled within the year.', transition: null, conf: 'exact', isLast: true },
  ];
  return (
    <div style={{
      overflow: 'auto',
      padding: '20px 24px 32px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div style={{
          fontFamily: t.mono, fontSize: 10.5,
          letterSpacing: 1.4, textTransform: 'uppercase',
          color: t.inkMuted,
        }}>Sequence · {stops.length} stops · 5.2 mi</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            height: 28, padding: '0 12px',
            background: '#fff', border: `1px solid ${t.border}`,
            borderRadius: 5, fontSize: 12, color: t.ink,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Reverse order</button>
          <button style={{
            height: 28, padding: '0 12px',
            background: t.ink, color: '#F6F2EB',
            border: 'none', borderRadius: 5,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Add photo
          </button>
        </div>
      </div>

      {stops.map((s, i) => (
        <SequenceStop key={s.id} stop={s} t={t} isLast={i === stops.length - 1}/>
      ))}

      {/* Empty drop zone */}
      <div style={{
        marginTop: 8,
        padding: '20px 18px',
        border: `1.5px dashed ${t.border}`,
        borderRadius: 8,
        textAlign: 'center',
        color: t.inkMuted,
        fontSize: 12.5,
        background: t.bgSurface,
      }}>
        Drag a photo here, or <span style={{ color: t.teal, cursor: 'pointer' }}>search the corpus →</span>
      </div>
    </div>
  );
}

function SequenceStop({ stop: s, t, isLast }) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      {/* Stop card */}
      <div style={{
        background: t.bgPanel,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: 14,
        display: 'grid',
        gridTemplateColumns: '32px 120px 1fr',
        gap: 14,
      }}>
        {/* Drag handle + number */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 8,
        }}>
          <span style={{
            color: t.inkFaint, fontSize: 14,
            lineHeight: 1, cursor: 'grab',
            userSelect: 'none',
          }}>⋮⋮</span>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: t.terracotta, color: '#fff',
            fontFamily: t.serif, fontSize: 14, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{s.n}</div>
        </div>

        {/* Thumbnail */}
        <div style={{
          width: 120, height: 90,
          background: `repeating-linear-gradient(${30 + s.n * 22}deg, #C8B68F 0 6px, #B8A37A 6px 12px)`,
          borderRadius: 5,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', bottom: 4, left: 4,
            fontFamily: t.mono, fontSize: 9,
            color: 'rgba(26,24,20,0.55)',
            letterSpacing: 0.5,
          }}>{s.id}</div>
        </div>

        {/* Body */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10,
            marginBottom: 4,
          }}>
            <span style={{
              fontFamily: t.serif, fontSize: 16, fontWeight: 500,
              color: t.ink, letterSpacing: -0.1,
            }}>{s.title}</span>
            <span style={{
              fontFamily: t.mono, fontSize: 10.5,
              color: t.inkFaint,
            }}>{s.loc} · {s.dist}</span>
          </div>
          <textarea
            defaultValue={s.note}
            style={{
              ...textareaStyle(t, 44),
              marginTop: 4,
              fontSize: 12.5,
            }}
          />
          {s.comment && (
            <div style={{
              marginTop: 8,
              padding: '6px 9px',
              background: s.comment.resolved ? t.sageSoft : t.tealSoft,
              border: `1px solid ${s.comment.resolved ? t.sage + '30' : t.teal + '30'}`,
              borderRadius: 5,
              fontSize: 11.5,
              color: t.inkSubtle,
              display: 'flex', gap: 6,
            }}>
              <span style={{ fontWeight: 500, color: t.ink }}>{s.comment.who}:</span>
              <span style={{ flex: 1 }}>{s.comment.body}</span>
              {s.comment.resolved && <span style={{
                fontFamily: t.mono, fontSize: 9.5,
                color: t.sage, letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}>resolved</span>}
            </div>
          )}
        </div>
      </div>

      {/* Transition (between stops) */}
      {!isLast && (
        <div style={{
          margin: '8px 0 -2px 60px',
          padding: '6px 12px 6px 30px',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: 14, top: -4, bottom: -10,
            width: 2,
            background: `repeating-linear-gradient(180deg, ${t.border} 0 4px, transparent 4px 8px)`,
          }}/>
          <div style={{
            fontFamily: t.mono, fontSize: 10,
            letterSpacing: 1.2, textTransform: 'uppercase',
            color: t.inkMuted, marginBottom: 3,
          }}>Transition</div>
          <input
            defaultValue={s.transition || '—'}
            placeholder="Walking direction note for this leg…"
            style={{
              ...inputStyle(t),
              height: 28, fontSize: 12,
              border: `1px solid ${s.transition ? t.borderSoft : t.borderSoft}`,
              background: t.bgSurface,
              fontStyle: s.transition ? 'normal' : 'italic',
              color: s.transition ? t.inkSubtle : t.inkFaint,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Right: preview-as-patron pane ───────────────────────────

function StoryPreviewPane() {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      background: t.bgInk,
      color: '#E8DFCE',
      overflow: 'auto',
      padding: 18,
      borderLeft: `1px solid ${t.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: t.mono, fontSize: 10,
          letterSpacing: 1.4, textTransform: 'uppercase',
          color: t.inkFaint,
        }}>Preview · as patron</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <DeviceBtn icon="phone" active/>
          <DeviceBtn icon="desktop"/>
        </div>
      </div>

      {/* Phone preview */}
      <div style={{
        margin: '0 auto',
        width: 252, height: 460,
        background: t.bg,
        borderRadius: 22,
        border: `8px solid #0A0805`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute', top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: 80, height: 16,
          background: '#0A0805',
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
          zIndex: 2,
        }}/>
        {/* Map background */}
        <div style={{
          height: 180,
          background: `
            linear-gradient(90deg, transparent 49.7%, rgba(26,24,20,0.06) 49.7%, rgba(26,24,20,0.06) 50.3%, transparent 50.3%),
            radial-gradient(circle at 40% 60%, #DDD0B3 0%, #C8B68F 100%)
          `,
          position: 'relative',
        }}>
          {/* Trail line */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d="M30 130 Q60 100 90 90 T160 70 T220 50" stroke="#A8362B" strokeWidth="2" fill="none" strokeDasharray="3 3" strokeLinecap="round"/>
            {[
              { x: 30, y: 130, n: 1 },
              { x: 80, y: 95, n: 2 },
              { x: 130, y: 78, n: 3 },
              { x: 180, y: 60, n: 4 },
              { x: 220, y: 50, n: 5 },
            ].map(p => (
              <g key={p.n}>
                <circle cx={p.x} cy={p.y} r="9" fill="#A8362B" stroke="#fff" strokeWidth="1.5"/>
                <text x={p.x} y={p.y + 3} fontFamily="'Spectral', serif" fontSize="9" fill="#fff" textAnchor="middle" fontWeight="500">{p.n}</text>
              </g>
            ))}
          </svg>
        </div>
        {/* Body */}
        <div style={{
          padding: '14px 14px 0',
          color: t.ink,
          fontFamily: t.sans,
        }}>
          <div style={{
            fontFamily: t.mono, fontSize: 8,
            letterSpacing: 1, textTransform: 'uppercase',
            color: t.inkMuted, marginBottom: 4,
          }}>Map trail · 5 stops · 5.2 mi</div>
          <div style={{
            fontFamily: t.serif, fontSize: 18, fontWeight: 500,
            letterSpacing: -0.2, lineHeight: 1.15,
            color: t.ink, marginBottom: 5,
            textWrap: 'pretty',
          }}>Streetcars of Detroit Avenue</div>
          <div style={{
            fontSize: 11, color: t.inkSubtle, lineHeight: 1.4,
            textWrap: 'pretty',
          }}>From horse-drawn cars to the last electric line: forty years of one street's spine.</div>

          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: `1px solid ${t.borderSoft}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: t.terracotta, color: '#fff',
              fontFamily: t.serif, fontSize: 12, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>1</div>
            <div style={{ flex: 1, lineHeight: 1.25 }}>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: t.ink }}>1882 — Horse cars on Detroit</div>
              <div style={{ fontFamily: t.mono, fontSize: 8.5, color: t.inkMuted, marginTop: 1 }}>W 25th & Detroit · 0.0 mi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation notes */}
      <div style={{ marginTop: 18 }}>
        <div style={{
          fontFamily: t.mono, fontSize: 10,
          letterSpacing: 1.4, textTransform: 'uppercase',
          color: t.inkFaint, marginBottom: 8,
        }}>Pre-publish checks</div>
        <CheckRow tone="ok" label="All 5 stops have geo + caption"/>
        <CheckRow tone="ok" label="Year range matches photos"/>
        <CheckRow tone="warn" label="Stop 4 has no transition note"/>
        <CheckRow tone="warn" label="Cover image not chosen — defaults to stop 1"/>
        <CheckRow tone="ok" label="Alt text on all photos"/>
      </div>

      <div style={{
        marginTop: 18,
        padding: 12,
        background: 'rgba(246,242,235,0.05)',
        border: '1px solid rgba(246,242,235,0.10)',
        borderRadius: 8,
        fontSize: 11.5, lineHeight: 1.45,
        color: '#C9BFA9',
        textWrap: 'pretty',
      }}>
        <span style={{ color: '#F6F2EB', fontWeight: 500 }}>Publish ships immediately.</span> Drafts stay private. You can revert from the version history within 30 days.
      </div>
    </div>
  );
}

function DeviceBtn({ icon, active }) {
  const t = STAFF_TOKENS;
  const glyph = icon === 'phone'
    ? <svg width="11" height="11" viewBox="0 0 11 11"><rect x="3" y="1" width="5" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5 8.5h1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
    : <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="2" width="9" height="6" rx="0.8" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M4 9.5h3M5.5 8v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
  return (
    <button style={{
      width: 24, height: 24, borderRadius: 4,
      background: active ? 'rgba(246,242,235,0.12)' : 'transparent',
      border: 'none', cursor: 'pointer',
      color: active ? '#F6F2EB' : '#9A8E76',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{glyph}</button>
  );
}

function CheckRow({ tone, label }) {
  const t = STAFF_TOKENS;
  const map = {
    ok: { c: t.sage, glyph: <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 6 L4.5 8.5 L9 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    warn: { c: t.ochre, glyph: <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1 L10 9.5 H1z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><path d="M5.5 4.5v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="5.5" cy="8.4" r="0.6" fill="currentColor"/></svg> },
  };
  const m = map[tone];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0',
      fontSize: 11.5,
      color: '#E8DFCE',
    }}>
      <span style={{ color: m.c, display: 'inline-flex' }}>{m.glyph}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </div>
  );
}

Object.assign(window, { StaffStoryAuthor });
