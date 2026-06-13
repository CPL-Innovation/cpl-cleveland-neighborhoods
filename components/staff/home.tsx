"use client";
import React from "react";
import { STAFF_TOKENS } from "@/lib/tokens";
import type { StaffTokens } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";

// Staff Home: personal worklists, sync inbox, recent activity, quiet stats.
// Tilts toward Brian's deep-enrichment entry point.

export function StaffHome() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  return (
    <div style={{
      width: '100%', height: '100%',
      overflowY: 'auto', overflowX: 'hidden',
      background: t.bg,
    }}>
      <div style={{
        padding: '32px 40px 48px',
        maxWidth: 1280, margin: '0 auto',
      }}>
        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: t.serif, fontSize: 30, fontWeight: 460,
            letterSpacing: -0.4, color: t.ink, lineHeight: 1.1,
          }}>Afternoon, Brian.</div>
          <div style={{
            color: t.inkMuted, fontSize: 14, marginTop: 6,
            textWrap: 'pretty',
          } as React.CSSProperties}>
            Your last session ended Tuesday — 19 of 22 Tremont records geo'd. Pick up where you left off, or start somewhere new.
          </div>
        </div>

        {/* Primary worklist row */}
        <SectionLabel>Pick up where you left</SectionLabel>
        <div style={{
          background: t.bgPanel,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 22,
          display: 'flex', gap: 24, alignItems: 'center',
          marginBottom: 28,
        }}>
          <div style={{
            width: 96, height: 96,
            background: 'repeating-linear-gradient(135deg, #C8B68F 0 6px, #B8A37A 6px 12px)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(26,24,20,0.45)',
            fontFamily: t.mono, fontSize: 9, letterSpacing: 0.5,
            textAlign: 'center',
            flexShrink: 0,
          }}>tremont<br/>thumbnail</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: t.mono, fontSize: 10.5, letterSpacing: 1.2,
              textTransform: 'uppercase', color: t.terracotta,
              marginBottom: 4,
            } as React.CSSProperties}>Resume · started 21 May</div>
            <div style={{
              fontFamily: t.serif, fontSize: 22, fontWeight: 500,
              letterSpacing: -0.2, color: t.ink, marginBottom: 6,
            }}>Tremont — 22 photos missing geo</div>
            <div style={{ color: t.inkSubtle, fontSize: 13.5, lineHeight: 1.5 }}>
              19 geo'd, 3 partial. Next up: photo <span style={{ fontFamily: t.mono }}>cpl_011_4738</span> — Lincoln Park bandstand, c.1910.
            </div>
            <div style={{
              marginTop: 14, display: 'flex', gap: 14,
              fontFamily: t.mono, fontSize: 11, color: t.inkMuted,
              letterSpacing: 0.2,
            }}>
              <span><b style={{ color: t.ink }}>86%</b> complete</span>
              <span style={{ color: t.borderSoft }}>·</span>
              <span>median <b style={{ color: t.ink }}>42s</b>/record</span>
              <span style={{ color: t.borderSoft }}>·</span>
              <span>last save 14:08</span>
            </div>
          </div>
          <button
            onClick={() => nav.navigate('record', { id: 'cpl_011_4738' })}
            style={{
              height: 42, padding: '0 22px',
              background: t.ink, color: '#F6F2EB',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: t.sans,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            Resume session
            <span style={{ fontFamily: t.mono, fontSize: 11, opacity: 0.6 }}>↵</span>
          </button>
        </div>

        {/* Worklists grid */}
        <SectionLabel
          right={<a style={{ color: t.teal, fontSize: 12.5, fontFamily: t.sans, cursor: 'pointer' }}>Manage queues →</a>}
        >Worklists</SectionLabel>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}>
          <Worklist
            label="Pre-1931 · no patron caption"
            count={48} total={92}
            note="Story-feedstock queue · 6 ready for Lisa"
            color={t.ochre}
          />
          <Worklist
            label="Patron contributions flagged"
            count={8} total={8}
            note="3 caption fixes · 5 location pins"
            color={t.terracotta}
            urgent
          />
          <Worklist
            label="Caption quality: needs rewrite"
            count={31} total={31}
            note="Batch fix · cataloger-imported"
            color={t.draft}
          />
          <Worklist
            label="Ohio City · missing geo"
            count={14} total={66}
            note="Adjacent to Tremont · pin-and-shift candidate"
            color={t.teal}
          />
          <Worklist
            label="Public-ready, missing alt text"
            count={22} total={22}
            note="AI-assist drawer can help here"
            color={t.sage}
          />
          <Worklist
            label="Stale · enriched pre-2024"
            count={117} total={2480}
            note="Re-review for current public use"
            color={t.inkFaint}
            subtle
          />
        </div>

        {/* Two columns: ContentDM inbox + recent activity */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 24,
        }}>
          <div>
            <SectionLabel
              right={<span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkMuted, letterSpacing: 0.4 }}>SYNC · 04:12 TODAY</span>}
            >ContentDM sync inbox</SectionLabel>
            <div style={{
              background: t.bgPanel,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              <SyncRow
                kind="changed"
                id="cpl_002_1188"
                title="Hanna Building, looking northwest"
                detail="Cataloger title changed — review diff before re-publishing."
              />
              <SyncRow
                kind="new"
                id="cpl_011_8821"
                title="14 new photographs queued for first-pass"
                detail="Neighborhood Photographic Survey · Adam Park, May 19"
              />
              <SyncRow
                kind="changed"
                id="cpl_007_4012"
                title="Public Square, late afternoon"
                detail="Rights statement revised upstream — confirm before re-publish."
              />
              <SyncRow
                kind="deleted"
                id="cpl_004_2299"
                title="(removed upstream — was on public site)"
                detail="Decide: hide, archive, or alert."
                last
              />
            </div>
          </div>

          <div>
            <SectionLabel>Activity</SectionLabel>
            <div style={{
              background: t.bgPanel,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: '6px 0',
            }}>
              <ActivityRow who="Lisa" verb="published" what="Streetcars of Detroit Avenue" when="2h" tone="story"/>
              <ActivityRow who="Adam" verb="uploaded" what="14 photos · Neighborhood Survey" when="5h" tone="upload"/>
              <ActivityRow who="Olivia" verb="featured" what="Millionaire's Row · Story of the Week" when="yesterday" tone="curate"/>
              <ActivityRow who="Tyla" verb="fixed" what="caption on cpl_002_1188 (drive-by)" when="yesterday" tone="edit"/>
              <ActivityRow who="patron" verb="suggested" what="location for cpl_011_4499" when="2d" tone="contrib"/>
              <ActivityRow who="you" verb="enriched" what="22 Tremont records · session ended" when="2d" tone="self" last/>
            </div>
            <div style={{
              fontFamily: t.mono, fontSize: 10.5,
              color: t.inkFaint, letterSpacing: 0.4,
              textTransform: 'uppercase',
              marginTop: 10, paddingLeft: 4,
            } as React.CSSProperties}>Audit log available on demand · ⌘\</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginBottom: 10,
    }}>
      <div style={{
        fontFamily: t.mono, fontSize: 10.5,
        letterSpacing: 1.4, textTransform: 'uppercase',
        color: t.inkMuted,
      } as React.CSSProperties}>{children}</div>
      {right}
    </div>
  );
}

function Worklist({ label, count, total, note, color, urgent, subtle }: {
  label: string;
  count: number;
  total: number;
  note: string;
  color: string;
  urgent?: boolean;
  subtle?: boolean;
}) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const pct = total > 0 ? Math.min(100, (count / total) * 100) : 0;
  return (
    <div
      onClick={() => nav.navigate('photos', { savedView: label })}
      style={{
        background: t.bgPanel,
        border: `1px solid ${urgent ? t.terracotta : t.border}`,
        borderRadius: 10,
        padding: '14px 16px 14px',
        position: 'relative',
        cursor: 'pointer',
        opacity: subtle ? 0.85 : 1,
      }}>
      <div style={{
        position: 'absolute', top: 14, right: 14,
        width: 6, height: 6, borderRadius: '50%', background: color,
      }}/>
      <div style={{
        fontFamily: t.serif, fontSize: 17, fontWeight: 500,
        color: t.ink, letterSpacing: -0.1, lineHeight: 1.2,
        marginBottom: 10,
        textWrap: 'pretty',
        paddingRight: 18,
      } as React.CSSProperties}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontFamily: t.mono, fontSize: 22, fontWeight: 500,
          color: t.ink, letterSpacing: -0.5, lineHeight: 1,
        }}>{count}</span>
        <span style={{
          fontFamily: t.mono, fontSize: 11, color: t.inkFaint,
        }}>/ {total} total</span>
      </div>
      <div style={{
        height: 3, background: t.borderSoft, borderRadius: 2, overflow: 'hidden',
        marginBottom: 10,
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }}/>
      </div>
      <div style={{
        fontSize: 12, color: t.inkMuted, lineHeight: 1.4,
        textWrap: 'pretty',
      } as React.CSSProperties}>{note}</div>
    </div>
  );
}

function SyncRow({ kind, id, title, detail, last }: {
  kind: 'changed' | 'new' | 'deleted';
  id: string;
  title: string;
  detail: string;
  last?: boolean;
}) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const kindMap = {
    changed: { label: 'Changed', color: t.ochre, soft: t.ochreSoft },
    new:     { label: 'New',     color: t.sage,   soft: t.sageSoft },
    deleted: { label: 'Removed', color: t.terracotta, soft: '#F3DDD8' },
  };
  const k = kindMap[kind];
  return (
    <div style={{
      padding: '14px 18px',
      borderBottom: last ? 'none' : `1px solid ${t.borderSoft}`,
      display: 'flex', alignItems: 'flex-start', gap: 14,
      cursor: 'pointer',
    }}>
      <div style={{
        background: k.soft, color: k.color,
        fontFamily: t.mono, fontSize: 10, letterSpacing: 0.8,
        textTransform: 'uppercase', fontWeight: 500,
        padding: '3px 8px', borderRadius: 4,
        flexShrink: 0,
        minWidth: 64, textAlign: 'center',
      } as React.CSSProperties}>{k.label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: t.ink }}>{title}</span>
          <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}>{id}</span>
        </div>
        <div style={{
          fontSize: 12.5, color: t.inkMuted,
          marginTop: 3, lineHeight: 1.4, textWrap: 'pretty',
        } as React.CSSProperties}>{detail}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (kind === 'deleted') nav.toast(`Decision needed for ${id} — modal not built in MVP`, 'warn');
          else nav.navigate('record', { id });
        }}
        style={{
          background: 'transparent', border: `1px solid ${t.border}`,
          color: t.ink, fontFamily: t.sans, fontSize: 12,
          padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
          flexShrink: 0,
        }}>Review</button>
    </div>
  );
}

function ActivityRow({ who, verb, what, when, tone, last }: {
  who: string;
  verb: string;
  what: string;
  when: string;
  tone: 'story' | 'upload' | 'curate' | 'edit' | 'contrib' | 'self';
  last?: boolean;
}) {
  const t = STAFF_TOKENS;
  const toneColor = ({
    story: t.teal, upload: t.sage, curate: t.ochre,
    edit: t.draft, contrib: t.terracotta, self: t.ink,
  } as Record<string, string>)[tone] || t.inkMuted;
  return (
    <div style={{
      padding: '8px 16px',
      borderBottom: last ? 'none' : `1px solid ${t.borderSoft}`,
      display: 'flex', alignItems: 'baseline', gap: 8,
      fontSize: 13, lineHeight: 1.4,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: toneColor, marginTop: 6, flexShrink: 0 }}/>
      <span style={{ flex: 1, color: t.ink, textWrap: 'pretty' } as React.CSSProperties}>
        <span style={{ fontWeight: 500 }}>{who}</span>
        <span style={{ color: t.inkMuted }}> {verb} </span>
        <span style={{ color: t.inkSubtle }}>{what}</span>
      </span>
      <span style={{
        fontFamily: t.mono, fontSize: 10.5,
        color: t.inkFaint, flexShrink: 0,
      }}>{when}</span>
    </div>
  );
}
