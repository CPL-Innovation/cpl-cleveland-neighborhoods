"use client";
import React from "react";

// Surface A — Pipeline run, rebuilt as a worklist sheet.
// Every ingested photo at a glance (mirrors the Photos spreadsheet): thumbnail, id,
// pipeline stage, the VLM read, and review verdicts — then click a ready row to review it.
// A condensed health rollup + per-row retry replace the old centered stat panel.
//
// Spec: scan-pipeline-ux.md §"Surface A — Pipeline run".

import { scanApi } from "@/lib/scan-api";
import { STAFF_TOKENS } from "@/lib/tokens";
import type { StaffTokens } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import { pillBtn } from "@/components/staff/ui";
import { ScanInbox } from "@/components/scan/ingest";
import type { ScanRecord, AddressYearVerdict, DescriptionVerdict } from "@/lib/types";

// Shared loader hook + a "needs the server" banner used by all three surfaces.
export function useScanRecords() {
  const [records, setRecords] = React.useState<ScanRecord[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const reload = React.useCallback(() => {
    scanApi.list().then(setRecords).catch((e) => setError(e.message));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);
  return { records, error, reload, setRecords };
}

export function ServerNeeded({ error }: { error?: string | null }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 24 }}>
        <div style={{ fontFamily: t.serif, fontSize: 22, fontWeight: 500, color: t.ink, marginBottom: 8 }}>
          Scan pipeline needs the database
        </div>
        <div style={{ color: t.inkMuted, fontSize: 13.5, lineHeight: 1.6 }}>
          The review surface reads and saves through the API, which needs a Postgres connection.
          Copy <span style={{ fontFamily: t.mono }}>.env.local.example</span> → <span style={{ fontFamily: t.mono }}>.env.local</span>,
          add your Supabase credentials, then seed and reload:
          <pre style={{
            background: t.bgInk, color: '#E8DFCE', fontFamily: t.mono, fontSize: 12.5,
            padding: '10px 14px', borderRadius: 8, marginTop: 12, textAlign: 'left',
          }}>npm run db:push{'\n'}npm run scan:run</pre>
        </div>
        {error && <div style={{ marginTop: 12, fontFamily: t.mono, fontSize: 11, color: t.terracotta }}>({error})</div>}
      </div>
    </div>
  );
}

// ── Filters across the top (mirrors Photos' filter chips) ────
type ScanFilter = "all" | "pending" | "ready" | "reviewed" | "failed";

function matchesFilter(r: ScanRecord, f: ScanFilter): boolean {
  switch (f) {
    case "all": return true;
    case "pending": return r.status === "discovered" || r.status === "derived";
    case "ready": return r.status === "ready";
    case "reviewed": return r.review?.status === "reviewed";
    case "failed": return r.status === "failed";
  }
}

export function ScanPipeline() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const { records, error, reload } = useScanRecords();
  const [retrying, setRetrying] = React.useState<Record<string, boolean>>({});
  const [filter, setFilter] = React.useState<ScanFilter>("all");
  const [inboxOpen, setInboxOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  if (error) return <ServerNeeded error={error} />;
  if (!records) return <CenterNote text="Loading pipeline…" />;

  const total = records.length;
  const derived = records.filter((r) => r.jpeg_path || r.jpeg_url).length;
  const ready = records.filter((r) => r.status === "ready").length;
  const failed = records.filter((r) => r.status === "failed").length;
  const reviewed = records.filter((r) => r.review?.status === "reviewed").length;
  const stub = records.some((r) => r.vlm?._stub);

  const counts: Record<ScanFilter, number> = {
    all: total,
    pending: records.filter((r) => matchesFilter(r, "pending")).length,
    ready,
    reviewed,
    failed,
  };
  const rows = records.filter((r) => matchesFilter(r, filter));

  const onRetry = async (id: string) => {
    setRetrying((m) => ({ ...m, [id]: true }));
    try {
      await scanApi.retry(id);
      nav.toast(`Re-attempted ${id}`, "ok");
      reload();
    } catch (e) {
      nav.toast(`Retry failed: ${(e as Error).message}`, "warn");
    } finally {
      setRetrying((m) => ({ ...m, [id]: false }));
    }
  };

  // ── Export VLM metadata (year · address · description) for every entry as JSON ──
  const onExport = () => {
    if (!records.length) return nav.toast("Nothing to export yet", "info");
    const entries = records.map((r) => ({
      chc_id: r.chc_id,
      year: r.vlm?.year ?? null,
      address: r.vlm?.address ?? null,
      description: r.vlm?.description ?? null,
    }));
    const payload = { exported_at: new Date().toISOString(), count: entries.length, entries };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-metadata-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    nav.toast(`Exported ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`, "ok");
  };

  const startReview = () => {
    const first = records.find((r) => r.status === "ready" && r.review?.status !== "reviewed")
      || records.find((r) => r.status === "ready");
    if (!first) return nav.toast("No photos ready to review yet", "info");
    nav.navigate("scanReview", { id: first.chc_id });
  };

  // ── Selection + un-ingest ──
  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());
  const filteredIds = rows.map((r) => r.chc_id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredIds.some((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allFilteredSelected) filteredIds.forEach((id) => n.delete(id));
      else filteredIds.forEach((id) => n.add(id));
      return n;
    });

  const selectedRecords = records.filter((r) => selected.has(r.chc_id));
  const reviewedSelected = selectedRecords.filter((r) => r.review?.status === "reviewed").length;

  const doRemove = async () => {
    const ids = selectedRecords.map((r) => r.chc_id);
    setRemoving(true);
    const results = await Promise.allSettled(ids.map((id) => scanApi.remove(id)));
    const failures = results.filter((r) => r.status === "rejected").length;
    setRemoving(false);
    setConfirmOpen(false);
    clearSel();
    reload();
    if (failures) nav.toast(`Removed ${ids.length - failures} of ${ids.length} · ${failures} failed`, "warn");
    else nav.toast(`Removed ${ids.length} from the pipeline`, "ok");
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: t.bg, overflow: "hidden" }}>
      {/* Filter bar — stage tabs + actions */}
      <div style={{
        padding: "12px 24px", background: t.bgSurface,
        borderBottom: `1px solid ${t.borderSoft}`,
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0,
      }}>
        <FilterTab label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterTab label="Pending" count={counts.pending} active={filter === "pending"} onClick={() => setFilter("pending")} tone={t.ochre} />
        <FilterTab label="Ready" count={counts.ready} active={filter === "ready"} onClick={() => setFilter("ready")} tone={t.sage} />
        <FilterTab label="Reviewed" count={counts.reviewed} active={filter === "reviewed"} onClick={() => setFilter("reviewed")} tone={t.teal} />
        <FilterTab label="Failed" count={counts.failed} active={filter === "failed"} onClick={() => setFilter("failed")} tone={t.terracotta} />

        <div style={{ flex: 1 }} />

        {stub && (
          <span style={{
            fontFamily: t.mono, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase",
            color: t.draft, background: t.draftSoft, border: `1px solid ${t.draft}40`,
            padding: "4px 8px", borderRadius: 4,
          } as React.CSSProperties} title="VLM ran without a key — placeholder reads. Set GEMINI_API_KEY and re-run scan:run.">
            stub reads
          </span>
        )}
        <button onClick={() => setInboxOpen(true)} style={pillBtn(t, false)}>Ingest ↓</button>
        <button onClick={onExport} style={pillBtn(t, false)} title="Download year · address · description for every entry as JSON">Export JSON ↧</button>
        <button onClick={() => nav.navigate("scanAccuracy")} style={pillBtn(t, false)}>Accuracy ▸</button>
        <button onClick={startReview} style={pillBtn(t, true)}>Start review →</button>
      </div>

      {/* Bulk bar — appears on selection (mirrors Photos) */}
      {selected.size > 0 && (
        <div style={{
          padding: "8px 24px", background: t.terracotta + "0E",
          borderBottom: `1px solid ${t.terracotta}33`,
          display: "flex", alignItems: "center", gap: 14, fontSize: 12.5, flexShrink: 0,
        }}>
          <span style={{ fontFamily: t.mono, fontSize: 11, color: t.terracotta, letterSpacing: 0.4 }}>
            <b style={{ fontWeight: 600 }}>{selected.size} selected</b>
          </span>
          <span style={{ color: t.border }}>·</span>
          <button
            onClick={() => setConfirmOpen(true)}
            style={{
              height: 24, padding: "0 10px", background: "#fff",
              border: `1px solid ${t.terracotta}55`, borderRadius: 4,
              fontSize: 11.5, color: t.terracotta, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
            }}
          >Remove from pipeline…</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={clearSel}
            style={{ background: "transparent", border: "none", color: t.inkMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >Clear selection</button>
        </div>
      )}

      <ScanInbox open={inboxOpen} onClose={() => setInboxOpen(false)} onIngested={reload} />
      {confirmOpen && (
        <ConfirmRemove
          count={selected.size}
          reviewed={reviewedSelected}
          removing={removing}
          onCancel={() => !removing && setConfirmOpen(false)}
          onConfirm={doRemove}
          t={t}
        />
      )}

      {/* The sheet */}
      <ScanSheet
        rows={rows}
        total={total}
        derived={derived}
        ready={ready}
        failed={failed}
        reviewed={reviewed}
        retrying={retrying}
        onRetry={onRetry}
        emptyAll={total === 0}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        allSelected={allFilteredSelected}
        someSelected={someFilteredSelected}
        nav={nav}
        t={t}
      />
    </div>
  );
}

// ── The worklist sheet (mirrors PhotosSheet) ─────────────────
const COLS: { id: string; w: number; label: string }[] = [
  { id: "check", w: 44, label: "" },
  { id: "thumb", w: 56, label: "" },
  { id: "id", w: 132, label: "CHC ID" },
  { id: "stage", w: 104, label: "Stage" },
  { id: "address", w: 200, label: "VLM · address" },
  { id: "year", w: 96, label: "VLM · year" },
  { id: "desc", w: 380, label: "VLM · description" },
  { id: "review", w: 168, label: "Review" },
];

function ScanSheet({
  rows, total, derived, ready, failed, reviewed, retrying, onRetry, emptyAll,
  selected, onToggle, onToggleAll, allSelected, someSelected, nav, t,
}: {
  rows: ScanRecord[];
  total: number; derived: number; ready: number; failed: number; reviewed: number;
  retrying: Record<string, boolean>;
  onRetry: (id: string) => void;
  emptyAll: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  nav: ReturnType<typeof useNav>;
  t: StaffTokens;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, overflow: "auto", background: "#fff" }}>
      {/* Header */}
      <div style={{
        display: "flex", position: "sticky", top: 0, zIndex: 2,
        background: t.bgSurface, borderBottom: `1px solid ${t.border}`,
        fontFamily: t.mono, fontSize: 10.5, color: t.inkMuted, letterSpacing: 0.5, textTransform: "uppercase",
      }}>
        {COLS.map((c) => (
          <div key={c.id}
            onClick={c.id === "check" && rows.length ? onToggleAll : undefined}
            style={{
              width: c.w, flexShrink: 0, padding: c.id === "thumb" ? 4 : "8px 10px",
              borderRight: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center",
              cursor: c.id === "check" && rows.length ? "pointer" : "default",
            }}>
            {c.id === "check" ? <Checkbox checked={allSelected} indeterminate={someSelected && !allSelected} t={t} /> : c.label}
          </div>
        ))}
      </div>

      {emptyAll ? (
        <div style={{ padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: t.serif, fontSize: 18, color: t.ink, marginBottom: 6 }}>No scans ingested yet</div>
          <div style={{ fontSize: 13, color: t.inkMuted, lineHeight: 1.6 }}>
            Drop box-scan TIFFs in <span style={{ fontFamily: t.mono }}>masters/</span>, then click{" "}
            <span style={{ color: t.ink, fontWeight: 500 }}>Ingest ↓</span> above to derive, read, and list them here —{" "}
            or run <span style={{ fontFamily: t.mono, color: t.ink }}>npm run scan:run</span>.
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center", color: t.inkFaint, fontSize: 13 }}>
          No photos match this filter.
        </div>
      ) : (
        rows.map((r, i) => (
          <ScanRow key={r.chc_id} r={r} i={i} retrying={!!retrying[r.chc_id]} onRetry={onRetry}
            selected={selected.has(r.chc_id)} onToggle={onToggle} nav={nav} t={t} />
        ))
      )}

      {/* Footer — condensed health rollup (replaces the old stat panel) */}
      {!emptyAll && (
        <div style={{
          padding: "14px 24px", fontFamily: t.mono, fontSize: 11,
          color: t.inkFaint, letterSpacing: 0.3, textAlign: "center",
          borderTop: `1px solid ${t.borderSoft}`,
        }}>
          showing {rows.length} of {total} · {derived} derived · {ready} VLM-read ·{" "}
          <span style={{ color: failed ? t.terracotta : t.inkFaint }}>{failed} failed</span> · {reviewed} reviewed
        </div>
      )}
    </div>
  );
}

function ScanRow({
  r, i, retrying, onRetry, selected, onToggle, nav, t,
}: {
  r: ScanRecord; i: number; retrying: boolean;
  onRetry: (id: string) => void;
  selected: boolean;
  onToggle: (id: string) => void;
  nav: ReturnType<typeof useNav>;
  t: StaffTokens;
}) {
  const isReady = r.status === "ready";
  return (
    <div
      onClick={isReady ? () => nav.navigate("scanReview", { id: r.chc_id }) : undefined}
      style={{
        display: "flex", borderBottom: `1px solid ${t.borderSoft}`,
        background: selected ? t.tealSoft + "88" : (i % 2 ? "#FCFAF5" : "#fff"),
        fontSize: 12.5, minHeight: 44, alignItems: "stretch",
        cursor: isReady ? "pointer" : "default",
      }}
    >
      {COLS.map((c) => (
        <div key={c.id}
          onClick={c.id === "check" ? (e) => { e.stopPropagation(); onToggle(r.chc_id); } : undefined}
          style={{
            width: c.w, flexShrink: 0,
            padding: c.id === "thumb" ? 4 : "8px 10px",
            borderRight: `1px solid ${t.borderSoft}`,
            display: "flex", alignItems: "center", gap: 4, minWidth: 0,
            cursor: c.id === "check" ? "pointer" : undefined,
          }}>
          {c.id === "check"
            ? <Checkbox checked={selected} t={t} />
            : <ScanCell col={c.id} r={r} retrying={retrying} onRetry={onRetry} t={t} />}
        </div>
      ))}
    </div>
  );
}

function ScanCell({
  col, r, retrying, onRetry, t,
}: {
  col: string; r: ScanRecord; retrying: boolean;
  onRetry: (id: string) => void;
  t: StaffTokens;
}) {
  const src = r.jpeg_url || (r.jpeg_path ? "/" + r.jpeg_path : null);
  switch (col) {
    case "thumb":
      return src ? (
        <img src={src} alt="" loading="lazy" style={{
          width: 48, height: 36, objectFit: "cover", borderRadius: 3, background: "#1A1814", display: "block",
        }} />
      ) : (
        <div style={{
          width: 48, height: 36, borderRadius: 3,
          background: `repeating-linear-gradient(${30 + r.chc_id.length * 7}deg, #C8B68F 0 4px, #B8A37A 4px 8px)`,
        } as React.CSSProperties} />
      );
    case "id":
      return <span style={{ fontFamily: t.mono, fontSize: 11.5, color: t.ink }}>{r.chc_id}</span>;
    case "stage":
      return <StagePill status={r.status} t={t} />;
    case "address":
      return <VlmValue value={r.vlm?.address} t={t} />;
    case "year":
      return <VlmValue value={r.vlm?.year} mono t={t} />;
    case "desc":
      if (r.status === "failed") {
        return <span style={{ fontSize: 11.5, color: t.terracotta, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties}>
          {r.error || "pipeline error"}
        </span>;
      }
      return r.vlm?.description ? (
        <span style={{ color: t.inkSubtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties}>
          {r.vlm.description}
        </span>
      ) : <span style={{ color: t.inkFaint, fontStyle: "italic" } as React.CSSProperties}>—</span>;
    case "review":
      return <ReviewCell r={r} retrying={retrying} onRetry={onRetry} t={t} />;
    default:
      return null;
  }
}

function VlmValue({ value, mono, t }: { value?: string; mono?: boolean; t: StaffTokens }) {
  if (!value) return <span style={{ color: t.inkFaint }}>∅</span>;
  return (
    <span style={{
      color: t.ink, fontFamily: mono ? t.mono : undefined, fontSize: mono ? 11.5 : undefined,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    } as React.CSSProperties}>{value}</span>
  );
}

function StagePill({ status, t }: { status: ScanRecord["status"]; t: StaffTokens }) {
  const map: Record<ScanRecord["status"], { c: string; label: string }> = {
    ready: { c: t.sage, label: "ready" },
    derived: { c: t.ochre, label: "derived" },
    discovered: { c: t.inkFaint, label: "queued" },
    failed: { c: t.terracotta, label: "failed" },
  };
  const m = map[status] || map.discovered;
  return (
    <span style={{
      fontSize: 10.5, color: m.c, background: m.c + "15",
      padding: "2px 7px", borderRadius: 3, whiteSpace: "nowrap", fontWeight: 500,
    }}>{m.label}</span>
  );
}

// Review column: failed → retry; ready → verdict dots (+ ✓ once confirmed); pending → status hint.
function ReviewCell({ r, retrying, onRetry, t }: { r: ScanRecord; retrying: boolean; onRetry: (id: string) => void; t: StaffTokens }) {
  if (r.status === "failed") {
    return (
      <button
        disabled={retrying}
        onClick={(e) => { e.stopPropagation(); onRetry(r.chc_id); }}
        style={{
          height: 24, padding: "0 10px",
          background: "#fff", border: `1px solid ${t.terracotta}55`,
          borderRadius: 4, fontSize: 11.5, color: t.terracotta,
          cursor: retrying ? "default" : "pointer", fontFamily: "inherit", fontWeight: 500,
          opacity: retrying ? 0.6 : 1,
        }}
      >{retrying ? "retrying…" : "Re-attempt"}</button>
    );
  }
  if (r.status !== "ready") {
    return <span style={{ fontSize: 11, color: t.inkFaint }}>awaiting VLM</span>;
  }
  const reviewed = r.review?.status === "reviewed";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {reviewed && (
        <span style={{ color: t.sage, fontSize: 12, lineHeight: 1 }} title="reviewed">✓</span>
      )}
      <span style={{ display: "inline-flex", gap: 3 }}>
        <VerdictDot letter="A" color={ayColor(r.review?.address?.verdict, t)} title={`Address: ${r.review?.address?.verdict || "unset"}`} t={t} />
        <VerdictDot letter="Y" color={ayColor(r.review?.year?.verdict, t)} title={`Year: ${r.review?.year?.verdict || "unset"}`} t={t} />
        <VerdictDot letter="D" color={descColor(r.review?.description?.verdict, t)} title={`Description: ${r.review?.description?.verdict || "unset"}`} t={t} />
      </span>
      {!reviewed && <span style={{ fontSize: 11, color: t.inkFaint }}>review →</span>}
    </span>
  );
}

function ayColor(v: AddressYearVerdict | null | undefined, t: StaffTokens): string | null {
  return v === "correct" ? t.sage : v === "edited" ? t.teal : v === "illegible" ? t.ochre : null;
}
function descColor(v: DescriptionVerdict | null | undefined, t: StaffTokens): string | null {
  return v === "accepted" ? t.sage : v === "edited" ? t.teal : v === "rejected" ? t.terracotta : null;
}

function VerdictDot({ letter, color, title, t }: { letter: string; color: string | null; title: string; t: StaffTokens }) {
  return (
    <span title={title} style={{
      width: 16, height: 16, borderRadius: "50%",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: t.mono, fontSize: 9, fontWeight: 600,
      background: color || "#fff", color: color ? "#fff" : t.inkFaint,
      border: `1px solid ${color || t.border}`,
    }}>{letter}</span>
  );
}

function Checkbox({ checked, indeterminate, t }: { checked?: boolean; indeterminate?: boolean; t: StaffTokens }) {
  const on = checked || indeterminate;
  return (
    <div style={{
      width: 14, height: 14, flexShrink: 0,
      border: `1.4px solid ${on ? t.teal : t.border}`, borderRadius: 3,
      background: on ? t.teal : "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {checked && (
        <svg width="9" height="9" viewBox="0 0 9 9">
          <path d="M1.5 4.5 L3.5 6.5 L7.5 2" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminate && !checked && <div style={{ width: 7, height: 1.6, background: "#fff" }} />}
    </div>
  );
}

// Confirm dialog for un-ingest. Warns when reviewed records (with verdicts) are in the set.
function ConfirmRemove({
  count, reviewed, removing, onCancel, onConfirm, t,
}: {
  count: number; reviewed: number; removing: boolean;
  onCancel: () => void; onConfirm: () => void; t: StaffTokens;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(26,24,20,0.42)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      } as React.CSSProperties}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(440px, 100%)", background: t.bgPanel, border: `1px solid ${t.border}`,
        borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,0.32)", padding: "20px 22px",
      }}>
        <div style={{ fontFamily: t.serif, fontSize: 18, fontWeight: 500, color: t.ink, marginBottom: 8 }}>
          Remove {count} {count === 1 ? "photo" : "photos"} from the pipeline?
        </div>
        <div style={{ fontSize: 13, color: t.inkMuted, lineHeight: 1.55 }}>
          This deletes the database {count === 1 ? "row" : "rows"} and the derived JPEG{count === 1 ? "" : "s"}.
          The original {count === 1 ? "TIFF stays" : "TIFFs stay"} in{" "}
          <span style={{ fontFamily: t.mono }}>masters/</span>, so {count === 1 ? "it" : "they"} can be re-ingested from the Scan inbox.
        </div>
        {reviewed > 0 && (
          <div style={{
            marginTop: 12, padding: "8px 12px", fontSize: 12.5, lineHeight: 1.5,
            color: t.terracotta, background: t.terracotta + "10", border: `1px solid ${t.terracotta}33`, borderRadius: 6,
          }}>
            <b>{reviewed} {reviewed === 1 ? "is" : "are"} reviewed</b> — those verdicts will be lost.
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} disabled={removing} style={{ ...pillBtn(t, false), opacity: removing ? 0.5 : 1 }}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={removing}
            style={{
              height: 28, padding: "0 14px", borderRadius: 6, border: "none",
              background: t.terracotta, color: "#fff", fontSize: 12, fontWeight: 500,
              cursor: removing ? "default" : "pointer", fontFamily: "inherit",
              opacity: removing ? 0.7 : 1,
            }}
          >{removing ? "Removing…" : `Remove ${count}`}</button>
        </div>
      </div>
    </div>
  );
}

export function CenterNote({ text }: { text: string }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <div style={{ color: t.inkMuted, fontSize: 13.5 }}>{text}</div>
    </div>
  );
}

// ── Filter tab (stage chip with count) ───────────────────────
function FilterTab({ label, count, active, onClick, tone }: { label: string; count: number; active: boolean; onClick: () => void; tone?: string }) {
  const t = STAFF_TOKENS;
  const accent = tone || t.teal;
  return (
    <button
      onClick={onClick}
      style={{
        height: 28, padding: "0 10px",
        display: "inline-flex", alignItems: "center", gap: 6,
        background: active ? accent + "12" : "#fff",
        border: `1px solid ${active ? accent + "66" : t.border}`,
        borderRadius: 14, fontSize: 12, color: t.ink,
        cursor: "pointer", fontFamily: "inherit",
        fontWeight: active ? 500 : 400,
      }}
    >
      <span style={{ color: active ? accent : t.inkMuted }}>{label}</span>
      <span style={{
        fontFamily: t.mono, fontSize: 10.5,
        color: active ? accent : t.inkFaint,
      }}>{count}</span>
    </button>
  );
}
