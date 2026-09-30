"use client";
import React from "react";
import { STAFF_TOKENS } from "@/lib/tokens";
import { useNav } from "@/components/staff/nav";
import { pillBtn, inputStyle } from "@/components/staff/ui";
import { staffApi } from "@/lib/staff-api";
import type { GeoRow } from "@/lib/geo-store";
import type { GeoResult, GeoSource } from "@/lib/geocode";
import type { PhotoSource } from "@/lib/types";

/**
 * Location & geo: look a coordinate up from the locator, and decide whether to keep it.
 *
 * This replaces a drawn map and an input that saved nothing. The shape is deliberately
 * suggest → look → accept, in three separate steps:
 *
 *   • The librarian edits the locator. The pre-filled value is the record's title, which for a
 *     harvested photograph is all there is — a ContentDM record has no address field, only a
 *     title like "Scranton Elementary School, 1966". Nine times in ten the useful act is to
 *     REPLACE that with an address they know, so the field is theirs to type in, not a display.
 *   • Suggest calls the gazetteer and shows what came back. It writes nothing.
 *   • Accept commits it, carrying the provenance the lookup actually earned.
 *
 * Why not one button. A geocoder that saved on success turns the review into a formality — you
 * are no longer deciding, you are undoing. And the failure modes here are not symmetric: a wrong
 * coordinate is a photograph filed on the wrong street, which nobody catches later, while a
 * missing one is visibly missing. So the machine proposes and the person disposes, and the
 * confidence of the proposal is on screen before anyone can accept it.
 */
export function GeoTray({
  id, source, contentdmUrl, locatorHint, onSaved,
}: {
  id: string;
  source: PhotoSource;
  contentdmUrl?: string | null;
  /** What to pre-fill the locator with — the record's title, usually. */
  locatorHint: string;
  onSaved?: () => void;
}) {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const [row, setRow] = React.useState<GeoRow | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [locator, setLocator] = React.useState(locatorHint);
  const [busy, setBusy] = React.useState<"suggest" | "accept" | "clear" | null>(null);
  const [suggestion, setSuggestion] = React.useState<GeoResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setSuggestion(null);
    setError(null);
    staffApi.getGeo(id).then((r) => {
      if (cancelled) return;
      setRow(r);
      // An address already on record beats the title — it's what a previous pass settled on.
      setLocator(r?.address_raw || locatorHint);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [id, locatorHint]);

  const has = row?.lat != null && row?.lng != null;

  async function suggest() {
    setBusy("suggest");
    setError(null);
    setSuggestion(null);
    try {
      setSuggestion(await staffApi.suggestGeo(id, locator));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function accept() {
    if (!suggestion?.ok) return;
    setBusy("accept");
    setError(null);
    try {
      await staffApi.acceptGeo(
        id,
        {
          lat: suggestion.lat,
          lng: suggestion.lng,
          addressRaw: locator.trim(),
          geoSource: suggestion.geoSource as GeoSource,
          geoConfidence: suggestion.geoConfidence,
        },
        { source, contentdmUrl },
      );
      setSuggestion(null);
      setRow(await staffApi.getGeo(id));
      nav.toast(`Coordinate saved for ${id}`, "ok");
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    setBusy("clear");
    setError(null);
    try {
      await staffApi.clearGeo(id, { source });
      setRow(await staffApi.getGeo(id));
      nav.toast(`Coordinate cleared for ${id}`, "info");
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* What's on record now */}
      <div style={{
        border: `1px solid ${t.borderSoft}`, borderRadius: 6, padding: "9px 11px",
        background: has ? t.bgSurface : "transparent",
      }}>
        {!loaded ? (
          <Mono t={t}>checking…</Mono>
        ) : has ? (
          <>
            <div style={{ fontFamily: t.mono, fontSize: 12, color: t.ink, letterSpacing: 0.3 }}>
              {fmt(row!.lat!)}° N · {fmt(Math.abs(row!.lng!))}° W
            </div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <SourceChip t={t} geoSource={row!.geo_source} confidence={row!.geo_confidence} />
              <button onClick={clear} disabled={busy !== null} style={{
                ...pillBtn(t), fontSize: 10.5, padding: "2px 8px",
                opacity: busy ? 0.5 : 1, cursor: busy ? "default" : "pointer",
              }}>Clear</button>
            </div>
          </>
        ) : (
          <>
            <Mono t={t}>No coordinate on record</Mono>
            {/* The Finalize batch records WHY when it fails. Repeating it here saves a librarian
                re-running a lookup that already failed for a reason they can't fix. */}
            {row?.geo_miss_reason && (
              <div style={{ marginTop: 3, fontSize: 11, color: t.inkMuted, lineHeight: 1.4 }}>
                Last attempt — {row.geo_miss_reason}
              </div>
            )}
          </>
        )}
      </div>

      {/* The locator + the ask */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: t.ink, display: "block", marginBottom: 5 }}>
          Address / locator
        </label>
        <input
          value={locator}
          onChange={(e) => { setLocator(e.target.value); setSuggestion(null); }}
          placeholder="e.g. 3210 Scranton Rd"
          style={inputStyle(t)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <button
            onClick={suggest}
            disabled={busy !== null || !locator.trim()}
            style={{
              padding: "4px 11px", fontSize: 11.5, fontFamily: "inherit",
              background: t.ink, color: t.onFill, border: "none", borderRadius: 4,
              opacity: busy || !locator.trim() ? 0.45 : 1,
              cursor: busy || !locator.trim() ? "default" : "pointer",
            }}
          >{busy === "suggest" ? "Looking up…" : "Suggest from address"}</button>
          <span style={{ fontSize: 11, color: t.inkMuted }}>Suggests, never saves on its own</span>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 11.5, color: t.ochre, lineHeight: 1.45 }}>{error}</div>
      )}

      {suggestion && <Suggestion t={t} s={suggestion} busy={busy !== null} onAccept={accept} />}
    </div>
  );
}

function Suggestion({ t, s, busy, onAccept }: {
  t: typeof STAFF_TOKENS; s: GeoResult; busy: boolean; onAccept: () => void;
}) {
  if (!s.ok) {
    // The three kinds of miss are three different jobs, and the tray says which — the same
    // distinction the Finalize pin tray keeps. "provider" is the only one worth retrying as-is.
    const advice: Record<string, string> = {
      ambiguous: "Nothing was sent to the geocoder — this shape can't be placed automatically. Type a street address, or pin it by hand.",
      no_match: "OpenStreetMap answered and has no such address. Check the street name and number.",
      provider: "The geocoder didn't answer — this one is transient. Try again in a moment.",
    };
    return (
      <div style={{
        border: `1px solid ${t.borderSoft}`, borderLeft: `3px solid ${t.ochre}`,
        borderRadius: 6, padding: "9px 11px",
      }}>
        <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.ochre }}>
          No suggestion · {s.kind}
        </div>
        <div style={{ fontSize: 12, color: t.ink, marginTop: 4 }}>{s.reason}</div>
        <div style={{ fontSize: 11, color: t.inkMuted, marginTop: 3, lineHeight: 1.45 }}>{advice[s.kind]}</div>
      </div>
    );
  }
  // `inferred` means the match was coarser than a doorway — and that happens two ways, which is
  // why the label can't say "named place": either we asked without a house number, or we asked
  // WITH one and OpenStreetMap still answered with an area ("3395 Scranton Rd" → the hospital
  // campus, not a door). Either way the honest claim is the same: this is approximately where,
  // not exactly where. Said at the point of decision, not in a tooltip — accepting one is how a
  // building ends up pinned to the middle of its own parking lot.
  const inferred = s.geoSource === "inferred";
  return (
    <div style={{
      border: `1px solid ${t.borderSoft}`, borderLeft: `3px solid ${inferred ? t.ochre : t.sage}`,
      borderRadius: 6, padding: "9px 11px",
    }}>
      <div style={{ fontFamily: t.mono, fontSize: 12, color: t.ink, letterSpacing: 0.3 }}>
        {fmt(s.lat)}° N · {fmt(Math.abs(s.lng))}° W
      </div>
      <div style={{ marginTop: 4 }}>
        <SourceChip t={t} geoSource={s.geoSource} confidence={s.geoConfidence} />
      </div>
      <div style={{ fontSize: 11, color: t.inkMuted, marginTop: 5, lineHeight: 1.45 }}>
        {inferred
          ? "Matched an area rather than a street number — expect the centre of the site, not the frontage. Check it on the map before accepting."
          : "Matched an exact street address. Check it against what the photograph shows before accepting."}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button onClick={onAccept} disabled={busy} style={{
          padding: "3px 10px", fontSize: 11, fontFamily: "inherit",
          background: t.ink, color: t.onFill, border: "none", borderRadius: 4,
          opacity: busy ? 0.5 : 1, cursor: busy ? "default" : "pointer",
        }}>Accept coordinate</button>
        <a
          href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=18/${s.lat}/${s.lng}`}
          target="_blank" rel="noreferrer"
          style={{ ...pillBtn(t), fontSize: 11, padding: "3px 10px", textDecoration: "none" }}
        >Check on map ↗</a>
      </div>
    </div>
  );
}

/**
 * Who decided this coordinate. Not a HonestyBadge: that component carries a specific claim —
 * a value a model read off the object, reviewable by a curator — and a gazetteer lookup isn't
 * one. Same reasoning the facet-review confidence chip is kept outside the honesty family.
 */
function SourceChip({ t, geoSource, confidence }: {
  t: typeof STAFF_TOKENS; geoSource: string | null; confidence: string | null;
}) {
  const label: Record<string, string> = {
    verified_address: "OpenStreetMap · street address",
    inferred: "OpenStreetMap · approximate",
    staff_lookup: "staff pin",
  };
  const warm = geoSource === "inferred" || geoSource === "staff_lookup";
  return (
    <span style={{
      fontFamily: t.mono, fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase",
      color: warm ? t.ochre : t.sage, background: warm ? t.ochreSoft : t.sageSoft,
      padding: "2px 6px", borderRadius: 3,
    } as React.CSSProperties}>
      {label[geoSource ?? ""] ?? geoSource ?? "unknown"}{confidence ? ` · ${confidence}` : ""}
    </span>
  );
}

function Mono({ t, children }: { t: typeof STAFF_TOKENS; children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: t.mono, fontSize: 11, color: t.inkMuted, letterSpacing: 0.3 } as React.CSSProperties}>
      {children}
    </span>
  );
}

const fmt = (n: number) => n.toFixed(4);
