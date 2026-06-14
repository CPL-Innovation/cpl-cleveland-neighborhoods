"use client";
// Staff app chrome: top bar + left sidebar nav. Ported from staff-shell.jsx.
import React from "react";
import { STAFF_TOKENS } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";

export function StaffShell({
  activeSection,
  screenTitle,
  screenMeta,
  children,
  user = "Brian Meggitt",
}: {
  activeSection: string;
  screenTitle: string;
  screenMeta?: string;
  children: React.ReactNode;
  user?: string;
}) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: STAFF_TOKENS.bg,
      color: STAFF_TOKENS.ink,
      fontFamily: STAFF_TOKENS.sans,
      WebkitFontSmoothing: "antialiased",
      display: "flex",
      overflow: "hidden",
    } as React.CSSProperties}>
      <StaffSidebar activeSection={activeSection} user={user} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <StaffTopBar title={screenTitle} meta={screenMeta} />
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{children}</div>
      </div>
    </div>
  );
}

function StaffSidebar({ activeSection, user }: { activeSection: string; user: string }) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const items = [
    { id: "home", label: "Home", hint: "3 worklists", glyph: <HomeGlyph />, view: "home" },
    { id: "photos", label: "Photos", hint: "12,408", glyph: <PhotosGlyph />, view: "photos" },
    { id: "stories", label: "Stories", hint: "14 · 3 drafts", glyph: <StoriesGlyph />, view: "stories" },
    { id: "contrib", label: "Contributions", hint: "8 pending", glyph: <ContribGlyph />, badge: 8, view: "contrib" },
    { id: "vocab", label: "Vocabularies", hint: "6 lists", glyph: <VocabGlyph />, view: "vocab" },
  ];

  return (
    <aside style={{
      width: 232,
      background: t.bgInk,
      color: "#E8DFCE",
      display: "flex", flexDirection: "column",
      borderRight: "1px solid rgba(0,0,0,0.2)",
    }}>
      {/* Wordmark */}
      <div style={{
        height: 60, padding: "0 18px",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4,
          background: t.terracotta,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: t.serif, fontWeight: 600, color: "#fff",
          fontSize: 13, lineHeight: 1,
        }}>CN</div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontFamily: t.serif, fontSize: 15.5, fontWeight: 500, letterSpacing: -0.2, color: "#F6F2EB" }}>Cleveland Neighborhoods</div>
          <div style={{ fontFamily: t.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: t.inkFaint, marginTop: 2 } as React.CSSProperties}>Enrichment · Staff</div>
        </div>
      </div>

      {/* Sync inbox */}
      <div style={{ padding: "14px 14px 6px" }}>
        <SidebarSyncCard />
      </div>

      {/* Nav */}
      <nav style={{ padding: "6px 8px", flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ padding: "12px 10px 6px", fontFamily: t.mono, fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", color: t.inkFaint } as React.CSSProperties}>Workspace</div>
        {items.map((it) => (
          <SidebarItem
            key={it.id}
            active={it.id === activeSection}
            glyph={it.glyph}
            label={it.label}
            hint={it.hint}
            badge={it.badge}
            onClick={() => nav.navigate(it.view)}
          />
        ))}

        {/* Ingest — new records entering the system, awaiting first-pass treatment. */}
        <div style={{ padding: "14px 10px 6px", fontFamily: t.mono, fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", color: t.inkFaint } as React.CSSProperties}>Ingest</div>
        <SidebarItem active={activeSection === "prep"} glyph={<PrepGlyph />} label="Prep" hint="crop · deskew" onClick={() => nav.navigate("scanPrep")} />
        <SidebarItem active={activeSection === "ingest"} glyph={<IngestGlyph />} label="Scan pipeline" hint="box-scan" onClick={() => nav.navigate("scanPipeline")} />
        <SidebarItem subtle label="Sync inbox" hint="ContentDM" onClick={() => nav.toast("Sync inbox — existing ContentDM upstream path (not built in this MVP)", "info")} />

        <div style={{ flex: 1 }} />

        <div style={{ padding: "12px 10px 6px", fontFamily: t.mono, fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", color: t.inkFaint } as React.CSSProperties}>My queues</div>
        <SidebarItem subtle label="Tremont · missing geo" hint="22" onClick={() => nav.navigate("photos", { savedView: "Tremont · missing geo" })} />
        <SidebarItem subtle label="Pre-1931 · no caption" hint="48" onClick={() => nav.navigate("photos", { savedView: "Pre-1931 · no caption" })} />
        <SidebarItem subtle label="Ready to publish" hint="6" onClick={() => nav.navigate("photos", { savedView: "Ready to publish" })} />
      </nav>

      {/* User */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.tealSoft, color: t.teal, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>BM</div>
        <div style={{ minWidth: 0, flex: 1, lineHeight: 1.2 }}>
          <div style={{ color: "#F6F2EB", fontSize: 12.5, fontWeight: 500 }}>{user}</div>
          <div style={{ color: t.inkFaint, fontSize: 10.5, fontFamily: t.mono }}>librarian-editor</div>
        </div>
        <button style={{ background: "transparent", border: "none", color: t.inkFaint, cursor: "pointer", padding: 4, lineHeight: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="3" cy="7" r="1.2" fill="currentColor" />
            <circle cx="7" cy="7" r="1.2" fill="currentColor" />
            <circle cx="11" cy="7" r="1.2" fill="currentColor" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({ active, glyph, label, hint, badge, subtle, onClick }: {
  active?: boolean;
  glyph?: React.ReactNode;
  label: string;
  hint?: string;
  badge?: number;
  subtle?: boolean;
  onClick?: () => void;
}) {
  const t = STAFF_TOKENS;
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: subtle ? "5px 10px 5px 22px" : "7px 10px",
      borderRadius: 6,
      background: active ? "rgba(246,242,235,0.08)" : "transparent",
      color: active ? "#F6F2EB" : subtle ? "#C9BFA9" : "#E8DFCE",
      cursor: "pointer", position: "relative",
    }}>
      {active && <div style={{ position: "absolute", left: -8, top: 7, bottom: 7, width: 2, background: t.terracotta, borderRadius: 2 }} />}
      {glyph && <span style={{ width: 14, height: 14, display: "inline-flex", color: active ? "#F6F2EB" : "#C9BFA9" }}>{glyph}</span>}
      <span style={{ flex: 1, fontSize: subtle ? 12 : 13, fontWeight: active ? 500 : 400 }}>{label}</span>
      {badge != null ? (
        <span style={{ background: t.terracotta, color: "#fff", fontFamily: t.mono, fontSize: 10, padding: "1px 6px", borderRadius: 10, lineHeight: 1.4 }}>{badge}</span>
      ) : (
        hint && <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint, letterSpacing: 0.2 }}>{hint}</span>
      )}
    </div>
  );
}

function SidebarSyncCard() {
  const t = STAFF_TOKENS;
  return (
    <div style={{ background: "rgba(246,242,235,0.06)", border: "1px solid rgba(246,242,235,0.10)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: t.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: t.inkFaint } as React.CSSProperties}>ContentDM sync</span>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.sage, boxShadow: `0 0 0 3px ${t.sage}22` }} />
      </div>
      <div style={{ color: "#F6F2EB", fontSize: 12.5, lineHeight: 1.4 }}>
        <span style={{ fontWeight: 600 }}>3 records</span> changed upstream
      </div>
      <div style={{ color: t.inkFaint, fontSize: 11, marginTop: 2, fontFamily: t.mono }}>last pull · 04:12 today</div>
    </div>
  );
}

function StaffTopBar({ title, meta }: { title: string; meta?: string }) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  return (
    <div style={{ height: 56, padding: "0 24px", borderBottom: `1px solid ${t.border}`, background: t.bg, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
      <div style={{ fontFamily: t.serif, fontSize: 20, fontWeight: 500, letterSpacing: -0.2, color: t.ink, lineHeight: 1 }}>{title}</div>
      {meta && (
        <div style={{ fontFamily: t.mono, fontSize: 11, color: t.inkMuted, letterSpacing: 0.4, textTransform: "uppercase", paddingLeft: 12, marginLeft: 4, borderLeft: `1px solid ${t.border}` } as React.CSSProperties}>{meta}</div>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={() => nav.toast("Command palette — not wired in this MVP", "info")} style={{ height: 34, padding: "0 12px", display: "flex", alignItems: "center", gap: 8, background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 17, color: t.ink, fontSize: 12.5, fontFamily: t.sans, cursor: "pointer", minWidth: 280 }}>
        <SearchIcon14 />
        <span style={{ color: t.inkMuted, flex: 1, textAlign: "left" }}>Search 12,408 records, stories…</span>
        <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint }}>⌘ K</span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: t.mono, fontSize: 10.5, color: t.inkMuted, letterSpacing: 0.3 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.sage }} />
        <span>All changes saved · 14:08</span>
      </div>
      <button onClick={() => nav.toast("Stub — new record creation flow not built", "info")} style={{ height: 34, padding: "0 14px", background: t.ink, color: "#F6F2EB", border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: t.sans, display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1v9M1 5.5h9" stroke="#F6F2EB" strokeWidth="1.5" strokeLinecap="round" /></svg>
        New
      </button>
    </div>
  );
}

function SearchIcon14({ color = "#3D3833" }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={color} strokeWidth="1.4" />
      <path d="M9.5 9.5 L13 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function HomeGlyph() { return <svg viewBox="0 0 14 14" fill="none"><path d="M2 6.5 L7 2.5 L12 6.5 L12 12 L9 12 L9 8.5 L5 8.5 L5 12 L2 12 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>; }
function PhotosGlyph() { return <svg viewBox="0 0 14 14" fill="none"><rect x="2" y="3.5" width="10" height="7.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" /><circle cx="5.5" cy="6.5" r="0.9" stroke="currentColor" strokeWidth="1.1" /><path d="M2.5 10.5 L6 8 L9 10 L11.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" /></svg>; }
function StoriesGlyph() { return <svg viewBox="0 0 14 14" fill="none"><path d="M3 2.5 H10 a1 1 0 0 1 1 1 V11.5 L7 9.5 L3 11.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>; }
function ContribGlyph() { return <svg viewBox="0 0 14 14" fill="none"><path d="M2.5 4 L7 7 L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><rect x="2" y="3" width="10" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.3" /></svg>; }
function VocabGlyph() { return <svg viewBox="0 0 14 14" fill="none"><path d="M2.5 3 H11.5 M2.5 7 H11.5 M2.5 11 H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>; }
function IngestGlyph() { return <svg viewBox="0 0 14 14" fill="none"><path d="M7 2 V8 M4.5 5.5 L7 8 L9.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.5 9.5 V11.5 H11.5 V9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function PrepGlyph() { return <svg viewBox="0 0 14 14" fill="none"><path d="M4.5 1.5 V9.5 H12.5 M1.5 4.5 H9.5 V12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
