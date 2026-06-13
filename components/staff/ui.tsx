"use client";
// Shared UI primitives, extracted from staff-record-edit.jsx (where they were defined and
// reused across story-author + the scan surfaces). Style helpers keep the (t, ...) signature
// so call sites pass STAFF_TOKENS unchanged.
import React from "react";
import { STAFF_TOKENS, type StaffTokens } from "@/lib/tokens";

export function pillBtn(t: StaffTokens, primary?: boolean): React.CSSProperties {
  return {
    height: 28, padding: "0 12px",
    background: primary ? t.ink : t.bgPanel,
    color: primary ? "#F6F2EB" : t.ink,
    border: primary ? "none" : `1px solid ${t.border}`,
    borderRadius: 6,
    fontSize: 12, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", gap: 6,
  };
}

export function inputStyle(t: StaffTokens, extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    height: 30, padding: "0 10px",
    background: "#fff",
    border: `1px solid ${t.border}`,
    borderRadius: 5,
    fontFamily: t.sans, fontSize: 13, color: t.ink,
    width: "100%", boxSizing: "border-box",
    outline: "none",
    ...extra,
  };
}

export function textareaStyle(t: StaffTokens, height = 64): React.CSSProperties {
  return {
    minHeight: height,
    padding: 10,
    background: "#fff",
    border: `1px solid ${t.border}`,
    borderRadius: 5,
    fontFamily: t.sans, fontSize: 13, color: t.ink,
    lineHeight: 1.45,
    width: "100%", boxSizing: "border-box",
    outline: "none", resize: "vertical",
  };
}

export function selectStyle(t: StaffTokens): React.CSSProperties {
  return {
    height: 30, padding: "0 8px",
    background: "#fff",
    border: `1px solid ${t.border}`,
    borderRadius: 5,
    fontFamily: t.sans, fontSize: 12.5, color: t.ink,
  };
}

export function Kbd({ children, small }: { children: React.ReactNode; small?: boolean }) {
  const t = STAFF_TOKENS;
  return (
    <span style={{
      display: "inline-block",
      padding: small ? "1px 4px" : "1px 5px",
      background: "#fff",
      border: `1px solid ${t.border}`,
      borderRadius: 3,
      fontFamily: t.mono,
      fontSize: small ? 9.5 : 10,
      color: t.ink,
      letterSpacing: 0,
      lineHeight: 1.3,
      marginRight: 2,
    }}>{children}</span>
  );
}

export function FieldFoot({ children, t }: { children: React.ReactNode; t: StaffTokens }) {
  return (
    <div style={{ fontSize: 11, color: t.inkFaint, marginTop: 4, fontStyle: "italic" }}>{children}</div>
  );
}

export function FieldGroup({ label, children, tight }: { label: string; children: React.ReactNode; tight?: boolean }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{
      paddingBottom: tight ? 0 : 14,
      marginBottom: tight ? 4 : 14,
      borderBottom: tight ? "none" : `1px solid ${t.borderSoft}`,
    }}>
      <div style={{
        fontFamily: t.mono, fontSize: 10,
        letterSpacing: 1.4, textTransform: "uppercase",
        color: t.inkMuted, marginBottom: 10,
      }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

export interface Provenance { who: string; when: string }

export function Field({ label, provenance, dirty, ai, children }: {
  label: string;
  provenance?: Provenance;
  dirty?: boolean;
  ai?: boolean;
  children: React.ReactNode;
}) {
  const t = STAFF_TOKENS;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: t.ink }}>{label}</span>
          {dirty && <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.draft }} title="unsaved changes" />}
          {ai && (
            <span style={{
              fontFamily: t.mono, fontSize: 9, letterSpacing: 0.6,
              textTransform: "uppercase", color: t.teal,
              background: t.tealSoft, padding: "1px 5px", borderRadius: 3,
            }}>AI · reviewed</span>
          )}
        </div>
        {provenance && (
          <span style={{ fontFamily: t.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.2 }} title={`Edited by ${provenance.who} ${provenance.when}`}>
            {provenance.who} · {provenance.when}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function ChipInput({ chips, placeholder, suggested }: { chips: string[]; placeholder?: string; suggested?: string }) {
  const t = STAFF_TOKENS;
  return (
    <div>
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 5,
        padding: "6px 6px 6px 8px", minHeight: 30,
        background: "#fff", border: `1px solid ${t.border}`,
        borderRadius: 5, alignItems: "center",
      }}>
        {chips.map((c) => (
          <span key={c} style={{
            background: t.bg, color: t.ink, fontSize: 11.5,
            padding: "3px 7px", borderRadius: 12,
            border: `1px solid ${t.borderSoft}`,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            {c}
            <span style={{ color: t.inkFaint, cursor: "pointer", marginLeft: 2 }}>×</span>
          </span>
        ))}
        <input placeholder={placeholder} style={{
          flex: 1, minWidth: 80, border: "none", outline: "none",
          background: "transparent", fontSize: 12, color: t.ink,
          fontFamily: t.sans, padding: "3px 4px",
        }} />
      </div>
      {suggested && (
        <div style={{ fontSize: 11, color: t.teal, marginTop: 5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{
            fontFamily: t.mono, fontSize: 9, letterSpacing: 0.5,
            textTransform: "uppercase", background: t.tealSoft,
            padding: "1px 5px", borderRadius: 3,
          }}>AI</span>
          {suggested}
        </div>
      )}
    </div>
  );
}
