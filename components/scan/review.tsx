"use client";
import React from "react";

// Surface B — Review & interpret (the heart).
// One photo at a time: zoomable image left, VLM claims + verdicts right.
// The reviewer reads the handwriting straight off the image; verdicts ARE the eval.
//
// Spec: scan-pipeline-ux.md §"Surface B" and §"Verdict & edit behavior".

import { STAFF_TOKENS } from "@/lib/tokens";
import type { StaffTokens } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import { scanApi } from "@/lib/scan-api";
import { useScanRecords, ServerNeeded, CenterNote } from "@/components/scan/pipeline";
import { Kbd, inputStyle, textareaStyle, FieldFoot, pillBtn } from "@/components/staff/ui";
import { normalizeAddress } from "@/lib/normalize-address";
import type { ScanRecord, Review, ReviewField, ReviewDescription } from "@/lib/types";

export function ScanReview() {
  const nav = useNav();
  const { records, error, reload } = useScanRecords();

  if (error) return <ServerNeeded error={error} />;
  if (!records) return <CenterNote text="Loading photos…" />;
  const ready = records.filter((r) => r.status === "ready");
  if (!ready.length) return <CenterNote text="No photos are ready to review yet. Run the pipeline first." />;

  const cur = records.find((r) => r.chc_id === nav.scanId && r.status === "ready") || ready[0];
  return <ScanReviewInner key={cur.chc_id} cur={cur} ready={ready} nav={nav} reload={reload} />;
}

function ScanReviewInner({
  cur,
  ready,
  nav,
  reload,
}: {
  cur: ScanRecord;
  ready: ScanRecord[];
  nav: ReturnType<typeof useNav>;
  reload: () => void;
}) {
  const t = STAFF_TOKENS;
  const idx = Math.max(0, ready.findIndex((r) => r.chc_id === cur.chc_id));
  const reviewedCount = ready.filter((r) => r.review?.status === "reviewed").length;

  const [review, setReview] = React.useState<Review>(() => ({ ...emptyClientReview(), ...(cur.review || {}) }));
  const [editing, setEditing] = React.useState({ address: false, year: false, description: false });
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist a review patch (debounced for text, immediate for verdict clicks).
  const persist = React.useCallback((next: Review, { immediate }: { immediate?: boolean } = {}) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const fire = () => scanApi.patch(cur.chc_id, { review: next }).catch((e: Error) => nav.toast(`Save failed: ${e.message}`, "warn"));
    if (immediate) fire(); else saveTimer.current = setTimeout(fire, 500);
  }, [cur.chc_id, nav]);

  const apply = React.useCallback((patch: Partial<Review>, opts?: { immediate?: boolean }) => {
    setReview((prev) => {
      const next = { ...prev, ...patch };
      persist(next, opts);
      return next;
    });
  }, [persist]);

  const gotoNext = React.useCallback(() => {
    const next = ready.find((r, i) => i > idx && r.review?.status !== "reviewed")
      || ready[(idx + 1) % ready.length];
    if (next && next.chc_id !== cur.chc_id) nav.navigate("scanReview", { id: next.chc_id });
  }, [ready, idx, cur.chc_id, nav]);

  const gotoPrev = React.useCallback(() => {
    const prev = ready[(idx - 1 + ready.length) % ready.length];
    if (prev) nav.navigate("scanReview", { id: prev.chc_id });
  }, [ready, idx, nav]);

  // Confirm-all: mark reviewed, graduate enrichment, advance.
  const confirmAndNext = React.useCallback(() => {
    const next: Review = { ...review, status: "reviewed" };
    setReview(next);
    scanApi.patch(cur.chc_id, { review: next, accept: true })
      .then(() => { reload(); })
      .catch((e: Error) => nav.toast(`Save failed: ${e.message}`, "warn"));
    nav.toast(`Reviewed ${cur.chc_id}`, "ok");
    gotoNext();
  }, [review, cur.chc_id, nav, gotoNext, reload]);

  // Keyboard: ↵ confirm+next, e edit description, x reject, j/k prev/next.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      if (inField) return; // field-level Enter handled inline (commit, not advance)
      if (e.key === "Enter") { e.preventDefault(); confirmAndNext(); }
      else if (e.key === "e" || e.key === "E") { e.preventDefault(); setEditing((s) => ({ ...s, description: true })); }
      else if (e.key === "x" || e.key === "X") { e.preventDefault(); apply({ description: { verdict: "rejected", value: "" } }, { immediate: true }); }
      else if (e.key === "j" || e.key === "J") gotoPrev();
      else if (e.key === "k" || e.key === "K") gotoNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmAndNext, gotoPrev, gotoNext, apply]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: t.bg, overflow: "hidden" } as React.CSSProperties}>
      <ReviewSubBar cur={cur} idx={idx} total={ready.length} reviewed={reviewedCount} nav={nav} onConfirm={confirmAndNext} />
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 440px" }}>
        <ZoomImage cur={cur} />
        <div key={cur.chc_id} style={{ background: t.bgPanel, borderLeft: `1px solid ${t.border}`, overflow: "auto", padding: "18px 22px 32px" }}>
          <HandwritingVerdict
            label="Address" hint="handwriting · lower-left"
            vlmValue={cur.vlm?.address || ""} field={review.address}
            editing={editing.address} setEditing={(v) => setEditing((s) => ({ ...s, address: v }))}
            onChange={(f) => apply({ address: f }, { immediate: true })}
            normalize={normalizeAddress}
          />
          <HandwritingVerdict
            label="Year" hint="handwriting · lower-right"
            vlmValue={cur.vlm?.year || ""} field={review.year}
            editing={editing.year} setEditing={(v) => setEditing((s) => ({ ...s, year: v }))}
            onChange={(f) => apply({ year: f }, { immediate: true })}
          />
          <DescriptionVerdict
            vlmValue={cur.vlm?.description || ""} field={review.description}
            editing={editing.description} setEditing={(v) => setEditing((s) => ({ ...s, description: v }))}
            onChange={(f, opts) => apply({ description: f }, opts)}
          />
          <NotesField value={review.notes} onChange={(v) => apply({ notes: v })} />
        </div>
      </div>
    </div>
  );
}

function emptyClientReview(): Review {
  return {
    address: { verdict: null, value: "", flag_reason: null },
    year: { verdict: null, value: "", flag_reason: null },
    description: { verdict: null, value: "" },
    notes: "",
    status: "unreviewed",
  };
}

// ── Sub-bar ──────────────────────────────────────────────────
function ReviewSubBar({
  cur,
  idx,
  total,
  reviewed,
  nav,
  onConfirm,
}: {
  cur: ScanRecord;
  idx: number;
  total: number;
  reviewed: number;
  nav: ReturnType<typeof useNav>;
  onConfirm: () => void;
}) {
  const t = STAFF_TOKENS;
  const done = cur.review?.status === "reviewed";
  return (
    <div style={{ height: 44, padding: "0 24px", background: t.bgSurface, borderBottom: `1px solid ${t.borderSoft}`, display: "flex", alignItems: "center", gap: 14, flexShrink: 0, fontSize: 12.5 }}>
      <a onClick={() => nav.navigate("scanPipeline")} style={{ color: t.teal, cursor: "pointer" }}>← Pipeline</a>
      <span style={{ color: t.borderSoft }}>·</span>
      <span style={{ fontFamily: t.mono, color: t.ink, fontSize: 13 }}>{cur.chc_id}</span>
      <span style={{ fontSize: 11, color: t.inkFaint }}>(from filename)</span>
      <span style={{
        background: done ? t.sageSoft : t.terracotta + "15", color: done ? t.sage : t.terracotta,
        fontFamily: t.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 500,
        padding: "2px 7px", borderRadius: 3,
      } as React.CSSProperties}>{done ? "reviewed" : "unreviewed"}</span>
      <div style={{ flex: 1 }} />
      <span style={{ color: t.inkMuted }}>reviewed <span style={{ fontFamily: t.mono, color: t.ink }}>{reviewed} / {total}</span></span>
      <div style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint, display: "flex", gap: 12 }}>
        <span><Kbd>↵</Kbd> confirm & next</span>
        <span><Kbd>e</Kbd> edit</span>
        <span><Kbd>x</Kbd> reject</span>
      </div>
      <button onClick={onConfirm} style={pillBtn(t, true)}><Kbd small>↵</Kbd> Confirm & next</button>
    </div>
  );
}

// ── Left: zoomable image ─────────────────────────────────────
function ZoomImage({ cur }: { cur: ScanRecord }) {
  const t = STAFF_TOKENS;
  const [view, setView] = React.useState({ scale: 1, x: 0, y: 0 });
  const drag = React.useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const src = "/" + (cur.jpeg_path || `derivatives/${cur.chc_id}.jpg`);

  const reset = () => setView({ scale: 1, x: 0, y: 0 });
  // Quick-zoom to a corner where the handwriting lives (fractional anchor of the image).
  const zoomCorner = (ax: number, ay: number) => {
    const scale = 3;
    // translate so the anchor point maps toward center
    setView({ scale, x: (0.5 - ax) * 100 * scale, y: (0.5 - ay) * 100 * scale });
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => ({ ...v, scale: Math.min(8, Math.max(1, v.scale * (e.deltaY < 0 ? 1.15 : 0.87))) }));
  };
  const onDown = (e: React.MouseEvent) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }; };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: drag.current!.ox + (e.clientX - drag.current!.sx) * 0.2, y: drag.current!.oy + (e.clientY - drag.current!.sy) * 0.2 }));
  };
  const onUp = () => { drag.current = null; };

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflow: "hidden" } as React.CSSProperties}>
      <div
        onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        style={{ flex: 1, minHeight: 0, background: "#1A1814", borderRadius: 8, position: "relative", overflow: "hidden", cursor: view.scale > 1 ? "grab" : "default" } as React.CSSProperties}
      >
        <img src={src} alt={cur.chc_id} draggable={false} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
          transform: `translate(${view.x}%, ${view.y}%) scale(${view.scale})`, transition: drag.current ? "none" : "transform 120ms ease-out",
        } as React.CSSProperties} />
        {/* zoom toolbox */}
        <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 6, background: "rgba(26,24,20,0.72)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "5px 8px" } as React.CSSProperties}>
          <ZoomBtn label="Address ↙" onClick={() => zoomCorner(0.16, 0.9)} />
          <ZoomBtn label="Year ↘" onClick={() => zoomCorner(0.86, 0.9)} />
          <ZoomBtn label="Fit" onClick={reset} />
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(26,24,20,0.6)", color: "rgba(255,255,255,0.85)", fontFamily: t.mono, fontSize: 10.5, padding: "4px 8px", borderRadius: 4 } as React.CSSProperties}>
          {Math.round(view.scale * 100)}% · scroll to zoom, drag to pan
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: t.inkMuted }}>
        <span style={{ fontFamily: t.mono }}>{cur.chc_id}.tif</span>
        <span style={{ color: t.borderSoft }}>·</span>
        <span>master {cur.master_path}</span>
      </div>
    </div>
  );
}
function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const t = STAFF_TOKENS;
  return <button onClick={onClick} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.85)", fontFamily: t.mono, fontSize: 11, cursor: "pointer", padding: "2px 4px" }}>{label}</button>;
}

// ── Right: handwriting verdict (address / year) ──────────────
function HandwritingVerdict({
  label,
  hint,
  vlmValue,
  field,
  editing,
  setEditing,
  onChange,
  normalize,
}: {
  label: string;
  hint: string;
  vlmValue: string;
  field: ReviewField;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onChange: (f: ReviewField) => void;
  normalize?: (s: string) => string;
}) {
  const t = STAFF_TOKENS;
  const [draft, setDraft] = React.useState(field.verdict === "edited" ? field.value : vlmValue);
  const verdict = field.verdict;

  const commitEdit = () => {
    const v = draft.trim();
    // Formatting-only difference → count as a match, not an edit.
    if (normalize && normalize(v) === normalize(vlmValue)) {
      onChange({ verdict: "correct", value: vlmValue, flag_reason: null });
    } else {
      onChange({ verdict: "edited", value: v, flag_reason: null });
    }
    setEditing(false);
  };

  return (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${t.borderSoft}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{label}</span>
        <span style={{ fontFamily: t.mono, fontSize: 9.5, color: t.teal, background: t.tealSoft, padding: "1px 5px", borderRadius: 3, letterSpacing: 0.4, textTransform: "uppercase" } as React.CSSProperties}>VLM read</span>
        <span style={{ fontSize: 11, color: t.inkFaint }}>{hint}</span>
      </div>

      {editing ? (
        <input
          autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); commitEdit(); } if (e.key === "Escape") setEditing(false); }}
          onBlur={commitEdit}
          style={inputStyle(t)}
        />
      ) : (
        <div style={{ fontFamily: t.serif, fontSize: 18, color: vlmValue ? t.ink : t.inkFaint, marginBottom: 8 }}>
          {verdict === "edited" ? field.value : (vlmValue || "(blank — VLM read nothing)")}
          {verdict === "edited" && <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkMuted, marginLeft: 8 }}>was: {vlmValue || "∅"}</span>}
        </div>
      )}

      {!editing && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <VerdictBtn active={verdict === "correct"} color={t.sage} onClick={() => onChange({ verdict: "correct", value: vlmValue, flag_reason: null })}>✓ correct</VerdictBtn>
          <VerdictBtn active={verdict === "edited"} color={t.teal} onClick={() => { setDraft(field.verdict === "edited" ? field.value : vlmValue); setEditing(true); }}>edit</VerdictBtn>
          <VerdictBtn active={verdict === "flag"} color={t.terracotta} onClick={() => onChange({ verdict: "flag", value: "", flag_reason: field.flag_reason || "wrong" })}>✗ flag</VerdictBtn>
          {verdict === "flag" && (
            <span style={{ display: "inline-flex", gap: 4, marginLeft: 6 }}>
              <ReasonChip active={field.flag_reason === "wrong"} onClick={() => onChange({ verdict: "flag", value: "", flag_reason: "wrong" })}>wrong</ReasonChip>
              <ReasonChip active={field.flag_reason === "illegible"} onClick={() => onChange({ verdict: "flag", value: "", flag_reason: "illegible" })}>illegible</ReasonChip>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Right: description verdict ───────────────────────────────
function DescriptionVerdict({
  vlmValue,
  field,
  editing,
  setEditing,
  onChange,
}: {
  vlmValue: string;
  field: ReviewDescription;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onChange: (f: ReviewDescription, opts?: { immediate?: boolean }) => void;
}) {
  const t = STAFF_TOKENS;
  const [draft, setDraft] = React.useState(field.verdict === "edited" ? field.value : vlmValue);
  const verdict = field.verdict;
  const commitEdit = () => { onChange({ verdict: "edited", value: draft.trim() }, { immediate: true }); setEditing(false); };

  return (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${t.borderSoft}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>Visual description</span>
        <span style={{ fontFamily: t.mono, fontSize: 9.5, color: t.teal, background: t.tealSoft, padding: "1px 5px", borderRadius: 3, letterSpacing: 0.4, textTransform: "uppercase" } as React.CSSProperties}>VLM</span>
      </div>

      {editing ? (
        <textarea
          autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") setEditing(false); }}
          onBlur={commitEdit}
          style={textareaStyle(t, 110)}
        />
      ) : (
        <div style={{
          fontSize: 13.5, color: verdict === "rejected" ? t.inkFaint : t.inkSubtle, lineHeight: 1.5, marginBottom: 8,
          textDecoration: verdict === "rejected" ? "line-through" : "none",
          fontStyle: vlmValue ? "normal" : "italic",
        } as React.CSSProperties}>
          {verdict === "edited" ? field.value : (vlmValue || "(no description)")}
        </div>
      )}

      {!editing && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <VerdictBtn active={verdict === "accepted"} color={t.sage} onClick={() => onChange({ verdict: "accepted", value: "" }, { immediate: true })}>✓ accept</VerdictBtn>
          <VerdictBtn active={verdict === "edited"} color={t.teal} onClick={() => { setDraft(field.verdict === "edited" ? field.value : vlmValue); setEditing(true); }}>edit</VerdictBtn>
          <VerdictBtn active={verdict === "rejected"} color={t.terracotta} onClick={() => onChange({ verdict: "rejected", value: "" }, { immediate: true })}>✗ reject</VerdictBtn>
        </div>
      )}
      <FieldFoot t={t}>Description edits are prose refinement — they sit outside the accuracy table.</FieldFoot>
    </div>
  );
}

function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = STAFF_TOKENS;
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, marginBottom: 6 }}>Review notes <span style={{ fontWeight: 400, color: t.inkFaint, fontSize: 11 }}>(holistic, optional)</span></div>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="accuracy · era-faithfulness · tone · omissions…"
        style={textareaStyle(t, 80)}
      />
    </div>
  );
}

function VerdictBtn({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  const t = STAFF_TOKENS;
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
      background: active ? color : "#fff", color: active ? "#fff" : t.ink,
      border: `1px solid ${active ? color : t.border}`, borderRadius: 5, fontWeight: active ? 500 : 400,
    }}>{children}</button>
  );
}
function ReasonChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const t = STAFF_TOKENS;
  return (
    <button onClick={onClick} style={{
      padding: "3px 8px", fontSize: 11, fontFamily: t.mono, cursor: "pointer",
      background: active ? t.terracotta : "#fff", color: active ? "#fff" : t.inkMuted,
      border: `1px solid ${active ? t.terracotta : t.border}`, borderRadius: 10,
    }}>{children}</button>
  );
}
