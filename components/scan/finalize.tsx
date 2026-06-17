"use client";
// Finalize stage (Tier-1 normalize + unify) — the terminal box-scan stage.
// Canonical intent: build/data-backend/tier1-normalize-unify-spec.md §"Finalize stage".
//
// Hosts the three things the spec calls for:
//   1. The "Finalize" button — a batch over the reviewed-and-accepted set that normalizes the
//      confirmed Tier-1 fields (caption copy · stamp-date parse · geocode) and writes each into the
//      unified Photos table (photo_enrichment, source = box_scan).
//   2. The geocode-miss exception tray — the handful that don't auto-geocode surface as "N need a
//      pin"; staff type coordinates → geo_source = staff_lookup. The only manual touch.
//   3. A status line — "X of N normalized · Z awaiting pins."
// Local-only (geocoding hits the network from a local job); the API 403s in serverless.
import React from "react";
import { STAFF_TOKENS } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import { pillBtn, inputStyle } from "@/components/staff/ui";
import { scanApi } from "@/lib/scan-api";
import type { FinalizeRow, FinalizeState } from "@/lib/finalize-store";

type Counts = Record<FinalizeState | "reviewed" | "total", number>;

const STATE_LABEL: Record<FinalizeState, { label: string; tone: (t: typeof STAFF_TOKENS) => string }> = {
  pending: { label: "pending", tone: (t) => t.inkFaint },
  finalized: { label: "↑ unified", tone: (t) => t.sage },
  needs_pin: { label: "⚑ needs pin", tone: (t) => t.terracotta },
};

export function ScanFinalize() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const [rows, setRows] = React.useState<FinalizeRow[]>([]);
  const [counts, setCounts] = React.useState<Counts | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    scanApi
      .finalizeList()
      .then((d) => {
        setRows(d.rows);
        setCounts(d.counts);
        setErr(null);
        setActiveId((cur) => cur ?? d.rows.find((r) => r.state === "needs_pin")?.chc_id ?? d.rows[0]?.chc_id ?? null);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(load, [load]);

  const runFinalize = async () => {
    setRunning(true);
    try {
      const res = await scanApi.finalizeRun();
      nav.toast(
        `Finalized ${res.processed}: ${res.finalized} placed · ${res.needPins} need pins` +
          (res.skipped ? ` · ${res.skipped} already done` : ""),
        res.needPins ? "info" : "ok"
      );
      load();
    } catch (e) {
      nav.toast((e as Error).message, "warn");
    } finally {
      setRunning(false);
    }
  };

  const active = rows.find((r) => r.chc_id === activeId) || null;
  const pending = counts?.pending ?? 0;

  if (loading) return <Centered t={t}>Loading the Finalize worklist…</Centered>;
  if (err)
    return (
      <Centered t={t}>
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div style={{ fontFamily: t.serif, fontSize: 18, color: t.ink, marginBottom: 8 }}>Finalize unavailable</div>
          <div style={{ color: t.inkMuted, fontSize: 13, lineHeight: 1.5 }}>{err}</div>
          <div style={{ color: t.inkFaint, fontSize: 12, marginTop: 10, fontFamily: t.mono }}>
            Reviewed box-scans (Ingest → Review) feed this stage.
          </div>
        </div>
      </Centered>
    );

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: t.bg, overflow: "hidden" }}>
      {/* Status bar + Finalize button */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: t.inkMuted }}>
            Box-scan 99 → first-class photos
          </div>
          <div style={{ fontSize: 13, color: t.ink, marginTop: 3 }}>
            <span style={{ color: t.sage, fontWeight: 600 }}>{counts?.finalized ?? 0}</span> of {counts?.total ?? 0} normalized
            {(counts?.needs_pin ?? 0) > 0 && (
              <> · <span style={{ color: t.terracotta, fontWeight: 600 }}>{counts?.needs_pin}</span> awaiting pins</>
            )}
            {pending > 0 && <> · <span style={{ color: t.inkMuted }}>{pending} pending</span></>}
          </div>
        </div>
        <button
          onClick={runFinalize}
          disabled={running || pending === 0}
          title={pending === 0 ? "nothing pending — all reviewed box-scans are normalized" : "normalize the pending reviewed set into the unified Photos table"}
          style={{ ...pillBtn(t, true), height: 34, opacity: running || pending === 0 ? 0.5 : 1 }}
        >
          {running ? "Finalizing…" : pending > 0 ? `Finalize ${pending} pending` : "All finalized"}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        {/* Worklist */}
        <div style={{ width: 264, borderRight: `1px solid ${t.border}`, overflowY: "auto" }}>
          {rows.map((r) => {
            const s = STATE_LABEL[r.state];
            return (
              <div
                key={r.chc_id}
                onClick={() => setActiveId(r.chc_id)}
                style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", cursor: "pointer",
                  background: r.chc_id === activeId ? t.bgPanel : "transparent",
                  borderLeft: `2px solid ${r.chc_id === activeId ? t.terracotta : "transparent"}`,
                  borderBottom: `1px solid ${t.borderSoft}`,
                }}
              >
                <img src={r.jpeg_url} alt="" style={{ width: 40, height: 30, objectFit: "cover", borderRadius: 3, background: t.bg, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: t.ink, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.address || r.chc_id}
                  </div>
                  <div style={{ fontFamily: t.mono, fontSize: 9.5, color: s.tone(t) }}>{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail */}
        {active ? (
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
            <div style={{ padding: "18px 24px", maxWidth: 760, display: "flex", gap: 22 }}>
              <img src={active.jpeg_url} alt={active.chc_id} style={{ width: 300, borderRadius: 6, border: `1px solid ${t.border}`, alignSelf: "flex-start" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: t.serif, fontSize: 19, color: t.ink, marginBottom: 2 }}>{active.chc_id}</div>
                <StateLine t={t} row={active} />

                <Section t={t} label="Confirmed Tier-1 (the inputs)">
                  <KV t={t} k="caption" v={active.caption || "—"} />
                  <KV t={t} k="address" v={active.address || "—"} />
                  <KV t={t} k="year (stamp)" v={active.year || "—"} />
                </Section>

                <Section t={t} label="Normalized (the outputs)">
                  <KV t={t} k="date_start" v={active.date_start ? `${active.date_start}  ·  archival_stamp` : "—"} />
                  <KV
                    t={t}
                    k="coordinates"
                    v={active.lat != null && active.lng != null ? `${active.lat.toFixed(5)}, ${active.lng.toFixed(5)}  ·  ${active.geo_source}` : "—"}
                  />
                </Section>

                {active.state === "needs_pin" && <PinTray t={t} row={active} onSaved={load} nav={nav} />}

                {active.state === "pending" && (
                  <div style={{ marginTop: 16, fontSize: 12.5, color: t.inkMuted, lineHeight: 1.5 }}>
                    Not yet normalized. Run <b>Finalize</b> above to copy the caption, parse the stamp date, and geocode the address.
                  </div>
                )}

                <div style={{ fontSize: 11, color: t.inkFaint, fontStyle: "italic", marginTop: 18 }}>
                  Confirmed fields only — Finalize runs on human-reviewed Tier-1 facts, never raw VLM output. The
                  <code> archival_stamp</code> tag records that the timeline positions this photo at its cataloging date.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Centered t={t}>No reviewed box-scans yet</Centered>
        )}
      </div>
    </div>
  );
}

function StateLine({ t, row }: { t: typeof STAFF_TOKENS; row: FinalizeRow }) {
  const s = STATE_LABEL[row.state];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <span style={{ fontFamily: t.mono, fontSize: 10.5, color: s.tone(t), background: t.bgPanel, border: `1px solid ${t.borderSoft}`, padding: "2px 8px", borderRadius: 3 }}>
        {s.label}
      </span>
      {row.state === "needs_pin" && row.miss_reason && (
        <span style={{ fontSize: 11.5, color: t.inkMuted, fontStyle: "italic" }}>{row.miss_reason}</span>
      )}
    </div>
  );
}

function PinTray({ t, row, onSaved, nav }: { t: typeof STAFF_TOKENS; row: FinalizeRow; onSaved: () => void; nav: ReturnType<typeof useNav> }) {
  const [lat, setLat] = React.useState(row.lat != null ? String(row.lat) : "");
  const [lng, setLng] = React.useState(row.lng != null ? String(row.lng) : "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLat(row.lat != null ? String(row.lat) : "");
    setLng(row.lng != null ? String(row.lng) : "");
  }, [row.chc_id, row.lat, row.lng]);

  const valid = Number.isFinite(Number(lat)) && lat.trim() !== "" && Number.isFinite(Number(lng)) && lng.trim() !== "";
  const lookupUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent((row.address || "") + ", Cleveland, Ohio")}`;

  const save = async () => {
    setSaving(true);
    try {
      await scanApi.finalizePin(row.chc_id, Number(lat), Number(lng));
      nav.toast(`Pinned ${row.chc_id} · staff_lookup`, "ok");
      onSaved();
    } catch (e) {
      nav.toast((e as Error).message, "warn");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 14, border: `1px solid ${t.terracotta}33`, background: `${t.terracotta}0D`, borderRadius: 8 }}>
      <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 500, marginBottom: 8 }}>Drop a pin (geo_source = staff_lookup)</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat (41.49…)" style={{ ...inputStyle(t, { height: 30, width: 130 }) }} />
        <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="lng (-81.69…)" style={{ ...inputStyle(t, { height: 30, width: 130 }) }} />
        <button onClick={save} disabled={!valid || saving} style={{ ...pillBtn(t, true), opacity: !valid || saving ? 0.5 : 1 }}>
          {saving ? "Saving…" : "Save pin"}
        </button>
      </div>
      <a href={lookupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: t.teal }}>
        ↗ Find coordinates for “{row.address || row.chc_id}” on OpenStreetMap
      </a>
    </div>
  );
}

function Section({ t, label, children }: { t: typeof STAFF_TOKENS; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: t.inkMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{children}</div>
    </div>
  );
}

function KV({ t, k, v }: { t: typeof STAFF_TOKENS; k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.45 }}>
      <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkFaint, width: 96, flexShrink: 0 }}>{k}</span>
      <span style={{ color: t.ink, minWidth: 0 }}>{v}</span>
    </div>
  );
}

function Centered({ t, children }: { t: typeof STAFF_TOKENS; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg, color: t.inkMuted, fontSize: 13 }}>
      {children}
    </div>
  );
}
