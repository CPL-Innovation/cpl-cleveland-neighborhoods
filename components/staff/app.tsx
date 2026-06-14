"use client";
// Staff app router + state. Ported from staff-app.jsx. The whole staff/scan surface is a
// client SPA mounted at /staff; navigation is React state (NavContext), not URL routing.
import React from "react";
import { STAFF_TOKENS } from "@/lib/tokens";
import {
  NavContext, SAMPLE_RECORDS, adaptHarvestedToStaff,
  useNav, type NavCtx, type StaffRecord, type ToastTone, type NavigateOpts,
} from "@/components/staff/nav";
import { StaffShell } from "@/components/staff/shell";
import { StaffHome } from "@/components/staff/home";
import { StaffPhotosList } from "@/components/staff/photos-list";
import { StaffRecordEdit } from "@/components/staff/record-edit";
import { StaffStoryAuthor } from "@/components/staff/story-author";
import { ScanPrep } from "@/components/scan/prep";
import { ScanPipeline } from "@/components/scan/pipeline";
import { ScanReview } from "@/components/scan/review";
import { ScanAccuracy } from "@/components/scan/accuracy";

const VIEWS: Record<string, { section: string; title: string; meta: string }> = {
  home: { section: "home", title: "Home", meta: "WELCOME · BRIAN MEGGITT" },
  photos: { section: "photos", title: "Photos", meta: "22 MATCHING · TREMONT · MISSING GEO" },
  record: { section: "photos", title: "", meta: "EDIT · TREMONT WORKLIST" },
  stories: { section: "stories", title: "Stories", meta: "DRAFTS · CO-AUTHORED" },
  story: { section: "stories", title: "", meta: "DRAFT · CO-AUTHORED" },
  contrib: { section: "contrib", title: "Contributions", meta: "8 PENDING · PATRON" },
  vocab: { section: "vocab", title: "Vocabularies", meta: "6 LISTS" },
  scanPrep: { section: "prep", title: "Prep", meta: "INGEST · CROP & DESKEW" },
  scanPipeline: { section: "ingest", title: "Scan pipeline", meta: "INGEST · BOX-SCAN" },
  scanReview: { section: "ingest", title: "Review & interpret", meta: "INGEST · SCAN REVIEW" },
  scanAccuracy: { section: "ingest", title: "Accuracy", meta: "INGEST · EVAL" },
};

interface Toast { id: string; text: string; tone: ToastTone }

function Toaster({ toasts }: { toasts: Toast[] }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 9999, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          minWidth: 240, maxWidth: 380, padding: "10px 14px",
          background: "#221F1B", color: "#F6F2EB",
          border: "1px solid rgba(246,242,235,0.15)",
          borderLeft: `3px solid ${t.tone === "ok" ? "#5C7A4F" : t.tone === "warn" ? "#C8983A" : "#1F5963"}`,
          borderRadius: 6, fontSize: 12.5, lineHeight: 1.4,
          fontFamily: "'Work Sans', sans-serif",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          animation: "slideUp 180ms ease-out",
        }}>{t.text}</div>
      ))}
    </div>
  );
}

export function StaffApp() {
  const [view, setView] = React.useState("home");
  const [savedView, setSavedView] = React.useState("All harvested");
  const [selection, setSelection] = React.useState<Set<string>>(() => new Set());
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [records, setRecords] = React.useState<StaffRecord[]>(SAMPLE_RECORDS);
  const [recordId, setRecordId] = React.useState<string>(SAMPLE_RECORDS[0].id);
  const [scanId, setScanId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/data/tier3-all/records.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("records.json missing"))))
      .then((raw: Parameters<typeof adaptHarvestedToStaff>[0][]) => {
        if (cancelled) return;
        const adapted = raw.map(adaptHarvestedToStaff);
        setRecords(adapted);
        if (adapted.length) setRecordId(adapted[0].id);
        console.log(`[harvest] loaded ${adapted.length} records into the enrichment app`);
      })
      .catch((err) => console.warn("[harvest] using SAMPLE_RECORDS fallback:", err.message));
    return () => { cancelled = true; };
  }, []);

  const toast = React.useCallback((text: string, tone: ToastTone = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  const navigate = React.useCallback((target: string, opts: NavigateOpts = {}) => {
    if (target === "record" && opts.id) setRecordId(opts.id);
    if (target === "photos" && opts.savedView) setSavedView(opts.savedView);
    if ((target === "scanReview" || target === "scanPipeline") && opts.id) setScanId(opts.id);
    setView(target);
  }, []);

  const toggleSelect = React.useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => setSelection(new Set()), []);

  const ctx: NavCtx = { view, recordId, scanId, savedView, selection, navigate, toast, toggleSelect, clearSelection, records };
  const viewMeta = VIEWS[view] || VIEWS.home;
  const currentRec = records.find((r) => r.id === recordId) || records[0];

  let screenTitle = viewMeta.title;
  let screenMeta = viewMeta.meta;
  if (view === "record") {
    screenTitle = currentRec.id + ".tif";
    screenMeta = "EDIT · " + savedView.toUpperCase();
  } else if (view === "story") {
    screenTitle = "Streetcars of Detroit Avenue";
  } else if (view === "photos") {
    const n = records.filter((r) => (savedView.includes("Tremont") ? r.nbhd === "Tremont" || r.geo === "missing" : true)).length;
    screenMeta = `${n} MATCHING · ${savedView.toUpperCase()}`;
  }

  return (
    <NavContext.Provider value={ctx}>
      <StaffShell activeSection={viewMeta.section} screenTitle={screenTitle} screenMeta={screenMeta}>
        {view === "home" && <StaffHome />}
        {view === "photos" && <StaffPhotosList />}
        {view === "record" && <StaffRecordEdit />}
        {view === "stories" && <StoriesIndex />}
        {view === "story" && <StaffStoryAuthor />}
        {view === "contrib" && <StubView title="Contributions queue" body="Patron-suggested fixes land here. Triage UI not built in this MVP." />}
        {view === "vocab" && <StubView title="Vocabularies" body="Controlled lists for neighborhoods, themes, places. Not built in this MVP." />}
        {view === "scanPrep" && <ScanPrep />}
        {view === "scanPipeline" && <ScanPipeline />}
        {view === "scanReview" && <ScanReview />}
        {view === "scanAccuracy" && <ScanAccuracy />}
      </StaffShell>
      <Toaster toasts={toasts} />
    </NavContext.Provider>
  );
}

function StoriesIndex() {
  const t = STAFF_TOKENS;
  const nav = useNav();
  const stories = [
    { id: "streetcars-detroit", title: "Streetcars of Detroit Avenue", dek: "From horse-drawn cars to the last electric line: forty years of one street's spine.", stops: 5, status: "draft", authors: "@brian, @lisa" },
    { id: "millionaires-row", title: "Millionaire's Row", dek: "The mansions Euclid Ave lost — and the photographs that remember them.", stops: 8, status: "published", authors: "@olivia" },
    { id: "tremont-churches", title: "Steeples of Tremont", dek: "Six congregations within walking distance, six different decades.", stops: 6, status: "draft", authors: "@brian" },
  ];
  return (
    <div style={{ width: "100%", height: "100%", overflowY: "auto", background: t.bg }}>
      <div style={{ padding: "32px 40px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontFamily: t.serif, fontSize: 26, fontWeight: 460, color: t.ink }}>Stories</div>
          <button onClick={() => nav.toast("Stub — new story creation not built in MVP", "info")} style={{ height: 32, padding: "0 14px", background: t.ink, color: "#F6F2EB", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ New story</button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {stories.map((s) => (
            <div key={s.id}
              onClick={() => (s.id === "streetcars-detroit" ? nav.navigate("story", { id: s.id }) : nav.toast(`"${s.title}" — preview not built in MVP`, "info"))}
              style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: "16px 20px", cursor: "pointer", display: "flex", gap: 18, alignItems: "center" }}>
              <div style={{ width: 80, height: 60, borderRadius: 5, background: `repeating-linear-gradient(${30 + s.stops * 22}deg, #C8B68F 0 6px, #B8A37A 6px 12px)`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                  <span style={{ fontFamily: t.serif, fontSize: 17, fontWeight: 500, color: t.ink }}>{s.title}</span>
                  <span style={{ background: s.status === "published" ? t.sageSoft : t.draftSoft, color: s.status === "published" ? t.sage : t.draft, fontFamily: t.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", padding: "2px 7px", borderRadius: 3, fontWeight: 500 } as React.CSSProperties}>{s.status}</span>
                </div>
                <div style={{ color: t.inkMuted, fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>{s.dek}</div>
                <div style={{ fontFamily: t.mono, fontSize: 10.5, color: t.inkFaint, letterSpacing: 0.3 }}>{s.stops} stops · {s.authors}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StubView({ title, body }: { title: string; body: string }) {
  const t = STAFF_TOKENS;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg }}>
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div style={{ fontFamily: t.serif, fontSize: 22, fontWeight: 500, color: t.ink, marginBottom: 6 }}>{title}</div>
        <div style={{ color: t.inkMuted, fontSize: 13.5, lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}
