"use client";
import React from "react";

// Surface — Prep (crop & deskew), the first stage of the Scan Pipeline. A contact-sheet grid:
// one tile per raw flatbed scan (raw ▸ cropped), keyed by CHC ID. Auto-crop runs the texture
// engine over raw/; unflagged tiles default to approvable, flagged tiles are highlighted and
// hand-fixable in the crop editor. "Approve all" writes the lossless masters/<CHC>.tif that the
// downstream Run stage (Scan pipeline) ingests. Glance-paced — a crop is verifiable in a thumb.
//
// Spec: prep-surface.md. Mirrors the Scan inbox's one-at-a-time progress (components/scan/ingest).

import { prepApi } from "@/lib/prep-api";
import { STAFF_TOKENS } from "@/lib/tokens";
import type { StaffTokens } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import { pillBtn } from "@/components/staff/ui";
import { ServerNeeded, CenterNote } from "@/components/scan/pipeline";
import { PrepEditor } from "@/components/scan/prep-editor";
import { FLAG_LABELS } from "@/components/scan/prep-flags";
import type { PrepRecord, PrepStatus, RawEntry } from "@/lib/types";

type Filter = "all" | "new" | "auto_ok" | "flagged" | "fixed" | "approved";
const APPROVABLE: PrepStatus[] = ["auto_ok", "fixed"];

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function ScanPrep() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const [rows, setRows] = React.useState<RawEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [editing, setEditing] = React.useState<RawEntry | null>(null);
  const [runningId, setRunningId] = React.useState<string | null>(null);
  const [batch, setBatch] = React.useState<{ done: number; total: number; phase: string } | null>(null);
  const [stat, setStat] = React.useState<{ processed: number; flagged: number; ms: number } | null>(null);
  const [ver, setVer] = React.useState(0);

  const reload = React.useCallback(() => {
    prepApi.raws().then(setRows).catch((e) => setError(e.message));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  if (error) return <ServerNeeded error={error} />;
  if (!rows) return <CenterNote text="Scanning raw/ …" />;

  const patchRow = (rec: PrepRecord) => {
    setRows((rs) => rs && rs.map((r) => (r.chc_id === rec.chc_id ? {
      ...r, status: rec.status, flags: rec.flags, raw_preview: rec.raw_preview,
      crop_preview: rec.crop_preview, box: rec.box, raw_w: rec.raw_w, raw_h: rec.raw_h,
    } : r)));
    setVer((v) => v + 1);
  };

  const counts: Record<Filter, number> = {
    all: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    auto_ok: rows.filter((r) => r.status === "auto_ok").length,
    flagged: rows.filter((r) => r.status === "flagged").length,
    fixed: rows.filter((r) => r.status === "fixed").length,
    approved: rows.filter((r) => r.status === "approved").length,
  };
  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  const busy = !!batch;

  // ── Auto-crop the unprocessed (status "new") raw scans, one at a time with live progress ──
  async function autoCropNew() {
    const queue = rows!.filter((r) => r.status === "new");
    if (!queue.length) return;
    let processed = 0, flagged = 0, ms = 0;
    setStat(null);
    setBatch({ done: 0, total: queue.length, phase: "Auto-cropping" });
    for (const r of queue) {
      setRunningId(r.chc_id);
      const res = await prepApi.auto(r.chc_id);
      if (res.ok && res.record) {
        patchRow(res.record);
        processed++;
        if (res.record.flags.length) flagged++;
        ms += res.record.ms || 0;
      } else {
        nav.toast(`${r.chc_id}: ${res.error || "crop failed"}`, "warn");
      }
      setBatch((b) => (b ? { ...b, done: b.done + 1 } : b));
    }
    setRunningId(null);
    setBatch(null);
    setStat({ processed, flagged, ms });
    nav.toast(`Cropped ${processed} · ${flagged} flagged · ${fmtMs(ms)}`, flagged ? "warn" : "ok");
  }

  // ── Approve all auto_ok + fixed tiles → write masters/, hand off to the Run stage ──
  async function approveAll() {
    const queue = rows!.filter((r) => APPROVABLE.includes(r.status as PrepStatus));
    if (!queue.length) return nav.toast("Nothing approvable — auto-crop or fix flagged tiles first", "info");
    let ok = 0;
    setBatch({ done: 0, total: queue.length, phase: "Writing masters" });
    for (const r of queue) {
      setRunningId(r.chc_id);
      const res = await prepApi.apply(r.chc_id);
      if (res.ok && res.record) { patchRow(res.record); ok++; }
      else nav.toast(`${r.chc_id}: ${res.error || "apply failed"}`, "warn");
      setBatch((b) => (b ? { ...b, done: b.done + 1 } : b));
    }
    setRunningId(null);
    setBatch(null);
    nav.toast(`Wrote ${ok} master${ok === 1 ? "" : "s"} → ready to ingest in Scan pipeline`, "ok");
  }

  const newCount = counts.new;
  const approvableCount = rows.filter((r) => APPROVABLE.includes(r.status as PrepStatus)).length;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: t.bg, overflow: "hidden" }}>
      {/* Top bar — filters + actions */}
      <div style={{
        padding: "12px 24px", background: t.bgSurface, borderBottom: `1px solid ${t.borderSoft}`,
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0,
      }}>
        <FilterTab label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterTab label="New" count={counts.new} active={filter === "new"} onClick={() => setFilter("new")} tone={t.inkMuted} />
        <FilterTab label="Auto-OK" count={counts.auto_ok} active={filter === "auto_ok"} onClick={() => setFilter("auto_ok")} tone={t.sage} />
        <FilterTab label="Flagged" count={counts.flagged} active={filter === "flagged"} onClick={() => setFilter("flagged")} tone={t.ochre} />
        <FilterTab label="Fixed" count={counts.fixed} active={filter === "fixed"} onClick={() => setFilter("fixed")} tone={t.teal} />
        <FilterTab label="Approved" count={counts.approved} active={filter === "approved"} onClick={() => setFilter("approved")} tone={t.teal} />

        <div style={{ flex: 1 }} />

        {stat && !busy && (
          <span title="staff-time-saved metric for this stage" style={{
            fontFamily: t.mono, fontSize: 10.5, color: t.inkMuted, letterSpacing: 0.3,
            border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: "4px 10px",
          } as React.CSSProperties}>
            {stat.processed} processed · {stat.flagged} flagged · {fmtMs(stat.ms)}
          </span>
        )}
        <button onClick={autoCropNew} disabled={busy || newCount === 0} style={{ ...pillBtn(t, false), opacity: busy || newCount === 0 ? 0.5 : 1, cursor: busy || newCount === 0 ? "default" : "pointer" }}>
          {batch?.phase === "Auto-cropping" ? `Cropping ${batch.done}/${batch.total}…` : `Auto-crop raw/ ${newCount ? `(${newCount})` : ""} ↓`.trim()}
        </button>
        <button onClick={approveAll} disabled={busy || approvableCount === 0} style={{ ...pillBtn(t, true), opacity: busy || approvableCount === 0 ? 0.5 : 1, cursor: busy || approvableCount === 0 ? "default" : "pointer" }}>
          {batch?.phase === "Writing masters" ? `Writing ${batch.done}/${batch.total}…` : `Approve all → masters ${approvableCount ? `(${approvableCount})` : ""}`.trim()}
        </button>
      </div>

      {/* Progress bar */}
      {batch && (
        <div style={{ height: 3, background: t.borderSoft, flexShrink: 0 }}>
          <div style={{ width: `${batch.total ? Math.round((batch.done / batch.total) * 100) : 0}%`, height: "100%", background: t.teal, transition: "width 180ms ease-out" }} />
        </div>
      )}

      {/* The contact sheet */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 18 }}>
        {rows.length === 0 ? (
          <EmptyState t={t} />
        ) : shown.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: t.inkFaint, fontSize: 13 }}>No tiles match this filter.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 14 }}>
            {shown.map((r) => (
              <Tile key={r.chc_id} r={r} ver={ver} running={runningId === r.chc_id}
                onOpen={() => { if (r.raw_w) setEditing(r); else nav.toast("Auto-crop first to detect a box", "info"); }} t={t} />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {rows.length > 0 && (
        <div style={{ padding: "10px 24px", borderTop: `1px solid ${t.borderSoft}`, fontFamily: t.mono, fontSize: 11, color: t.inkFaint, letterSpacing: 0.3, textAlign: "center", flexShrink: 0 }}>
          {rows.length} raw scan{rows.length === 1 ? "" : "s"} · {counts.approved} written to masters/ · click a tile to hand-fix its crop
        </div>
      )}

      {editing && (
        <PrepEditor entry={editing} onClose={() => setEditing(null)} onSaved={(rec) => { patchRow(rec); setEditing((e) => (e ? { ...e, box: rec.box, status: rec.status, flags: rec.flags, raw_w: rec.raw_w, raw_h: rec.raw_h } : e)); }} />
      )}
    </div>
  );
}

function EmptyState({ t }: { t: StaffTokens }) {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center" }}>
      <div style={{ fontFamily: t.serif, fontSize: 18, color: t.ink, marginBottom: 6 }}>No raw scans yet</div>
      <div style={{ fontSize: 13, color: t.inkMuted, lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
        Drop raw flatbed scans (<span style={{ fontFamily: t.mono }}>raw/&lt;CHC_ID&gt;.tif</span>) into the{" "}
        <span style={{ fontFamily: t.mono }}>raw/</span> folder, then click{" "}
        <span style={{ color: t.ink, fontWeight: 500 }}>Auto-crop raw/ ↓</span>. Start with ~15–20 to tune,
        then run the rest. Approved crops are written to <span style={{ fontFamily: t.mono }}>masters/</span> for the Scan pipeline.
      </div>
    </div>
  );
}

// ── One contact-sheet tile: raw ▸ cropped, id, status, flags ──
function Tile({ r, ver, running, onOpen, t }: { r: RawEntry; ver: number; running: boolean; onOpen: () => void; t: StaffTokens }) {
  const flagged = r.status === "flagged";
  const approved = r.status === "approved";
  const bust = (s: string | null) => (s ? `${s}?v=${ver}` : null);
  const accent = flagged ? t.ochre : approved ? t.sage : t.border;
  return (
    <div onClick={onOpen} style={{
      background: t.bgPanel, border: `1px solid ${flagged ? t.ochre + "88" : t.border}`,
      borderLeft: `3px solid ${accent}`, borderRadius: 8, overflow: "hidden", cursor: "pointer",
      boxShadow: flagged ? `0 0 0 3px ${t.ochre}1A` : "none",
      opacity: running ? 0.6 : 1, transition: "opacity 150ms",
    }}>
      {/* raw ▸ crop */}
      <div style={{ display: "flex", gap: 1, background: t.borderSoft, height: 130 }}>
        <Thumb src={bust(r.raw_preview)} label="raw" t={t} />
        <Thumb src={bust(r.crop_preview)} label="crop" t={t} />
      </div>
      {/* meta */}
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontFamily: t.mono, fontSize: 11.5, color: t.ink, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties}>{r.chc_id}</span>
          <StatusPill status={r.status} t={t} />
        </div>
        {r.flags.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {r.flags.map((f) => (
              <span key={f} title={FLAG_LABELS[f]?.hint || f} style={{
                fontSize: 9.5, color: t.ochre, background: t.ochreSoft, border: `1px solid ${t.ochre}44`,
                padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
              } as React.CSSProperties}>{FLAG_LABELS[f]?.label || f}</span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: t.mono }}>
            {running ? "working…" : r.status === "new" ? "not cropped yet" : "looks clean"}
          </div>
        )}
      </div>
    </div>
  );
}

function Thumb({ src, label, t }: { src: string | null; label: string; t: StaffTokens }) {
  return (
    <div style={{ flex: 1, minWidth: 0, position: "relative", background: "#1A1814", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {src
        ? <img src={src} alt="" loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
        : <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }}>—</span>}
      <span style={{ position: "absolute", left: 4, bottom: 3, fontFamily: t.mono, fontSize: 8.5, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.7)", background: "rgba(0,0,0,0.4)", padding: "1px 4px", borderRadius: 2 } as React.CSSProperties}>{label}</span>
    </div>
  );
}

function StatusPill({ status, t }: { status: PrepStatus | "new"; t: StaffTokens }) {
  const map: Record<string, { c: string; label: string }> = {
    new: { c: t.inkFaint, label: "new" },
    auto_ok: { c: t.sage, label: "auto-ok" },
    flagged: { c: t.ochre, label: "flagged" },
    fixed: { c: t.teal, label: "fixed" },
    approved: { c: t.teal, label: "approved" },
    pending: { c: t.terracotta, label: "error" },
  };
  const m = map[status] || map.new;
  return (
    <span style={{ fontSize: 9.5, color: m.c, background: m.c + "18", padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap", fontWeight: 500, flexShrink: 0 } as React.CSSProperties}>{m.label}</span>
  );
}

function FilterTab({ label, count, active, onClick, tone }: { label: string; count: number; active: boolean; onClick: () => void; tone?: string }) {
  const t = STAFF_TOKENS;
  const accent = tone || t.teal;
  return (
    <button onClick={onClick} style={{
      height: 28, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6,
      background: active ? accent + "12" : "#fff", border: `1px solid ${active ? accent + "66" : t.border}`,
      borderRadius: 14, fontSize: 12, color: t.ink, cursor: "pointer", fontFamily: "inherit", fontWeight: active ? 500 : 400,
    }}>
      <span style={{ color: active ? accent : t.inkMuted }}>{label}</span>
      <span style={{ fontFamily: t.mono, fontSize: 10.5, color: active ? accent : t.inkFaint }}>{count}</span>
    </button>
  );
}
