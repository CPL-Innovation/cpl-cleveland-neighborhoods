// MobileLanding — wordmark + hamburger header, full-bleed map below,
// geolocation pill top-right (larger touch target), Story-of-the-week
// as a collapsible bottom-sheet peek. Lives inside <IOSDevice>.

function MobileLanding() {
  return (
    <IOSDevice width={402} height={874}>
      <div style={{
        position: 'absolute', inset: 0,
        background: '#FFFFFF',
        fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#1A1814',
        display: 'flex', flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
      }}>
        {/* Status bar buffer */}
        <div style={{ height: 54 }} />

        {/* Header */}
        <div style={{
          height: 54,
          padding: '0 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #D6CDBD',
          background: '#F6F2EB',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontWeight: 460,
              fontSize: 20,
              letterSpacing: -0.3,
              lineHeight: 1,
              color: '#1A1814',
            }}>
              Cleveland&nbsp;Neighborhoods
            </div>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, serif",
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 11,
              letterSpacing: 0.1,
              lineHeight: 1,
              color: '#6B6359',
            }}>
              A century of Cleveland, mapped to the corner.
            </div>
          </div>
          <button style={{
            width: 40, height: 40, borderRadius: 20,
            border: '1px solid #D6CDBD',
            background: '#FFFFFF',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: 0,
          }}>
            <span style={{ width: 14, height: 1.5, background: '#1A1814' }} />
            <span style={{ width: 14, height: 1.5, background: '#1A1814' }} />
            <span style={{ width: 14, height: 1.5, background: '#1A1814' }} />
          </button>
        </div>

        {/* Map area */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <ClevelandMap width={402} height={760} showLabels />

          {/* Geolocation pill — bigger touch target on mobile */}
          <div style={{
            position: 'absolute', top: 16, right: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            height: 44, padding: '0 18px 0 16px',
            background: '#FFFFFF',
            border: '1px solid #D6CDBD',
            borderRadius: 999,
            boxShadow: '0 2px 12px rgba(26,24,20,0.08)',
            fontSize: 14, color: '#1A1814', fontWeight: 500,
          }}>
            <LocationGlyph />
            <span>Photos near you</span>
          </div>

          {/* Featured story sticker on a Millionaire's Row dot */}
          <FeaturedDotCallout />

          {/* Onboarding micro-tour — dismissable top whisper */}
          <div style={{
            position: 'absolute', top: 76, left: 16, right: 16,
            padding: '10px 14px',
            background: 'rgba(26,24,20,0.86)',
            color: '#F6F2EB',
            borderRadius: 10,
            fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 2px 12px rgba(26,24,20,0.18)',
          }}>
            <span style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
              color: '#C8983A',
            }}>30 sec</span>
            <span style={{ flex: 1, lineHeight: 1.35 }}>
              Drag the time slider. Tap a dot. Find your street.
            </span>
            <button style={{
              background: 'none', border: 'none', color: '#F6F2EB', opacity: 0.7,
              fontSize: 18, lineHeight: 1, padding: 0, cursor: 'pointer',
            }}>×</button>
          </div>
        </div>

        {/* Bottom sheet peek — Story of the Week */}
        <MobileStorySheet />
      </div>
    </IOSDevice>
  );
}

function FeaturedDotCallout() {
  return (
    <div style={{
      position: 'absolute',
      // matches a Millionaire's Row dot's position inside the SVG viewBox 1200×700
      // map renders at 402×760: scaleX = 402/1200, scaleY = 760/700.
      // dot at (780,280) → (~261, ~304)
      top: 304, left: 261,
      transform: 'translate(-50%, -100%)',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: '#1A1814',
        color: '#F6F2EB',
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(26,24,20,0.2)',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, color: '#C8983A', letterSpacing: 0.4,
          textTransform: 'uppercase', marginRight: 6,
        }}>Featured</span>
        Millionaire's Row
      </div>
      <div style={{
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid #1A1814',
        marginLeft: 14,
      }} />
    </div>
  );
}

function MobileStorySheet() {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: '#FFFFFF',
      borderTop: '1px solid #D6CDBD',
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingBottom: 38,    // home indicator clearance
      boxShadow: '0 -4px 24px rgba(26,24,20,0.06)',
      zIndex: 5,
    }}>
      {/* Sheet handle */}
      <div style={{
        display: 'flex', justifyContent: 'center', padding: '8px 0 4px',
      }}>
        <div style={{
          width: 38, height: 4, borderRadius: 2,
          background: '#D6CDBD',
        }} />
      </div>

      {/* Filter row */}
      <div style={{
        display: 'flex', gap: 8, padding: '4px 18px 14px',
        overflowX: 'auto',
      }}>
        <Chip active>1903 – 1935</Chip>
        <Chip>All neighborhoods</Chip>
        <Chip>Themes</Chip>
      </div>

      {/* Story preview */}
      <div style={{
        display: 'flex', gap: 14,
        padding: '0 18px 14px',
        alignItems: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 8,
          flexShrink: 0,
          background: 'repeating-linear-gradient(135deg, #C8B68F 0 6px, #B8A37A 6px 12px)',
          border: '1px solid #D6CDBD',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
            color: '#A39684', marginBottom: 4,
          }}>
            Story of the week
          </div>
          <div style={{
            fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
            fontWeight: 500,
            fontSize: 18,
            letterSpacing: -0.2,
            lineHeight: 1.15,
            color: '#1A1814',
            marginBottom: 3,
          }}>
            Millionaire's Row
          </div>
          <div style={{
            fontSize: 13, color: '#3D3833', lineHeight: 1.35,
            textWrap: 'pretty',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
          }}>
            The mansions Euclid Avenue lost.
          </div>
        </div>
        <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
          <path d="M2 2l8 8-8 8" stroke="#A39684" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

function Chip({ children, active }) {
  return (
    <div style={{
      flexShrink: 0,
      height: 32,
      padding: '0 14px',
      display: 'flex', alignItems: 'center',
      borderRadius: 16,
      fontSize: 13,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      ...(active
        ? { background: '#1A1814', color: '#F6F2EB' }
        : { background: '#FFFFFF', color: '#3D3833', border: '1px solid #D6CDBD' }),
    }}>{children}</div>
  );
}

Object.assign(window, { MobileLanding });
