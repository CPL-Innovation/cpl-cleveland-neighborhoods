"use client";
import React from "react";
import { STAFF_TOKENS } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import { pillBtn, textareaStyle } from "@/components/staff/ui";
import { describeBearing, parseRephotoEmbed } from "@/lib/rephoto";

/**
 * Then-and-now: record the modern viewpoint.
 *
 * The librarian walks Street View to where the photographer stood, frames the shot to match,
 * then pastes Google's "Share → Embed a map" URL. We keep the URL and unpack its camera
 * geometry (see lib/rephoto.ts) — the bearing read-back below is the check that the framing
 * is the one they meant, without having to trust an opaque string.
 *
 * Source-agnostic on purpose: it started life inside the Finalize stage (box-scans only) and now
 * also serves the Record Edit screen (cataloged ContentDM photographs). The tray only knows how to
 * *frame* a viewpoint; the caller supplies the save, so each surface keeps its own write path.
 */
export function RephotoTray({
  recorded, bearing, subjectLat, subjectLng, label, onSave, onSaved,
}: {
  /** The embed URL already on record, or null. */
  recorded: string | null;
  /** Its heading, for the "recorded · facing …" badge. */
  bearing: number | null;
  /** The archival coordinate — the subject. Street View opens here so the walk starts at the corner. */
  subjectLat?: number | null;
  subjectLng?: number | null;
  /** What to call this photo in toasts (a CHC ID, a ContentDM id). */
  label: string;
  onSave: (embedUrl: string) => Promise<{ cleared: boolean; bearing: number | null }>;
  onSaved?: () => void;
}) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const [url, setUrl] = React.useState(recorded ?? "");
  const [saving, setSaving] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setUrl(recorded ?? "");
    setServerError(null);
  }, [label, recorded]);

  const has = !!recorded;
  const dirty = url.trim() !== (recorded ?? "");

  // Validate as they paste, not on the server after the fact. The parser is a pure function,
  // so the same rule that guards the write can explain itself here — a rejected paste used to
  // surface only as a 400 and a toast that disappeared, which read as "nothing happened".
  const check = React.useMemo(() => {
    if (!url.trim()) return null;
    try {
      return { ok: true as const, framing: parseRephotoEmbed(url) };
    } catch (e) {
      return { ok: false as const, message: (e as Error).message };
    }
  }, [url]);

  const streetViewUrl =
    subjectLat != null && subjectLng != null
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${subjectLat},${subjectLng}`
      : null;

  const save = async (next: string) => {
    setSaving(true);
    setServerError(null);
    try {
      const res = await onSave(next);
      nav.toast(
        res.cleared
          ? `Cleared the viewpoint for ${label}`
          : `Viewpoint saved · facing ${res.bearing != null ? describeBearing(res.bearing) : "—"}`,
        "ok",
      );
      onSaved?.();
    } catch (e) {
      // Keep it on screen: a toast is the wrong home for something you need while editing.
      setServerError((e as Error).message);
      nav.toast((e as Error).message, "warn");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 14, border: `1px solid ${t.border}`, background: t.bgSurface, borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: t.ink, fontWeight: 500 }}>Then &amp; now — the modern viewpoint</span>
        {has && (
          <span style={{ fontFamily: t.mono, fontSize: 10, color: t.sage, background: t.sageSoft, padding: "2px 7px", borderRadius: 3 }}>
            recorded{bearing != null ? ` · facing ${describeBearing(bearing)}` : ""}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: t.inkMuted, lineHeight: 1.5, marginBottom: 8 }}>
        Stand where the photographer stood, match the framing, then paste Google&rsquo;s{" "}
        <b>Share &rarr; Embed a map</b> link. The whole <code>&lt;iframe&gt;</code> is fine — we&rsquo;ll take the URL out of it.
      </div>
      <textarea
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.google.com/maps/embed?pb=…"
        rows={2}
        style={{ ...textareaStyle(t), fontFamily: t.mono, fontSize: 10.5, marginBottom: 8 }}
      />
      {check && !check.ok && (
        <div style={{
          marginBottom: 8, padding: "8px 10px", borderRadius: 5,
          background: t.ochreSoft, border: `1px solid ${t.ochre}44`, color: t.ochre,
          fontSize: 11.5, lineHeight: 1.5,
        }}>
          <b>That isn&rsquo;t an embed link.</b> {check.message}
          <div style={{ color: t.inkMuted, marginTop: 4 }}>
            In Street View use <b>Share &rarr; Embed a map</b> (not &ldquo;Copy link&rdquo;, and not the address bar) —
            only that tab gives a URL Google allows us to display.
          </div>
        </div>
      )}

      {check?.ok && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: t.mono, fontSize: 10.5, color: t.sage, marginBottom: 6 }}>
            ✓ camera {check.framing.lat?.toFixed(5)}, {check.framing.lng?.toFixed(5)}
            {check.framing.bearing != null ? ` · facing ${describeBearing(check.framing.bearing)}` : ""}
            {check.framing.pitch != null ? ` · pitch ${check.framing.pitch.toFixed(1)}°` : ""}
          </div>
          {/* Confirm the framing before committing it — the job is matching a photograph. */}
          <iframe
            src={check.framing.embedUrl}
            title="Street View preview"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ width: "100%", height: 150, border: `1px solid ${t.border}`, borderRadius: 5, display: "block" }}
          />
        </div>
      )}

      {serverError && (
        <div style={{
          marginBottom: 8, padding: "8px 10px", borderRadius: 5,
          background: `${t.terracotta}14`, border: `1px solid ${t.terracotta}44`, color: t.terracotta,
          fontSize: 11.5, lineHeight: 1.5,
        }}>
          Save failed — {serverError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => save(url)} disabled={!dirty || saving || check?.ok === false} style={{ ...pillBtn(t, true), opacity: !dirty || saving || check?.ok === false ? 0.5 : 1 }}>
          {saving ? "Saving…" : has ? "Update viewpoint" : "Save viewpoint"}
        </button>
        {has && (
          <button onClick={() => { setUrl(""); save(""); }} disabled={saving} style={{ ...pillBtn(t) }}>
            Clear
          </button>
        )}
        {streetViewUrl && (
          <a href={streetViewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: t.teal }}>
            ↗ Open Street View at this address
          </a>
        )}
      </div>
    </div>
  );
}
