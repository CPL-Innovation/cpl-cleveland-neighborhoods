"use client";
import React from "react";
import { STAFF_TOKENS } from "@/lib/tokens";
import type { StaffTokens } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import type { StaffRecord } from "@/components/staff/nav";

// Photos list — spreadsheet mode with filters, saved views, bulk actions.

// Source filter — the only functional filter so far (box-scan vs ContentDM in the unified table).
export type SourceFilter = "all" | "box_scan" | "contentdm";
function recordSource(r: StaffRecord): "box_scan" | "contentdm" {
  return r.source === "box_scan" ? "box_scan" : "contentdm"; // sample/legacy rows read as ContentDM
}

export function StaffPhotosList() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const hasSelection = nav && nav.selection && nav.selection.size > 0;
  const [source, setSource] = React.useState<SourceFilter>("all");
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: t.bg, overflow: 'hidden',
    }}>
      <PhotosFilterBar source={source} setSource={setSource} />
      {hasSelection && <PhotosBulkBar />}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex',
      }}>
        <PhotosSavedViews />
        <PhotosSheet source={source} />
      </div>
    </div>
  );
}

function PhotosFilterBar({ source, setSource }: { source: SourceFilter; setSource: (s: SourceFilter) => void }) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const all = nav?.records || [];
  const counts = {
    all: all.length,
    box_scan: all.filter((r) => recordSource(r) === "box_scan").length,
    contentdm: all.filter((r) => recordSource(r) === "contentdm").length,
  };
  return (
    <div style={{
      padding: '12px 24px',
      background: t.bgSurface,
      borderBottom: `1px solid ${t.borderSoft}`,
      display: 'flex', alignItems: 'center', gap: 10,
      flexWrap: 'wrap',
      flexShrink: 0,
    }}>
      {/* Source — functional segmented filter over the unified Photos table */}
      <div style={{ display: 'flex', border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        <SourceBtn label="All" count={counts.all} active={source === 'all'} onClick={() => setSource('all')} t={t} />
        <SourceBtn label="Box-scan" count={counts.box_scan} active={source === 'box_scan'} onClick={() => setSource('box_scan')} t={t} />
        <SourceBtn label="ContentDM" count={counts.contentdm} active={source === 'contentdm'} onClick={() => setSource('contentdm')} t={t} />
      </div>
      <FilterChip label="Neighborhood" value="Tremont" />
      <FilterChip label="Public status" value="any" />
      <FilterChip label="Has geo" value="missing" highlight/>
      <FilterChip label="Year" value="any" />
      <FilterChip label="Caption quality" value="any" />
      <FilterChip label="+ Add filter" add/>

      <div style={{ flex: 1 }}/>

      <div style={{
        display: 'flex', border: `1px solid ${t.border}`,
        borderRadius: 5, overflow: 'hidden', background: '#fff',
      }}>
        <ViewBtn icon="sheet" label="Sheet" active/>
        <ViewBtn icon="grid" label="Grid"/>
        <ViewBtn icon="map" label="Map"/>
      </div>

      <button style={{
        height: 30, padding: '0 12px',
        background: '#fff', border: `1px solid ${t.border}`,
        borderRadius: 5, fontSize: 12, color: t.ink,
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 3h7M3.5 5.5h4M4.5 8h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        Sort
      </button>
      <button style={{
        height: 30, padding: '0 12px',
        background: '#fff', border: `1px solid ${t.border}`,
        borderRadius: 5, fontSize: 12, color: t.ink,
        cursor: 'pointer', fontFamily: 'inherit',
      }}>Export ↓</button>
    </div>
  );
}

function SourceBtn({ label, count, active, onClick, t }: { label: string; count: number; active?: boolean; onClick: () => void; t: StaffTokens }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 11px',
      background: active ? t.ink : 'transparent',
      color: active ? '#F6F2EB' : t.ink,
      border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      <span style={{
        fontFamily: t.mono, fontSize: 10,
        color: active ? '#F6F2EB' : t.inkFaint,
        background: active ? 'rgba(246,242,235,0.18)' : t.bg,
        borderRadius: 8, padding: '0 5px', lineHeight: '15px', minWidth: 14, textAlign: 'center',
      } as React.CSSProperties}>{count}</span>
    </button>
  );
}

function ViewBtn({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  const t = STAFF_TOKENS;
  const glyph = ({
    sheet: <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="1.5" width="9" height="8" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1 4.5h9M1 7h9M4 1.5v8" stroke="currentColor" strokeWidth="1.2"/></svg>,
    grid: <svg width="11" height="11" viewBox="0 0 11 11"><rect x="1" y="1" width="3.5" height="3.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="6.5" y="1" width="3.5" height="3.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="1" y="6.5" width="3.5" height="3.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="6.5" y="6.5" width="3.5" height="3.5" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>,
    map: <svg width="11" height="11" viewBox="0 0 11 11"><path d="M1 3l3-1.5 3.5 1.5L10 1.5v6.5L7 9.5 3.5 8 1 9.5z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><path d="M4 2v6M7 3v6" stroke="currentColor" strokeWidth="1.2"/></svg>,
  } as Record<string, React.ReactNode>)[icon];
  return (
    <button style={{
      padding: '6px 10px',
      background: active ? t.ink : 'transparent',
      color: active ? '#F6F2EB' : t.ink,
      border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 12,
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <span style={{ display: 'inline-flex' }}>{glyph}</span>
      {label}
    </button>
  );
}

function FilterChip({ label, value, highlight, add }: { label: string; value?: string; highlight?: boolean; add?: boolean }) {
  const t = STAFF_TOKENS;
  if (add) {
    return (
      <button style={{
        height: 28, padding: '0 10px',
        background: 'transparent',
        border: `1px dashed ${t.border}`,
        borderRadius: 14,
        fontSize: 12, color: t.inkMuted,
        cursor: 'pointer', fontFamily: 'inherit',
      }}>{label}</button>
    );
  }
  return (
    <button style={{
      height: 28, padding: '0 4px 0 10px',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: highlight ? t.terracotta + '12' : '#fff',
      border: `1px solid ${highlight ? t.terracotta + '55' : t.border}`,
      borderRadius: 14,
      fontSize: 12, color: t.ink,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <span style={{ color: t.inkMuted }}>{label}</span>
      <span style={{
        fontWeight: 500,
        color: highlight ? t.terracotta : t.ink,
      }}>{value}</span>
      <span style={{
        width: 18, height: 18, borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: t.inkFaint, fontSize: 14, lineHeight: 1,
      }}>×</span>
    </button>
  );
}

function PhotosBulkBar() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const n = nav.selection ? nav.selection.size : 0;
  return (
    <div style={{
      padding: '8px 24px',
      background: t.tealSoft,
      borderBottom: `1px solid ${t.teal + '33'}`,
      display: 'flex', alignItems: 'center', gap: 14,
      fontSize: 12.5,
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: t.mono, fontSize: 11,
        color: t.teal, letterSpacing: 0.4,
      }}>
        <b style={{ fontWeight: 600 }}>{n} selected</b> · of 22 matching
      </span>
      <span style={{ color: t.borderSoft }}>·</span>
      <BulkAction onClick={() => nav.toast(`Neighborhood set on ${n} records`, 'ok')}>Set neighborhood…</BulkAction>
      <BulkAction onClick={() => nav.toast(`Theme added to ${n} records`, 'ok')}>Add theme…</BulkAction>
      <BulkAction onClick={() => nav.toast(`${n} records → public-ready`, 'ok')}>Set status → public-ready</BulkAction>
      <BulkAction onClick={() => nav.toast(`${n} records assigned to Lisa`, 'ok')}>Assign to Lisa</BulkAction>
      <div style={{ flex: 1 }}/>
      <button
        onClick={() => nav.clearSelection()}
        style={{
          background: 'transparent', border: 'none',
          color: t.teal, fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>Clear selection</button>
    </div>
  );
}

function BulkAction({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const t = STAFF_TOKENS;
  return (
    <button onClick={onClick} style={{
      height: 24, padding: '0 10px',
      background: '#fff',
      border: `1px solid ${t.teal + '40'}`,
      borderRadius: 4,
      fontSize: 11.5, color: t.teal,
      cursor: 'pointer', fontFamily: 'inherit',
      fontWeight: 500,
    }}>{children}</button>
  );
}

function PhotosSavedViews() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const cur = nav.savedView || 'Tremont · missing geo';
  const views = [
    { name: 'All photos', count: '12,408' },
    { name: 'My drafts', count: '8', mine: true },
    { name: 'Tremont · missing geo', count: '22', mine: true },
    { name: 'Pre-1931 · no caption', count: '48', mine: true },
    { name: 'Ready for Lisa to theme', count: '6', mine: true },
    { name: 'Patron contributions flagged', count: '8', shared: true },
    { name: 'Public-ready · missing alt', count: '22', shared: true },
    { name: 'Stale · pre-2024', count: '117', shared: true },
  ].map(v => ({ ...v, active: v.name === cur }));
  return (
    <aside style={{
      width: 220,
      borderRight: `1px solid ${t.border}`,
      background: t.bgSurface,
      padding: '14px 10px',
      overflow: 'auto',
      flexShrink: 0,
    }}>
      <div style={{
        fontFamily: t.mono, fontSize: 10,
        letterSpacing: 1.4, textTransform: 'uppercase',
        color: t.inkMuted, padding: '4px 8px 6px',
      }}>Mine</div>
      {views.filter(v => v.mine || !v.shared && !v.mine).slice(0,4).map(v => <SavedView key={v.name} {...v}/>)}
      <div style={{
        fontFamily: t.mono, fontSize: 10,
        letterSpacing: 1.4, textTransform: 'uppercase',
        color: t.inkMuted, padding: '14px 8px 6px',
      }}>Shared</div>
      {views.filter(v => v.shared).map(v => <SavedView key={v.name} {...v}/>)}

      <button style={{
        marginTop: 14, width: '100%',
        height: 28, background: 'transparent',
        border: `1px dashed ${t.border}`,
        borderRadius: 5, fontSize: 11.5,
        color: t.inkMuted, cursor: 'pointer', fontFamily: 'inherit',
      }}>+ Save current view</button>
    </aside>
  );
}

function SavedView({ name, count, active }: { name: string; count: string; active?: boolean }) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  return (
    <div
      onClick={() => nav.navigate('photos', { savedView: name })}
      style={{
        padding: '6px 8px',
        borderRadius: 5,
        background: active ? '#fff' : 'transparent',
        border: active ? `1px solid ${t.border}` : '1px solid transparent',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12.5, color: t.ink,
        cursor: 'pointer',
        marginBottom: 1,
      }}>
      <span style={{ flex: 1, fontWeight: active ? 500 : 400 }}>{name}</span>
      <span style={{
        fontFamily: t.mono, fontSize: 10.5,
        color: t.inkFaint,
      }}>{count}</span>
    </div>
  );
}

function PhotosSheet({ source = "all" }: { source?: SourceFilter }) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const selection = nav?.selection || new Set();
  const sourceRecords = nav?.records || null;
  const filtered = sourceRecords && source !== "all"
    ? sourceRecords.filter(r => recordSource(r) === source)
    : sourceRecords;
  const rowsFromCtx = filtered ? filtered.map(r => ({ ...r, selected: selection.has(r.id) })) : null;
  const rows: StaffRecord[] = rowsFromCtx || [
    { id: 'cpl_011_4738', thumb: 1, title: 'Euclid Ave looking east', year: 'c.1915', nbhd: '—', themes: ['streetcars'], geo: 'missing', conf: '—', caption: 'good', status: 'draft', alt: '—', notes: 2, selected: true },
    { id: 'cpl_011_4742', thumb: 2, title: 'Euclid Ave, same block, ~6mo later', year: 'c.1915', nbhd: '—', themes: ['streetcars'], geo: 'missing', conf: '—', caption: 'placeholder', status: 'draft', alt: '—', notes: 0, selected: true },
    { id: 'cpl_011_5108', thumb: 3, title: "Statler Hotel, Lobby", year: '1912', nbhd: 'Downtown', themes: ['hotels','interiors'], geo: 'missing', conf: '—', caption: 'good', status: 'review', alt: '—', notes: 1, selected: false },
    { id: 'cpl_011_3994', thumb: 4, title: 'Streetcars at Public Square', year: '1916', nbhd: 'Downtown', themes: ['streetcars','public-space'], geo: 'missing', conf: '—', caption: 'good', status: 'draft', alt: 'ok', notes: 0, selected: true },
    { id: 'cpl_011_3995', thumb: 5, title: 'Cleveland Trust Rotunda', year: '1907', nbhd: 'Downtown', themes: ['banks','architecture'], geo: 'block', conf: '2', caption: 'good', status: 'ready', alt: 'ok', notes: 0, selected: false, doneGeo: true },
    { id: 'cpl_011_4101', thumb: 6, title: '(no caption — cataloger fields only)', year: 'c.1910', nbhd: '—', themes: [], geo: 'missing', conf: '—', caption: 'rewrite', status: 'draft', alt: '—', notes: 3, selected: false, needsRewrite: true },
    { id: 'cpl_011_4205', thumb: 7, title: 'Detroit Ave at W 25th, looking south', year: '1922', nbhd: 'Ohio City', themes: ['streetcars','commerce'], geo: 'missing', conf: '—', caption: 'good', status: 'review', alt: 'ok', notes: 1, selected: true },
    { id: 'cpl_011_4506', thumb: 8, title: 'West Side Market, exterior', year: 'c.1920', nbhd: 'Ohio City', themes: ['markets'], geo: 'block', conf: '2', caption: 'good', status: 'ready', alt: 'ok', notes: 0, selected: false, doneGeo: true },
    { id: 'cpl_011_4607', thumb: 9, title: 'Tremont Methodist, Lincoln Park', year: '1908', nbhd: 'Tremont', themes: ['religion'], geo: 'missing', conf: '—', caption: 'placeholder', status: 'draft', alt: '—', notes: 0, selected: false },
    { id: 'cpl_011_4711', thumb: 10, title: 'Lincoln Park Bandstand, summer evening', year: '1910', nbhd: 'Tremont', themes: ['public-space','music'], geo: 'inter', conf: '3', caption: 'good', status: 'review', alt: 'ok', notes: 2, selected: false, doneGeo: true },
    { id: 'cpl_011_4720', thumb: 11, title: 'Pilgrim Church, southwest corner', year: 'c.1912', nbhd: 'Tremont', themes: ['religion','architecture'], geo: 'missing', conf: '—', caption: 'good', status: 'draft', alt: '—', notes: 0, selected: false },
    { id: 'cpl_011_4801', thumb: 12, title: 'Steel mill workers, Tremont overlook', year: '1919', nbhd: 'Tremont', themes: ['industry','labor'], geo: 'missing', conf: '—', caption: 'rewrite', status: 'draft', alt: '—', notes: 1, selected: false, needsRewrite: true },
  ];
  const cols: { id: string; w: number; label: string }[] = [
    { id: 'check', w: 36, label: '' },
    { id: 'thumb', w: 56, label: '' },
    { id: 'id',    w: 110, label: 'ID' },
    { id: 'title', w: 320, label: 'Title / caption' },
    { id: 'year',  w: 80, label: 'Year' },
    { id: 'nbhd',  w: 100, label: 'Neighborhood' },
    { id: 'themes',w: 200, label: 'Themes' },
    { id: 'geo',   w: 92, label: 'Geo' },
    { id: 'conf',  w: 56, label: 'Conf.' },
    { id: 'cap',   w: 92, label: 'Caption' },
    { id: 'status',w: 96, label: 'Status' },
    { id: 'alt',   w: 60, label: 'Alt' },
    { id: 'notes', w: 50, label: '⌘' },
  ];
  return (
    <div style={{
      flex: 1, minWidth: 0,
      overflow: 'auto',
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        position: 'sticky', top: 0, zIndex: 2,
        background: t.bgSurface,
        borderBottom: `1px solid ${t.border}`,
        fontFamily: t.mono, fontSize: 10.5,
        color: t.inkMuted, letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        {cols.map(c => (
          <div key={c.id} style={{
            width: c.w, flexShrink: 0,
            padding: c.id === 'thumb' ? 4 : '8px 10px',
            borderRight: `1px solid ${t.borderSoft}`,
            display: 'flex', alignItems: 'center',
          }}>
            {c.id === 'check' ? (
              <Checkbox indeterminate/>
            ) : c.label}
          </div>
        ))}
      </div>

      {rows.map((r, i) => <SheetRow key={r.id} row={r} i={i} cols={cols} t={t}/>)}

      {/* Footer */}
      <div style={{
        padding: '14px 24px',
        fontFamily: t.mono, fontSize: 11,
        color: t.inkFaint, letterSpacing: 0.3,
        textAlign: 'center',
        borderTop: `1px solid ${t.borderSoft}`,
      }}>
        {source === 'all' ? `${rows.length} photographs` : `${rows.length} ${source === 'box_scan' ? 'box-scan' : 'ContentDM'} photographs`} · scroll or ⌘↓ for more
      </div>
    </div>
  );
}

function SheetRow({ row, i, cols, t }: { row: StaffRecord; i: number; cols: { id: string; w: number; label: string }[]; t: StaffTokens }) {
  const r = row;
  const nav = useNav();
  return (
    <div
      onClick={() => nav.navigate('record', { id: r.id })}
      style={{
        display: 'flex',
        borderBottom: `1px solid ${t.borderSoft}`,
        background: r.selected ? t.tealSoft + '88' : (i % 2 ? '#FCFAF5' : '#fff'),
        fontSize: 12.5,
        minHeight: 44,
        alignItems: 'stretch',
        cursor: 'pointer',
      }}>
      {cols.map(c => (
        <div
          key={c.id}
          onClick={c.id === 'check' ? (e) => { e.stopPropagation(); nav.toggleSelect(r.id); } : undefined}
          style={{
            width: c.w, flexShrink: 0,
            padding: c.id === 'thumb' ? 4 : '8px 10px',
            borderRight: `1px solid ${t.borderSoft}`,
            display: 'flex', alignItems: 'center', gap: 4,
            minWidth: 0,
          }}>
          <CellContent col={c.id} r={r} t={t}/>
        </div>
      ))}
    </div>
  );
}

function CellContent({ col, r, t }: { col: string; r: StaffRecord; t: StaffTokens }) {
  switch (col) {
    case 'check': return <Checkbox checked={r.selected}/>;
    case 'thumb': return r.thumbUrl ? (
      <img src={r.thumbUrl} alt="" loading="lazy" style={{
        width: 48, height: 36, objectFit: 'cover',
        borderRadius: 3, background: '#1A1814', display: 'block',
      }}/>
    ) : (
      <div style={{
        width: 48, height: 36,
        background: `repeating-linear-gradient(${30 + (r.thumb ?? 0) * 15}deg, #C8B68F 0 4px, #B8A37A 4px 8px)`,
        borderRadius: 3,
      } as React.CSSProperties}/>
    );
    case 'id': return <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkMuted }}>{r.id}</span>;
    case 'title': return (
      <span style={{
        color: r.title.startsWith('(') ? t.inkFaint : t.ink,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontStyle: r.title.startsWith('(') ? 'italic' : 'normal',
      } as React.CSSProperties}>{r.title}</span>
    );
    case 'year': return <span style={{ fontFamily: t.mono, fontSize: 11.5, color: t.ink }}>{r.year}</span>;
    case 'nbhd': return r.nbhd === '—'
      ? <span style={{ color: t.inkFaint }}>—</span>
      : <span style={{
          background: t.bg, padding: '2px 7px',
          borderRadius: 10, fontSize: 11,
          border: `1px solid ${t.borderSoft}`,
        }}>{r.nbhd}</span>;
    case 'themes': return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' }}>
        {(r.themes ?? []).length === 0 ? <span style={{ color: t.inkFaint }}>—</span> :
          (r.themes ?? []).map(th => (
            <span key={th} style={{
              background: t.tealSoft, color: t.teal,
              fontSize: 10.5, padding: '2px 6px',
              borderRadius: 3, whiteSpace: 'nowrap',
            }}>{th}</span>
          ))}
      </div>
    );
    case 'geo': return <GeoCell value={r.geo ?? ''} t={t}/>;
    case 'conf': return r.conf === '—'
      ? <span style={{ color: t.inkFaint }}>—</span>
      : <span style={{
          fontFamily: t.mono, fontSize: 11, color: t.ink,
          background: t.tealSoft, padding: '2px 6px', borderRadius: 3,
        }}>{r.conf}</span>;
    case 'cap': return <CaptionCell value={r.caption ?? ''} t={t}/>;
    case 'status': return <StatusCell value={r.status ?? ''} t={t}/>;
    case 'alt': return r.alt === '—'
      ? <span style={{ color: t.inkFaint }}>—</span>
      : <span style={{ color: t.sage, fontSize: 11 }}>✓</span>;
    case 'notes': return (r.notes ?? 0) > 0
      ? <span style={{
          fontFamily: t.mono, fontSize: 10.5,
          color: t.ochre,
        }}>💬 {r.notes}</span>
      : <span style={{ color: t.inkFaint }}>—</span>;
    default: return null;
  }
}

function Checkbox({ checked, indeterminate }: { checked?: boolean; indeterminate?: boolean }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      width: 14, height: 14,
      border: `1.4px solid ${checked || indeterminate ? t.teal : t.border}`,
      borderRadius: 3,
      background: checked || indeterminate ? t.teal : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
    }}>
      {checked && (
        <svg width="9" height="9" viewBox="0 0 9 9">
          <path d="M1.5 4.5 L3.5 6.5 L7.5 2" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {indeterminate && !checked && (
        <div style={{ width: 7, height: 1.6, background: '#fff' }}/>
      )}
    </div>
  );
}

function GeoCell({ value, t }: { value: string; t: StaffTokens }) {
  if (value === 'missing') {
    return <span style={{
      fontSize: 11, color: t.terracotta,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.terracotta }}/>
      missing
    </span>;
  }
  return <span style={{ fontSize: 11, color: t.sage }}>{value}</span>;
}

function CaptionCell({ value, t }: { value: string; t: StaffTokens }) {
  const map: Record<string, { c: string; label: string }> = {
    good: { c: t.sage, label: 'good' },
    ok: { c: t.ochre, label: 'ok' },
    placeholder: { c: t.inkFaint, label: 'placeholder' },
    rewrite: { c: t.terracotta, label: 'rewrite' },
  };
  const m = map[value] || map.placeholder;
  return <span style={{ fontSize: 11, color: m.c }}>{m.label}</span>;
}

function StatusCell({ value, t }: { value: string; t: StaffTokens }) {
  const map: Record<string, { c: string; label: string }> = {
    draft: { c: t.draft, label: 'draft' },
    review: { c: t.ochre, label: 'for review' },
    ready: { c: t.sage, label: 'public-ready' },
  };
  const m = map[value] || map.draft;
  return (
    <span style={{
      fontSize: 10.5,
      color: m.c,
      background: m.c + '15',
      padding: '2px 7px', borderRadius: 3,
      whiteSpace: 'nowrap',
      fontWeight: 500,
    }}>{m.label}</span>
  );
}
