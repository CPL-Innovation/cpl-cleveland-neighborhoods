"use client";
import React from "react";

// Scan inbox — UI-driven ingest. Lists the local masters/ folder (new vs. already-ingested)
// and runs derive → store → VLM → DB one photo at a time, with live per-row progress.
// Derivation is local-only, so this is a dev/local convenience; the API refuses in serverless.

import { STAFF_TOKENS } from "@/lib/tokens";
import type { StaffTokens } from "@/lib/tokens";
import { scanApi } from "@/lib/scan-api";
import { pillBtn, Kbd } from "@/components/staff/ui";
import type { MasterEntry } from "@/lib/scan-ingest";

type RowState = "idle" | "queued" | "running" | "done" | "skipped" | "failed";
interface Row extends MasterEntry {
  sel: boolean;
  state: RowState;
  note?: string;
}

function fmtSize(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const defaultSel = (s: MasterEntry["status"]) => s === "new" || s === "failed";

export function ScanInbox({
  open,
  onClose,
  onIngested,
}: {
  open: boolean;
  onClose: () => void;
  onIngested: () => void;
}) {
  const t = STAFF_TOKENS;
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  const load = React.useCallback(() => {
    setRows(null);
    setError(null);
    setProgress(null);
    scanApi
      .masters()
      .then((m) => setRows(m.map((x) => ({ ...x, sel: defaultSel(x.status), state: "idle" as RowState }))))
      .catch((e) => setError(e.message));
  }, []);

  React.useEffect(() => { if (open) load(); }, [open, load]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !running) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, running, onClose]);

  if (!open) return null;

  const total = rows?.length ?? 0;
  const newCount = rows?.filter((r) => r.status === "new").length ?? 0;
  const selCount = rows?.filter((r) => r.sel).length ?? 0;

  const patch = (id: string, next: Partial<Row>) =>
    setRows((rs) => (rs ? rs.map((r) => (r.chc_id === id ? { ...r, ...next } : r)) : rs));
  const setAll = (sel: boolean) => setRows((rs) => (rs ? rs.map((r) => ({ ...r, sel })) : rs));
  const selectNew = () => setRows((rs) => (rs ? rs.map((r) => ({ ...r, sel: defaultSel(r.status) })) : rs));

  async function run() {
    if (!rows) return;
    const queue = rows.filter((r) => r.sel);
    if (!queue.length) return;
    setRunning(true);
    setProgress({ done: 0, total: queue.length });
    setRows((rs) => (rs ? rs.map((r) => (r.sel ? { ...r, state: "queued" as RowState, note: undefined } : r)) : rs));

    let done = 0;
    for (const item of queue) {
      patch(item.chc_id, { state: "running" });
      try {
        // Already-in-pipeline rows need force; new/failed run without it.
        const res = await scanApi.ingest(item.chc_id, item.status !== "new");
        patch(item.chc_id, {
          state: res.ok ? (res.skipped ? "skipped" : "done") : "failed",
          status: res.status,
          sel: false,
          note: res.ok ? (res.stub ? "stub read (no GEMINI_API_KEY)" : undefined) : res.reason || "failed",
        });
        if (res.ok && !res.skipped) onIngested(); // refresh the pipeline behind, incrementally
      } catch (e) {
        patch(item.chc_id, { state: "failed", note: (e as Error).message });
      }
      done++;
      setProgress({ done, total: queue.length });
    }
    setRunning(false);
    onIngested();
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div
      onClick={() => { if (!running) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(26,24,20,0.42)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      } as React.CSSProperties}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 100%)", maxHeight: "82vh",
          background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: t.serif, fontSize: 19, fontWeight: 500, color: t.ink }}>Scan inbox</div>
            <div style={{ fontSize: 12.5, color: t.inkMuted, marginTop: 2 }}>
              <span style={{ fontFamily: t.mono }}>masters/</span>
              {rows ? <> · {total} {total === 1 ? "file" : "files"} · <span style={{ color: newCount ? t.teal : t.inkMuted }}>{newCount} new</span></> : " · scanning…"}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={running}
            title={running ? "ingesting…" : "Close (Esc)"}
            style={{
              background: "transparent", border: "none", color: t.inkMuted,
              fontSize: 20, lineHeight: 1, cursor: running ? "default" : "pointer", padding: 2, opacity: running ? 0.4 : 1,
            }}
          >×</button>
        </div>

        {/* Toolbar */}
        {rows && rows.length > 0 && (
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${t.borderSoft}`, background: t.bgSurface, display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
            <LinkBtn onClick={selectNew} disabled={running} t={t}>Select new</LinkBtn>
            <LinkBtn onClick={() => setAll(true)} disabled={running} t={t}>Select all</LinkBtn>
            <LinkBtn onClick={() => setAll(false)} disabled={running} t={t}>Clear</LinkBtn>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkMuted }}>{selCount} selected</span>
            <button onClick={run} disabled={running || selCount === 0} style={{ ...pillBtn(t, true), opacity: running || selCount === 0 ? 0.5 : 1, cursor: running || selCount === 0 ? "default" : "pointer" }}>
              {running ? `Ingesting ${progress?.done ?? 0}/${progress?.total ?? 0}…` : `Ingest ${selCount || ""}`.trim()}
            </button>
          </div>
        )}

        {/* Progress bar */}
        {progress && (
          <div style={{ height: 3, background: t.borderSoft }}>
            <div style={{ width: `${pct}%`, height: "100%", background: running ? t.teal : t.sage, transition: "width 200ms ease-out" }} />
          </div>
        )}

        {/* Body */}
        <div style={{ overflow: "auto", flex: 1 }}>
          {error ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 13.5, color: t.terracotta, marginBottom: 6 }}>Couldn’t read the masters folder</div>
              <div style={{ fontFamily: t.mono, fontSize: 11.5, color: t.inkMuted, lineHeight: 1.5 }}>{error}</div>
            </div>
          ) : !rows ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: t.inkMuted, fontSize: 13 }}>Scanning masters/ …</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontFamily: t.serif, fontSize: 16, color: t.ink, marginBottom: 6 }}>No TIFFs in masters/</div>
              <div style={{ fontSize: 12.5, color: t.inkMuted, lineHeight: 1.6 }}>
                Add box-scan <span style={{ fontFamily: t.mono }}>.tif</span> files to the{" "}
                <span style={{ fontFamily: t.mono }}>masters/</span> folder, then reopen this inbox.
              </div>
            </div>
          ) : (
            rows.map((r) => <InboxRow key={r.chc_id} r={r} running={running} onToggle={() => patch(r.chc_id, { sel: !r.sel })} t={t} />)
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: t.inkFaint }}>
          <span>Ingest derives a JPEG and runs the VLM locally — large TIFFs take a few seconds each.</span>
          <div style={{ flex: 1 }} />
          {!running && <span style={{ fontFamily: t.mono, fontSize: 10.5 }}><Kbd>Esc</Kbd> close</span>}
        </div>
      </div>
    </div>
  );
}

function InboxRow({ r, running, onToggle, t }: { r: Row; running: boolean; onToggle: () => void; t: StaffTokens }) {
  const busy = r.state === "running";
  return (
    <div
      onClick={() => { if (!running) onToggle(); }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 20px", borderBottom: `1px solid ${t.borderSoft}`,
        cursor: running ? "default" : "pointer",
        background: r.sel && !running ? t.tealSoft + "55" : "transparent",
      } as React.CSSProperties}
    >
      <Check checked={r.sel} disabled={running} t={t} />
      <span style={{ fontFamily: t.mono, fontSize: 12, color: t.ink, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties}>
        {r.file}
      </span>
      {r.note && <span style={{ fontSize: 11, color: r.state === "failed" ? t.terracotta : t.inkFaint, whiteSpace: "nowrap" } as React.CSSProperties}>{r.note}</span>}
      <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint, minWidth: 56, textAlign: "right" } as React.CSSProperties}>{fmtSize(r.size)}</span>
      <span style={{ minWidth: 92, display: "flex", justifyContent: "flex-end" }}>
        {busy ? <Spinner t={t} /> : <StateBadge r={r} t={t} />}
      </span>
    </div>
  );
}

// Shows the ingest outcome once acted on, otherwise the master's pipeline status.
function StateBadge({ r, t }: { r: Row; t: StaffTokens }) {
  const map: Record<string, { c: string; label: string }> = {
    done: { c: t.sage, label: "✓ added" },
    skipped: { c: t.inkFaint, label: "skipped" },
    failed: { c: t.terracotta, label: "failed" },
    queued: { c: t.inkFaint, label: "queued" },
    // master statuses (state === idle)
    new: { c: t.teal, label: "new" },
    ready: { c: t.sage, label: "in pipeline" },
    derived: { c: t.ochre, label: "partial" },
    discovered: { c: t.inkFaint, label: "queued" },
  };
  const key = r.state === "idle" ? r.status : r.state;
  const m = map[key] || map.new;
  return (
    <span style={{ fontSize: 10.5, color: m.c, background: m.c + "15", padding: "2px 7px", borderRadius: 3, whiteSpace: "nowrap", fontWeight: 500 } as React.CSSProperties}>
      {m.label}
    </span>
  );
}

function Spinner({ t }: { t: StaffTokens }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: t.teal, fontFamily: t.mono }}>
      <span style={{
        width: 11, height: 11, borderRadius: "50%",
        border: `2px solid ${t.teal}40`, borderTopColor: t.teal,
        display: "inline-block", animation: "spin 0.7s linear infinite",
      } as React.CSSProperties} />
      ingesting
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function Check({ checked, disabled, t }: { checked: boolean; disabled?: boolean; t: StaffTokens }) {
  return (
    <div style={{
      width: 15, height: 15, flexShrink: 0,
      border: `1.4px solid ${checked ? t.teal : t.border}`, borderRadius: 3,
      background: checked ? t.teal : "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: disabled ? 0.5 : 1,
    }}>
      {checked && (
        <svg width="9" height="9" viewBox="0 0 9 9">
          <path d="M1.5 4.5 L3.5 6.5 L7.5 2" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function LinkBtn({ children, onClick, disabled, t }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; t: StaffTokens }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: "transparent", border: "none", padding: 0,
      color: disabled ? t.inkFaint : t.teal, fontSize: 12, fontFamily: "inherit",
      cursor: disabled ? "default" : "pointer",
    }}>{children}</button>
  );
}
