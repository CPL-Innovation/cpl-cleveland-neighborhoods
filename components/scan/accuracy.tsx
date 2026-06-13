"use client";
import React from "react";

import { STAFF_TOKENS } from "@/lib/tokens";
import type { StaffTokens } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import { scanApi } from "@/lib/scan-api";
import { ServerNeeded, CenterNote } from "@/components/scan/pipeline";
import { pillBtn } from "@/components/staff/ui";
import type { AccuracyRollup, FieldStats } from "@/lib/types";

// Surface C — Accuracy (the eval readout).
// Auto-aggregated from Surface B verdicts. Per-field accuracy (illegible excluded from
// the denominator), description outcomes, the notes corpus, the miss list, CSV export.
//
// Spec: scan-pipeline-ux.md §"The eval" and Flow E.

export function ScanAccuracy() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const [acc, setAcc] = React.useState<AccuracyRollup | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { scanApi.accuracy().then(setAcc).catch((e) => setError(e.message)); }, []);
  if (error) return <ServerNeeded error={error} />;
  if (!acc) return <CenterNote text="Aggregating verdicts…" />;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: t.bg }}>
      <div style={{ padding: '32px 40px 48px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontFamily: t.serif, fontSize: 26, fontWeight: 460, color: t.ink }}>Accuracy</div>
          <a href={scanApi.csvUrl} download style={{ ...pillBtn(t, false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' } as React.CSSProperties}>Export CSV ↓</a>
        </div>
        <div style={{ fontSize: 13, color: t.inkMuted, marginBottom: 22 }}>
          {acc.totals.reviewed} of {acc.totals.ready} ready photos reviewed · a by-product of review, not a second pass.
        </div>

        <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: t.inkMuted, marginBottom: 10 } as React.CSSProperties}>
          Handwriting — objective (illegible excluded from denominator)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <FieldCard t={t} label="Address" s={acc.address} />
          <FieldCard t={t} label="Year" s={acc.year} />
        </div>

        <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: t.inkMuted, marginBottom: 10 } as React.CSSProperties}>
          Description — qualitative (outcomes, not a single score)
        </div>
        <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          {acc.description.denominator ? (
            <>
              <div style={{ fontSize: 28, fontFamily: t.serif, color: t.ink }}>{acc.description.accepted_pct}% <span style={{ fontSize: 14, color: t.inkMuted }}>accepted as-is</span></div>
              <div style={{ fontSize: 13, color: t.inkMuted, marginTop: 4 }}>
                accepted {acc.description.accepted} · edited {acc.description.edited} · rejected {acc.description.rejected} (of {acc.description.denominator})
              </div>
            </>
          ) : <div style={{ color: t.inkFaint, fontSize: 13 }}>No descriptions reviewed yet.</div>}
        </div>

        {acc.description.notes.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: t.inkMuted, marginBottom: 10 } as React.CSSProperties}>Review notes corpus ({acc.description.notes.length})</div>
            {acc.description.notes.map((n) => (
              <div key={n.chc_id} style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                <span style={{ fontFamily: t.mono, fontSize: 11, color: t.teal, marginRight: 8 }}>{n.chc_id}</span>
                <span style={{ fontSize: 12.5, color: t.inkSubtle }}>{n.note}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: t.terracotta, marginBottom: 10 } as React.CSSProperties}>
          Photos the VLM got wrong — the risk evidence ({acc.misses.length})
        </div>
        {acc.misses.length ? acc.misses.map((m, i) => (
          <div key={i} onClick={() => nav.navigate('scanReview', { id: m.chc_id })} style={{
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 6,
          }}>
            <span style={{ fontFamily: t.mono, fontSize: 12, color: t.ink, minWidth: 110 }}>{m.chc_id}</span>
            <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkMuted, textTransform: 'uppercase' } as React.CSSProperties}>{m.field}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: t.inkSubtle }}>
              VLM: <span style={{ textDecoration: 'line-through' }}>{m.vlm || '∅'}</span>
              {m.confirmed ? <> → <span style={{ color: t.sage }}>{m.confirmed}</span></> : <span style={{ color: t.inkFaint }}> (no correction)</span>}
            </span>
          </div>
        )) : <div style={{ color: t.inkFaint, fontSize: 13 }}>No misses recorded.</div>}
      </div>
    </div>
  );
}

function FieldCard({ t, label, s }: { t: StaffTokens; label: string; s: FieldStats }) {
  const pct = s.correct_pct;
  return (
    <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, marginBottom: 6 }}>{label}</div>
      {s.denominator ? (
        <>
          <div style={{ fontSize: 28, fontFamily: t.serif, color: t.ink }}>{pct}% <span style={{ fontSize: 14, color: t.inkMuted }}>correct</span></div>
          <div style={{ fontSize: 12.5, color: t.inkMuted, marginTop: 4 }}>
            {s.correct}/{s.denominator} · edited {s.edited}
          </div>
          {s.illegible > 0 && <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 2 }}>{s.illegible} illegible (excluded)</div>}
        </>
      ) : <div style={{ color: t.inkFaint, fontSize: 13 }}>No reviewed records yet.</div>}
    </div>
  );
}
