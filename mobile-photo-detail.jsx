// MobilePhotoDetail — opened from a dot tap. Pan/zoom hero photo, then-and-now
// toggle (the high-impact micro-interaction), provenance, neighbors-in-time,
// memory thread invitation. All copy follows the voice & tone in the spec.

function MobilePhotoDetail() {
  return (
    <IOSDevice width={402} height={874}>
      <div style={{
        position: 'absolute', inset: 0,
        background: '#FFFFFF',
        color: '#1A1814',
        fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: 'flex', flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
        overflow: 'hidden',
      }}>
        {/* status bar buffer */}
        <div style={{ height: 54 }} />

        {/* Detail header */}
        <div style={{
          height: 52, padding: '0 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: '1px solid #EEE6D6',
          background: '#FFFFFF',
        }}>
          <CircleBtn>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 2L3 7l6 5" stroke="#1A1814" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </CircleBtn>
          <div style={{
            flex: 1,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, color: '#6B6359',
            letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'center',
          }}>
            CPL-PC-0184
          </div>
          <CircleBtn>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 5l4 4 4-4" stroke="#1A1814" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </CircleBtn>
          <CircleBtn>
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="3.5" cy="7" r="1" fill="#1A1814"/><circle cx="7" cy="7" r="1" fill="#1A1814"/><circle cx="10.5" cy="7" r="1" fill="#1A1814"/></svg>
          </CircleBtn>
        </div>

        {/* Scrolling content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Hero photo */}
          <div style={{
            position: 'relative',
            height: 280,
            background: '#1A1814',
            flexShrink: 0,
          }}>
            {/* placeholder photo — diagonal hatch */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(135deg, #2B2620 0 10px, #34302A 10px 20px)',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 11, color: '#7A746B', letterSpacing: 0.6, textTransform: 'uppercase',
            }}>
              [ Detroit Ave at W. 25th, c. 1922 ]
            </div>

            {/* Then / Now toggle — the headline micro-interaction */}
            <div style={{
              position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(26,24,20,0.78)',
              backdropFilter: 'blur(8px)',
              borderRadius: 999,
              padding: 4,
              display: 'flex',
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}>
              <div style={{
                padding: '6px 16px', borderRadius: 999,
                background: '#F6F2EB', color: '#1A1814',
              }}>1922</div>
              <div style={{ padding: '6px 16px', color: '#F6F2EB', opacity: 0.85 }}>Now</div>
            </div>

            {/* Pan/zoom hint */}
            <div style={{
              position: 'absolute', top: 12, right: 12,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px',
              background: 'rgba(26,24,20,0.55)',
              borderRadius: 999,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, color: '#F6F2EB', letterSpacing: 0.6, textTransform: 'uppercase',
            }}>
              <ZoomGlyph />
              <span>Pinch to zoom</span>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 50 }}>
            {/* Title block */}
            <div style={{ padding: '20px 20px 12px' }}>
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 11, color: '#A8362B', letterSpacing: 0.6, textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                ● Public Domain (pre-1931)
              </div>
              <div style={{
                fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
                fontWeight: 500,
                fontSize: 26,
                lineHeight: 1.15,
                letterSpacing: -0.3,
                marginBottom: 6,
                textWrap: 'pretty',
              }}>
                Detroit Avenue at W. 25th
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 12, color: '#6B6359', letterSpacing: 0.2,
              }}>
                c. 1922 · Ohio City
              </div>
            </div>

            {/* Librarian's Note */}
            <div style={{
              margin: '4px 20px 18px',
              padding: '14px 16px 16px',
              background: '#F6F2EB',
              borderLeft: '2px solid #C8983A',
              borderRadius: '0 8px 8px 0',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#C8983A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif", fontSize: 12, color: '#1A1814',
                }}>B</div>
                <div style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 10, color: '#6B6359', letterSpacing: 0.6, textTransform: 'uppercase',
                }}>
                  Librarian's note · Brian K.
                </div>
              </div>
              <div style={{
                fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
                fontSize: 15, lineHeight: 1.5, color: '#1A1814',
                textWrap: 'pretty',
              }}>
                This building is gone. The corner is still here. The streetcar tracks
                visible at right ran through Ohio City until 1953 — the same route
                the Detroit-Superior bridge still follows.
              </div>
            </div>

            {/* Metadata grid */}
            <div style={{ padding: '0 20px 18px' }}>
              <MetaRow k="Photographer" v="unknown" />
              <MetaRow k="Date" v="c. 1922" />
              <MetaRow k="Collection" v="CPL Photograph Collection" />
              <MetaRow k="Held at" v="Carnegie West Branch" />
              <MetaRow k="Coordinates" v="41.484° N, 81.704° W" />
              <MetaRow k="Box / Folder" v="PC-014 · F.7" last />
            </div>

            {/* Actions */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
              padding: '0 20px 22px',
            }}>
              <ActionBtn>Cite</ActionBtn>
              <ActionBtn>Share</ActionBtn>
              <ActionBtn>Request scan</ActionBtn>
            </div>

            {/* Neighbors in time */}
            <div style={{
              borderTop: '1px solid #EEE6D6',
              padding: '18px 20px 14px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 11, color: '#1A1814', letterSpacing: 0.6, textTransform: 'uppercase',
                }}>Neighbors in time</div>
                <div style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 10, color: '#A39684',
                }}>1 block · ±5 yrs</div>
              </div>
              <div style={{
                display: 'flex', gap: 10, overflowX: 'auto',
                margin: '0 -20px', padding: '0 20px 4px',
              }}>
                {[
                  ['1919', 'W. 25th'],
                  ['1924', 'Lorain'],
                  ['1920', 'Market'],
                  ['1926', 'Bridge'],
                ].map(([y, p]) => (
                  <div key={y} style={{ width: 108, flexShrink: 0 }}>
                    <div style={{
                      width: 108, height: 84, borderRadius: 6,
                      background: 'repeating-linear-gradient(135deg, #C8B68F 0 6px, #B8A37A 6px 12px)',
                      border: '1px solid #D6CDBD',
                      marginBottom: 6,
                    }} />
                    <div style={{
                      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                      fontSize: 10, color: '#6B6359', letterSpacing: 0.4,
                    }}>{y} · {p}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Memory thread invitation */}
            <div style={{
              margin: '8px 20px 24px',
              padding: '16px',
              borderRadius: 10,
              border: '1px dashed #D6CDBD',
              background: 'transparent',
            }}>
              <div style={{
                fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
                fontSize: 17, lineHeight: 1.25, color: '#1A1814',
                marginBottom: 6, textWrap: 'pretty',
              }}>
                Do you remember this corner?
              </div>
              <div style={{
                fontSize: 13.5, color: '#3D3833', lineHeight: 1.45,
                marginBottom: 12, textWrap: 'pretty',
              }}>
                Librarians at CPL collect memories alongside the photographs.
                If you walked past here, tell us what you saw.
              </div>
              <button style={{
                height: 36, padding: '0 16px',
                background: '#1F5963', color: '#F6F2EB',
                border: 'none', borderRadius: 18,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}>Share a memory</button>
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function MetaRow({ k, v, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12,
      padding: '9px 0',
      borderBottom: last ? 'none' : '1px solid #EEE6D6',
      fontSize: 13,
    }}>
      <div style={{
        color: '#6B6359',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase',
        alignSelf: 'center',
      }}>{k}</div>
      <div style={{ color: '#1A1814', textAlign: 'right' }}>{v}</div>
    </div>
  );
}

function ActionBtn({ children }) {
  return (
    <button style={{
      height: 40,
      background: '#FFFFFF',
      border: '1px solid #D6CDBD',
      borderRadius: 8,
      fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 13, color: '#1A1814',
      fontWeight: 500,
      cursor: 'pointer',
    }}>{children}</button>
  );
}

function CircleBtn({ children }) {
  return (
    <button style={{
      width: 36, height: 36, borderRadius: 18,
      background: '#FFFFFF',
      border: '1px solid #D6CDBD',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 0, cursor: 'pointer',
    }}>{children}</button>
  );
}

function ZoomGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <circle cx="4.5" cy="4.5" r="3.5" stroke="#F6F2EB" strokeWidth="1.2"/>
      <path d="M7.5 7.5L10 10" stroke="#F6F2EB" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M3 4.5h3M4.5 3v3" stroke="#F6F2EB" strokeWidth="1"/>
    </svg>
  );
}

Object.assign(window, { MobilePhotoDetail });
