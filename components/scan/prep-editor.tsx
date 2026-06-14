"use client";
import React from "react";

// Prep crop editor — the hand-fix surface for a flagged (or any) tile. Shows the raw scan with
// an interactive crop box (drag to move · corner handles to resize · top handle to rotate),
// pre-filled with the engine's auto-detected box. The box lives in RAW full-res pixels; we map
// to/from screen with one uniform scale. "Looser/Tighter" re-runs detection; "Save" re-renders
// the crop (status → fixed); "Approve" also writes masters/<chc>.tif.
//
// Spec: prep-surface.md §"Fix a flagged tile".

import { STAFF_TOKENS } from "@/lib/tokens";
import type { StaffTokens } from "@/lib/tokens";
import { prepApi } from "@/lib/prep-api";
import { pillBtn } from "@/components/staff/ui";
import { FLAG_LABELS } from "@/components/scan/prep-flags";
import type { PrepBox, PrepRecord, RawEntry } from "@/lib/types";

const MAX_W = 540;
const MAX_H = 460;
const MIN_PX = 16; // smallest crop edge (raw px)

type DragMode = null | { kind: "move" | "rotate" } | { kind: "corner"; i: number };

function rot(x: number, y: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}
// corner local offsets (unrotated), order TL, TR, BR, BL
const CORNERS: [number, number][] = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];

export function PrepEditor({
  entry, onClose, onSaved,
}: {
  entry: RawEntry;
  onClose: () => void;
  onSaved: (rec: PrepRecord) => void;
}) {
  const t = STAFF_TOKENS;
  const rawW = entry.raw_w || 1000;
  const rawH = entry.raw_h || 1000;
  const scale = Math.min(MAX_W / rawW, MAX_H / rawH);
  const imgW = rawW * scale, imgH = rawH * scale;

  const [box, setBox] = React.useState<PrepBox>(
    entry.box ?? { cx: rawW / 2, cy: rawH / 2, w: rawW * 0.9, h: rawH * 0.9, angle: 0 }
  );
  const [mult, setMult] = React.useState(1);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [ver, setVer] = React.useState(0); // bumps to cache-bust the crop preview <img>
  const [cropSrc, setCropSrc] = React.useState(entry.crop_preview);
  const [rawSrc] = React.useState(entry.raw_preview);
  const flags = entry.flags || [];

  const stageRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ mode: DragMode; start: PrepBox; anchor?: [number, number] } | null>(null);

  // client px → raw px
  const toImg = (cx: number, cy: number): [number, number] => {
    const r = stageRef.current!.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const imgSpace = (b: PrepBox, i: number): [number, number] => {
    const [lx, ly] = [CORNERS[i][0] * b.w, CORNERS[i][1] * b.h];
    const [rx, ry] = rot(lx, ly, b.angle);
    return [b.cx + rx, b.cy + ry];
  };

  const onDown = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const start = { ...box };
    const d: { mode: DragMode; start: PrepBox; anchor?: [number, number] } = { mode, start };
    if (mode && mode.kind === "corner") d.anchor = imgSpace(start, (mode.i + 2) % 4);
    drag.current = d;
  };

  // ── pointer drag wired on window while a drag is active ──
  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || !d.mode) return;
      const [px, py] = toImg(e.clientX, e.clientY);
      if (d.mode.kind === "move") {
        setBox((b) => ({ ...b, cx: clamp(px, 0, rawW), cy: clamp(py, 0, rawH) }));
      } else if (d.mode.kind === "rotate") {
        const a = (Math.atan2(py - d.start.cy, px - d.start.cx) * 180) / Math.PI + 90;
        setBox((b) => ({ ...b, angle: clamp(((a + 180) % 360) - 180, -89, 89) }));
      } else if (d.mode.kind === "corner") {
        const [ax, ay] = d.anchor!;
        const cx = (ax + px) / 2, cy = (ay + py) / 2;
        const [lx, ly] = rot(px - cx, py - cy, -d.start.angle);
        setBox((b) => ({
          ...b,
          cx: clamp(cx, 0, rawW), cy: clamp(cy, 0, rawH),
          w: Math.max(MIN_PX, Math.abs(lx) * 2),
          h: Math.max(MIN_PX, Math.abs(ly) * 2),
        }));
      }
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [rawW, rawH, scale]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function reRun(nextMult: number) {
    setBusy("auto"); setErr(null);
    const r = await prepApi.auto(entry.chc_id, nextMult);
    setBusy(null);
    if (!r.ok || !r.record) { setErr(r.error || "engine failed"); return; }
    setMult(nextMult);
    if (r.record.box) setBox(r.record.box);
    setCropSrc(r.record.crop_preview); setVer((v) => v + 1);
  }

  async function save(approve: boolean) {
    setBusy(approve ? "approve" : "save"); setErr(null);
    const r = await prepApi.recrop(entry.chc_id, box);
    if (!r.ok || !r.record) { setBusy(null); setErr(r.error || "save failed"); return; }
    setCropSrc(r.record.crop_preview); setVer((v) => v + 1);
    let rec = r.record;
    if (approve) {
      const a = await prepApi.apply(entry.chc_id);
      if (!a.ok || !a.record) { setBusy(null); setErr(a.error || "apply failed"); return; }
      rec = a.record;
    }
    setBusy(null);
    onSaved(rec);
    if (approve) onClose();
  }

  const bust = (src: string | null) => (src ? `${src}?v=${ver}` : null);

  return (
    <div onClick={() => !busy && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 9100, background: "rgba(26,24,20,0.5)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    } as React.CSSProperties}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12,
        boxShadow: "0 24px 60px rgba(0,0,0,0.32)", maxWidth: "min(1080px, 100%)", maxHeight: "92vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: t.serif, fontSize: 18, fontWeight: 500, color: t.ink }}>
              Crop · <span style={{ fontFamily: t.mono, fontSize: 14 }}>{entry.chc_id}</span>
            </div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 2 }}>
              {flags.length
                ? <>Flagged: {flags.map((f) => FLAG_LABELS[f]?.label || f).join(" · ")}</>
                : "Drag to move · corners to resize · top handle to rotate"}
            </div>
          </div>
          <button onClick={onClose} disabled={!!busy} style={{ background: "transparent", border: "none", color: t.inkMuted, fontSize: 20, lineHeight: 1, cursor: busy ? "default" : "pointer", opacity: busy ? 0.4 : 1 }}>×</button>
        </div>

        {/* Body: raw editor | crop result */}
        <div style={{ display: "flex", gap: 18, padding: 18, overflow: "auto" }}>
          <div>
            <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: t.inkFaint, marginBottom: 6 } as React.CSSProperties}>Raw scan</div>
            <div ref={stageRef} style={{ position: "relative", width: imgW, height: imgH, background: "#1A1814", borderRadius: 4, overflow: "hidden", touchAction: "none", userSelect: "none" } as React.CSSProperties}>
              {rawSrc && <img src={rawSrc} alt="" draggable={false} style={{ width: imgW, height: imgH, display: "block", pointerEvents: "none" }} />}
              {/* dim outside the crop via an SVG mask overlay */}
              <CropOverlay box={box} scale={scale} imgW={imgW} imgH={imgH} t={t} onDownBody={onDown({ kind: "move" })} onDownRotate={onDown({ kind: "rotate" })} onDownCorner={(i) => onDown({ kind: "corner", i })} />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: t.inkFaint, marginBottom: 6 } as React.CSSProperties}>Cropped result</div>
            <div style={{ width: MAX_W * 0.62, minHeight: 160, maxHeight: MAX_H, background: "#1A1814", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {bust(cropSrc)
                ? <img src={bust(cropSrc)!} alt="" style={{ maxWidth: "100%", maxHeight: MAX_H, display: "block" }} />
                : <span style={{ color: t.inkFaint, fontSize: 12 }}>Save to render the crop</span>}
            </div>
            <div style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint, marginTop: 8, lineHeight: 1.6 }}>
              angle {box.angle.toFixed(1)}° · {Math.round(box.w)}×{Math.round(box.h)} px<br />
              detect threshold ×{mult.toFixed(2)}
            </div>
          </div>
        </div>

        {err && <div style={{ padding: "0 20px 8px", color: t.terracotta, fontSize: 12, fontFamily: t.mono }}>{err}</div>}

        {/* Footer controls */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => reRun(Math.max(0.2, +(mult - 0.2).toFixed(2)))} disabled={!!busy} style={pillBtn(t, false)}>↤ Looser</button>
          <button onClick={() => reRun(1)} disabled={!!busy} style={pillBtn(t, false)}>Re-detect</button>
          <button onClick={() => reRun(+(mult + 0.2).toFixed(2))} disabled={!!busy} style={pillBtn(t, false)}>Tighter ↦</button>
          <div style={{ flex: 1 }} />
          {busy && <span style={{ fontSize: 11.5, color: t.teal, fontFamily: t.mono }}>{busy === "auto" ? "detecting…" : busy === "approve" ? "writing master…" : "rendering…"}</span>}
          <button onClick={() => save(false)} disabled={!!busy} style={pillBtn(t, false)}>Save crop</button>
          <button onClick={() => save(true)} disabled={!!busy} style={pillBtn(t, true)}>Approve → master</button>
        </div>
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function CropOverlay({
  box, scale, imgW, imgH, t, onDownBody, onDownRotate, onDownCorner,
}: {
  box: PrepBox; scale: number; imgW: number; imgH: number; t: StaffTokens;
  onDownBody: (e: React.PointerEvent) => void;
  onDownRotate: (e: React.PointerEvent) => void;
  onDownCorner: (i: number) => (e: React.PointerEvent) => void;
}) {
  const w = box.w * scale, h = box.h * scale;
  const cx = box.cx * scale, cy = box.cy * scale;
  const handle = (extra: React.CSSProperties) => ({
    position: "absolute" as const, width: 12, height: 12, background: "#fff",
    border: `2px solid ${t.teal}`, borderRadius: 2, ...extra,
  });
  return (
    <>
      {/* dim mask: four bars around the (unrotated bbox of the) crop give cheap focus.
          For a rotated box we just outline it; the dimming approximates with the rect. */}
      <div style={{
        position: "absolute", left: cx, top: cy, width: w, height: h,
        transform: `translate(-50%,-50%) rotate(${box.angle}deg)`,
        border: `2px solid ${t.teal}`, boxShadow: "0 0 0 9999px rgba(26,24,20,0.45)",
        cursor: "move",
      }} onPointerDown={onDownBody}>
        {/* rotation handle */}
        <div onPointerDown={onDownRotate} style={handle({ left: "50%", top: -26, transform: "translateX(-50%)", borderRadius: "50%", cursor: "grab" })} />
        <div style={{ position: "absolute", left: "50%", top: -16, width: 1, height: 16, background: t.teal, transform: "translateX(-50%)" }} />
        {/* corner handles TL TR BR BL */}
        <div onPointerDown={onDownCorner(0)} style={handle({ left: -6, top: -6, cursor: "nwse-resize" })} />
        <div onPointerDown={onDownCorner(1)} style={handle({ right: -6, top: -6, cursor: "nesw-resize" })} />
        <div onPointerDown={onDownCorner(2)} style={handle({ right: -6, bottom: -6, cursor: "nwse-resize" })} />
        <div onPointerDown={onDownCorner(3)} style={handle({ left: -6, bottom: -6, cursor: "nesw-resize" })} />
      </div>
      <span style={{ position: "absolute", left: 0, top: 0, width: imgW, height: imgH, pointerEvents: "none" }} />
    </>
  );
}
