"use client";
// Facet review (Tier 1.5 Run 2, Piece B) — the staff A/B review instrument.
// Canonical intent: build/enrichment-app/facet-review-ux.md §"Staff review surface".
//
// Per-photo: the image + the baseline Tier-1 caption (for the "value over the caption" A/B
// judgement) + the enforced-schema facets as editable widgets, with confidence surfaced on the
// soft-confidence fields. Reads the Run 2 eval artifact via /api/scan/facets; staff corrections
// persist to a STAGING file — never photo_enrichment / scan_review (the production-write firebreak).
// This surface is the A/B *instrument*, not the verdict: the four scoring questions still gate.
import React from "react";
import { STAFF_TOKENS } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import { pillBtn, FieldGroup, inputStyle } from "@/components/staff/ui";
import { scanApi } from "@/lib/scan-api";
import type { FacetReviewRow } from "@/lib/facet-review-store";
import type { Run2Facets } from "@/lib/types";

// Display config (labels + enum options + widget kind). Mirrors the v1 LOCKED schema; lives here
// because options/ordering/labels are presentation concerns. Kept in sync with lib/vlm-run2.ts.
const SINGLE: Record<string, string[]> = {
  building_type: ["single_family", "multi_family", "commercial", "civic", "accessory_only", "mixed"],
  stories: ["1", "1.5", "2", "2.5", "3plus", "unknown"],
};
const MULTI: Record<string, string[]> = {
  roof_form: ["gable", "hip", "flat", "gambrel", "mansard", "dormer"],
  accessory_structures: ["detached_garage", "shed", "fence", "chimney", "outbuilding"],
  materials: ["wood_frame", "brick", "stone", "concrete_block", "stucco", "metal", "glass"],
  street_and_ground: ["paved_street", "sidewalk", "curb", "driveway", "dirt_unpaved", "brick_street", "snow_cover", "open_lot"],
  transport: ["utility_poles", "overhead_wires", "parked_cars", "street_lights", "street_signs", "streetcar_tracks"],
  vegetation: ["trees", "grass_lawn", "shrubs", "weeds_overgrown", "bare_trees"],
  condition_and_change: ["boarded_shuttered", "demolition_rubble", "under_construction", "fire_damage", "deteriorating", "cracked_pavement"],
  people_present: ["people", "children", "workers", "vendors", "animals"],
};
const CONFIDENCE = ["high", "medium", "low"];
const SCENE_TEXT_KINDS = ["business_name", "street_sign", "poster", "address", "other"];
const ARCHIVAL_KINDS = ["date_stamp", "catalog_code", "ink_annotation", "drawn_mark"];
const LABEL = (s: string) => s.replace(/_/g, " ");

type Working = Record<string, unknown>;

export function ScanFacetReview() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const [rows, setRows] = React.useState<FacetReviewRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState<Working>({});
  const [reviewed, setReviewed] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    scanApi
      .facets()
      .then((r) => {
        setRows(r);
        setErr(null);
        setActiveId((cur) => cur ?? r[0]?.chc_id ?? null);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(load, [load]);

  const active = rows.find((r) => r.chc_id === activeId) || null;

  // Seed the form from the staged correction if present, else the raw VLM facets.
  React.useEffect(() => {
    if (!active) return;
    setWorking({ ...(active.corrected ?? active.vlm) } as Working);
    setReviewed(active.reviewed);
    setNotes(active.notes);
    setDirty(false);
  }, [activeId, active]);

  const setField = (key: string, value: unknown) => {
    setWorking((w) => {
      const next = { ...w };
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0) || value === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
      // Drop an orphan confidence sibling when its parent clears.
      if (key === "building_type" && next.building_type === undefined) delete next.building_type_confidence;
      if (key === "roof_form" && next.roof_form === undefined) delete next.roof_form_confidence;
      return next;
    });
    setDirty(true);
  };

  const save = async (markReviewed?: boolean) => {
    if (!active) return;
    setSaving(true);
    try {
      const willReview = markReviewed ?? reviewed;
      await scanApi.saveFacet(active.chc_id, {
        corrected: working as Run2Facets,
        reviewed: willReview,
        notes,
      });
      setRows((rs) =>
        rs.map((r) =>
          r.chc_id === active.chc_id
            ? { ...r, corrected: working as Run2Facets, reviewed: willReview, notes }
            : r
        )
      );
      setReviewed(willReview);
      setDirty(false);
      nav.toast(willReview ? "Saved · marked reviewed" : "Correction saved (staging)", "ok");
    } catch (e) {
      nav.toast((e as Error).message, "warn");
    } finally {
      setSaving(false);
    }
  };

  const reviewedCount = rows.filter((r) => r.reviewed).length;

  if (loading) return <Centered t={t}>Loading Run 2 facets…</Centered>;
  if (err)
    return (
      <Centered t={t}>
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div style={{ fontFamily: t.serif, fontSize: 18, color: t.ink, marginBottom: 8 }}>No Run 2 facets to review</div>
          <div style={{ color: t.inkMuted, fontSize: 13, lineHeight: 1.5 }}>{err}</div>
          <div style={{ color: t.inkFaint, fontSize: 12, marginTop: 10, fontFamily: t.mono }}>
            Produce the eval artifact with <code>npm run scan:run2</code>, then reload.
          </div>
        </div>
      </Centered>
    );

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: t.bg, overflow: "hidden" }}>
      {/* Worklist */}
      <div style={{ width: 248, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${t.borderSoft}` }}>
          <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: t.inkMuted }}>
            Run 2 · A/B review
          </div>
          <div style={{ fontSize: 12.5, color: t.ink, marginTop: 4 }}>
            {reviewedCount}/{rows.length} reviewed
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {rows.map((r) => {
            const f = (r.corrected ?? r.vlm) as Run2Facets;
            const change = (f.condition_and_change?.length ?? 0) > 0;
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
                  <div style={{ fontSize: 12, color: t.ink, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.chc_id}</div>
                  <div style={{ fontFamily: t.mono, fontSize: 9.5, color: t.inkFaint, display: "flex", gap: 6 }}>
                    {r.reviewed ? <span style={{ color: t.sage }}>✓ reviewed</span> : <span>pending</span>}
                    {change && <span style={{ color: t.terracotta }} title="condition_and_change fired">⌁ change</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      {active ? (
        <div style={{ flex: 1, minWidth: 0, display: "flex", overflow: "hidden" }}>
          {/* Image + baseline caption (the A/B left side) */}
          <div style={{ width: 360, borderRight: `1px solid ${t.border}`, padding: 18, overflowY: "auto", flexShrink: 0 }}>
            <img src={active.jpeg_url} alt={active.chc_id} style={{ width: "100%", borderRadius: 6, border: `1px solid ${t.border}`, display: "block" }} />
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: t.inkMuted, marginBottom: 6 }}>
                Baseline caption · Tier 1
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: active.baseline_description ? t.ink : t.inkFaint, fontStyle: active.baseline_description ? "normal" : "italic" }}>
                {active.baseline_description || "no baseline caption in scan_review for this photo"}
              </div>
              <div style={{ fontSize: 11, color: t.inkFaint, marginTop: 8, fontStyle: "italic" }}>
                A/B: do the facets surface structure this one sentence can&apos;t?
              </div>
            </div>
          </div>

          {/* Facet form (the A/B right side) */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
            <div style={{ padding: "16px 22px", maxWidth: 720 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, position: "sticky", top: 0 }}>
                <div style={{ fontFamily: t.serif, fontSize: 19, color: t.ink }}>{active.chc_id}</div>
                {dirty && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.draft }} title="unsaved" />}
                <div style={{ flex: 1 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.ink, cursor: "pointer" }}>
                  <input type="checkbox" checked={reviewed} onChange={(e) => { setReviewed(e.target.checked); setDirty(true); }} />
                  reviewed
                </label>
                <button onClick={() => save()} disabled={saving || !dirty} style={{ ...pillBtn(t, true), opacity: saving || !dirty ? 0.5 : 1 }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => save(true)} disabled={saving} style={{ ...pillBtn(t, false) }}>Save + reviewed →</button>
              </div>

              <FieldGroup label="Building">
                <SingleRow t={t} label="building_type" field="building_type" working={working} vlm={active.vlm} options={SINGLE.building_type} confidenceKey="building_type_confidence" setField={setField} />
                <SingleRow t={t} label="stories" field="stories" working={working} vlm={active.vlm} options={SINGLE.stories} setField={setField} />
                <MultiRow t={t} label="roof_form" field="roof_form" working={working} vlm={active.vlm} options={MULTI.roof_form} confidenceKey="roof_form_confidence" setField={setField} />
                <BoolRow t={t} label="has_porch" field="has_porch" working={working} vlm={active.vlm} setField={setField} />
                <MultiRow t={t} label="accessory_structures" field="accessory_structures" working={working} vlm={active.vlm} options={MULTI.accessory_structures} setField={setField} />
              </FieldGroup>

              <FieldGroup label="Materials & environment">
                <MultiRow t={t} label="materials" field="materials" working={working} vlm={active.vlm} options={MULTI.materials} setField={setField} />
                <MultiRow t={t} label="street_and_ground" field="street_and_ground" working={working} vlm={active.vlm} options={MULTI.street_and_ground} setField={setField} />
                <MultiRow t={t} label="transport" field="transport" working={working} vlm={active.vlm} options={MULTI.transport} setField={setField} />
                <MultiRow t={t} label="vegetation" field="vegetation" working={working} vlm={active.vlm} options={MULTI.vegetation} setField={setField} />
              </FieldGroup>

              <FieldGroup label="Text (transcription)">
                <TranscriptionRow t={t} label="scene_text" field="scene_text" working={working} kinds={SCENE_TEXT_KINDS} setField={setField} />
                <TranscriptionRow t={t} label="archival_markup" field="archival_markup" working={working} kinds={ARCHIVAL_KINDS} setField={setField} />
              </FieldGroup>

              <FieldGroup label="Change (change-only — empty = stable/intact)">
                <MultiRow t={t} label="condition_and_change" field="condition_and_change" working={working} vlm={active.vlm} options={MULTI.condition_and_change} setField={setField} />
              </FieldGroup>

              <FieldGroup label="Demoted">
                <BoolRow t={t} label="has_print_damage" field="has_print_damage" working={working} vlm={active.vlm} setField={setField} />
                <MultiRow t={t} label="people_present" field="people_present" working={working} vlm={active.vlm} options={MULTI.people_present} setField={setField} />
              </FieldGroup>

              <FieldGroup label="Reviewer notes" tight>
                <textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                  placeholder="Fabrication caught? value-over-caption? change-axis correct?"
                  style={{ ...inputStyle(t, { height: 60, padding: "8px 10px", lineHeight: 1.4, resize: "vertical" }) }}
                />
              </FieldGroup>

              <div style={{ fontSize: 11, color: t.inkFaint, fontStyle: "italic", marginTop: 4, marginBottom: 30 }}>
                Staging only — corrections are A/B ground truth, never written to the production store until the A/B clears.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Centered t={t}>Select a photo</Centered>
      )}
    </div>
  );
}

// ── Row widgets ──────────────────────────────────────────────────────────────
type RowBase = {
  t: typeof STAFF_TOKENS;
  label: string;
  field: string;
  working: Working;
  setField: (k: string, v: unknown) => void;
};

function FieldShell({ t, label, changed, vlmHint, confidence, children }: {
  t: typeof STAFF_TOKENS; label: string; changed?: boolean; vlmHint?: string; confidence?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.ink }}>{LABEL(label)}</span>
        {changed && <span style={{ fontFamily: t.mono, fontSize: 9, color: t.draft, background: t.draftSoft, padding: "1px 5px", borderRadius: 3 }}>edited</span>}
        {confidence}
        <div style={{ flex: 1 }} />
        {vlmHint && <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint }} title="VLM original">VLM: {vlmHint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ t, on, soft, onClick, children }: { t: typeof STAFF_TOKENS; on: boolean; soft?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <span
      onClick={onClick}
      style={{
        cursor: "pointer", fontSize: 11.5, padding: "3px 9px", borderRadius: 13, userSelect: "none",
        background: on ? (soft ? t.tealSoft : t.ink) : "#fff",
        color: on ? (soft ? t.teal : "#F6F2EB") : t.inkMuted,
        border: `1px solid ${on ? (soft ? t.teal : t.ink) : t.border}`,
      }}
    >
      {LABEL(String(children))}
    </span>
  );
}

function ConfidenceBadge({ t, value, onChange }: { t: typeof STAFF_TOKENS; value: string | undefined; onChange: (v: string) => void }) {
  const tone = value === "high" ? t.sage : value === "low" ? t.terracotta : t.draft;
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      title="confidence (soft-confidence field — surfaces uncertainty)"
      style={{ fontFamily: t.mono, fontSize: 9.5, color: tone, background: "transparent", border: `1px solid ${tone}`, borderRadius: 3, padding: "0 3px" }}
    >
      <option value="">conf?</option>
      {CONFIDENCE.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function SingleRow({ options, confidenceKey, vlm, ...p }: RowBase & { options: string[]; confidenceKey?: string; vlm: Run2Facets }) {
  const { t, label, field, working, setField } = p;
  const cur = working[field] as string | undefined;
  const vlmVal = (vlm as Record<string, unknown>)[field] as string | undefined;
  const confidence = confidenceKey ? (
    <ConfidenceBadge t={t} value={working[confidenceKey] as string | undefined} onChange={(v) => setField(confidenceKey, v || undefined)} />
  ) : undefined;
  return (
    <FieldShell t={t} label={label} changed={cur !== vlmVal} vlmHint={vlmVal ? LABEL(vlmVal) : "—"} confidence={confidence}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {options.map((o) => (
          <Chip key={o} t={t} on={cur === o} onClick={() => setField(field, cur === o ? undefined : o)}>{o}</Chip>
        ))}
      </div>
    </FieldShell>
  );
}

function MultiRow({ options, confidenceKey, vlm, ...p }: RowBase & { options: string[]; confidenceKey?: string; vlm: Run2Facets }) {
  const { t, label, field, working, setField } = p;
  const cur = (working[field] as string[] | undefined) ?? [];
  const vlmVal = ((vlm as Record<string, unknown>)[field] as string[] | undefined) ?? [];
  const changed = cur.length !== vlmVal.length || cur.some((x) => !vlmVal.includes(x));
  const toggle = (o: string) => setField(field, cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);
  const confidence = confidenceKey ? (
    <ConfidenceBadge t={t} value={working[confidenceKey] as string | undefined} onChange={(v) => setField(confidenceKey, v || undefined)} />
  ) : undefined;
  return (
    <FieldShell t={t} label={label} changed={changed} vlmHint={vlmVal.length ? String(vlmVal.length) : "—"} confidence={confidence}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {options.map((o) => (
          <Chip key={o} t={t} soft on={cur.includes(o)} onClick={() => toggle(o)}>{o}</Chip>
        ))}
      </div>
    </FieldShell>
  );
}

function BoolRow({ vlm, ...p }: RowBase & { vlm: Run2Facets }) {
  const { t, label, field, working, setField } = p;
  const cur = working[field] as boolean | undefined;
  const vlmVal = (vlm as Record<string, unknown>)[field] as boolean | undefined;
  const states: [string, boolean | undefined][] = [["yes", true], ["no", false], ["—", undefined]];
  return (
    <FieldShell t={t} label={label} changed={cur !== vlmVal} vlmHint={vlmVal === undefined ? "—" : vlmVal ? "yes" : "no"}>
      <div style={{ display: "flex", gap: 5 }}>
        {states.map(([lbl, val]) => (
          <Chip key={lbl} t={t} on={cur === val} onClick={() => setField(field, val)}>{lbl}</Chip>
        ))}
      </div>
    </FieldShell>
  );
}

interface Transcription { text: string; kind: string }
function TranscriptionRow({ kinds, ...p }: RowBase & { kinds: string[] }) {
  const { t, label, field, working, setField } = p;
  const items = (working[field] as Transcription[] | undefined) ?? [];
  const update = (next: Transcription[]) => setField(field, next.length ? next : undefined);
  return (
    <FieldShell t={t} label={label} vlmHint={items.length ? String(items.length) : "—"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 5 }}>
            <input
              value={it.text}
              onChange={(e) => update(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              style={{ ...inputStyle(t, { height: 26, fontSize: 12 }) }}
            />
            <select
              value={it.kind}
              onChange={(e) => update(items.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
              style={{ height: 26, fontSize: 11, fontFamily: t.mono, border: `1px solid ${t.border}`, borderRadius: 5, background: "#fff", color: t.ink }}
            >
              {kinds.map((k) => <option key={k} value={k}>{LABEL(k)}</option>)}
            </select>
            <span onClick={() => update(items.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: t.inkFaint, fontSize: 16, lineHeight: "26px", padding: "0 4px" }}>×</span>
          </div>
        ))}
        <span onClick={() => update([...items, { text: "", kind: kinds[0] }])} style={{ cursor: "pointer", fontSize: 11.5, color: t.teal }}>+ add</span>
      </div>
    </FieldShell>
  );
}

function Centered({ t, children }: { t: typeof STAFF_TOKENS; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg, color: t.inkMuted, fontSize: 13 }}>
      {children}
    </div>
  );
}
