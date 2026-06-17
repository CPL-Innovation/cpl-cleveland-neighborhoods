"use client";
// Patron overlays: search panel, photo detail (slide-in), and the Millionaire's Row
// story trail. Ported from desktop-landing.jsx. The photo pool arrives as props (was
// window.ALL_PHOTOS); the story trail reads MILLIONAIRES_ROW directly.
import React from "react";
import { MILLIONAIRES_ROW, type Photo } from "./data";

export function SearchIcon({ size = 14, color = "#3D3833" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={color} strokeWidth="1.4" />
      <path d="M9.5 9.5 L13 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Search panel (inline expand) ────────────────────────────────

const EXEMPLAR_PROMPTS = [
  "Public Square 1930",
  "West Side Market",
  "Millionaire's Row",
  "Detroit Ave streetcar",
  "1234 Detroit Ave.",
];

export function SearchPanel({
  query, onQuery, onClose, onPick, photos,
}: {
  query: string;
  onQuery: (q: string) => void;
  onClose: () => void;
  onPick: (p: Photo) => void;
  photos: Photo[];
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? photos.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.neighborhood || "").toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q) ||
        String(p.year).includes(q)
      ).slice(0, 8)
    : [];

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: "rgba(26,24,20,0.32)",
        display: "flex", justifyContent: "center", paddingTop: 92,
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640, background: "#FFFFFF", border: "1px solid #D6CDBD",
          borderRadius: 14, boxShadow: "0 24px 60px rgba(26,24,20,0.22)", overflow: "hidden",
          height: "fit-content",
        }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px", borderBottom: "1px solid #EEE6D6",
        }}>
          <SearchIcon size={16} color="#6B6359" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Try a place, year, or address…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontFamily: "'Work Sans', sans-serif", fontSize: 16, color: "#1A1814",
              background: "transparent",
            }}
          />
          <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, color: "#A39684" }}>esc</span>
        </div>

        {!q && (
          <div style={{ padding: "14px 18px" }}>
            <div style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
              color: "#A39684", marginBottom: 10,
            }}>Try</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXEMPLAR_PROMPTS.map((p) => (
                <button key={p} onClick={() => onQuery(p)} style={{
                  background: "#F6F2EB", border: "1px solid #E6DECC", borderRadius: 999,
                  padding: "6px 12px", fontSize: 13, color: "#3D3833", cursor: "pointer",
                  fontFamily: "'Work Sans', sans-serif",
                }}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {q && results.length === 0 && (
          <div style={{ padding: "24px 18px", color: "#6B6359", fontSize: 14 }}>
            No matches. Try a neighborhood or a year.
          </div>
        )}

        {q && results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {results.map((p) => (
              <button key={p.id} onClick={() => onPick(p)} style={{
                display: "flex", alignItems: "center", gap: 12,
                width: "100%", textAlign: "left", padding: "10px 18px",
                background: "transparent", border: "none",
                borderBottom: "1px solid #F0EADC", cursor: "pointer",
                fontFamily: "'Work Sans', sans-serif",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF6EE")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: p.featured ? "#C8983A" : "#A8362B", flexShrink: 0,
                }} />
                <span style={{ flex: 1, color: "#1A1814", fontSize: 14 }}>{p.title}</span>
                <span style={{ color: "#6B6359", fontSize: 12 }}>{p.neighborhood}</span>
                <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, color: "#A39684" }}>{p.year}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Photo detail panel (slides in from right) ───────────────────

export function PhotoDetailPanel({
  photo, onClose, onOpenPhoto, photos,
}: {
  photo: Photo;
  onClose: () => void;
  onOpenPhoto: (p: Photo) => void;
  photos: Photo[];
}) {
  // Neighbors-in-time: within ~80 viewBox units AND ±8 years. Skipped for the faceted 99
  // (they aren't map-placed — the convergence slice opens them from the browse grid).
  const neighbors = photo.facets ? [] : photos.filter((p) =>
    p.id !== photo.id &&
    Math.hypot(p.x - photo.x, p.y - photo.y) < 80 &&
    Math.abs(p.year - photo.year) <= 8
  ).slice(0, 5);

  const [view, setView] = React.useState<"then" | "now">("then");

  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 59, background: "rgba(26,24,20,0.18)" }} />
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: 480, zIndex: 60, background: "#FFFFFF",
        borderLeft: "1px solid #D6CDBD", boxShadow: "-10px 0 40px rgba(26,24,20,0.12)",
        display: "flex", flexDirection: "column",
        animation: "patronSlideIn 260ms cubic-bezier(.2,.8,.2,1)",
      }}>
        <style>{`@keyframes patronSlideIn { from { transform: translateX(40px); opacity: 0;} to { transform: translateX(0); opacity:1;} }`}</style>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid #EEE6D6",
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: "#6B6359",
          }}>Photo · {photo.year}</div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, lineHeight: 1, color: "#6B6359",
          }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{
            position: "relative", margin: 18, borderRadius: 8, overflow: "hidden", height: 280,
            background: view === "then"
              ? (photo.thumb ? "#1A1814" : "repeating-linear-gradient(135deg, #C8B68F 0 8px, #B8A37A 8px 16px)")
              : "repeating-linear-gradient(135deg, #C8C3B6 0 8px, #B0AC9F 8px 16px)",
            border: "1px solid #D6CDBD",
          }}>
            {view === "then" && photo.thumb && (
              <img src={photo.thumb} alt={photo.title} style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "contain", display: "block",
              }} />
            )}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(180deg, rgba(26,24,20,0) 50%, rgba(26,24,20,0.45) 100%)",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", top: 10, left: 12,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, color: "#fff", opacity: 0.92, background: "rgba(26,24,20,0.55)",
              padding: "4px 8px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase",
            }}>{view === "then" ? `Then · ${photo.year}` : "Now · 2026"}</div>

            <div style={{
              position: "absolute", bottom: 12, left: 12, display: "flex",
              background: "#FFFFFF", border: "1px solid #D6CDBD", borderRadius: 999,
              overflow: "hidden", boxShadow: "0 2px 8px rgba(26,24,20,0.15)",
            }}>
              {(["then", "now"] as const).map((m) => (
                <button key={m} onClick={() => setView(m)} style={{
                  padding: "6px 14px",
                  background: view === m ? "#1A1814" : "transparent",
                  color: view === m ? "#F6F2EB" : "#1A1814",
                  border: "none", fontSize: 12, fontWeight: 500,
                  textTransform: "capitalize", cursor: "pointer",
                  fontFamily: "'Work Sans', sans-serif",
                }}>{m}</button>
              ))}
            </div>

            <div style={{
              position: "absolute", bottom: 12, right: 12,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, color: "#fff", opacity: 0.85,
            }}>scroll to zoom</div>
          </div>

          <div style={{ padding: "0 18px 0" }}>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontWeight: 500, fontSize: 24, lineHeight: 1.15, letterSpacing: -0.2,
              color: "#1A1814", marginBottom: 10,
            }}>{photo.title}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Pill tone={photo.rights.startsWith("Public") ? "good" : "warn"}>{photo.rights}</Pill>
              {photo.featured && photo.story && <Pill tone="featured">Featured in {photo.story}</Pill>}
            </div>
          </div>

          <div style={{
            padding: "0 18px", display: "grid", gridTemplateColumns: "110px 1fr",
            rowGap: 8, columnGap: 12, fontSize: 13, color: "#3D3833",
          }}>
            <MetaLabel>Date</MetaLabel><MetaValue>{photo.date_display || `c. ${photo.year}`}</MetaValue>
            <MetaLabel>Photographer</MetaLabel><MetaValue>{photo.photographer}</MetaValue>
            <MetaLabel>Address</MetaLabel><MetaValue>{photo.address}</MetaValue>
            <MetaLabel>Neighborhood</MetaLabel><MetaValue>{photo.neighborhood}</MetaValue>
            <MetaLabel>Held at</MetaLabel><MetaValue>{photo.branch}</MetaValue>
          </div>

          {photo.facets && <FacetsBlock photo={photo} />}

          {photo.note && (
            <div style={{
              margin: "18px 18px 0", padding: "14px 16px",
              background: "#FAF6EE", border: "1px solid #EEE6D6",
              borderLeft: "3px solid #1F5963", borderRadius: 6,
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
                color: "#1F5963", marginBottom: 6,
              }}>Librarian&apos;s Note · Brian K.</div>
              <div style={{
                fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
                fontSize: 15, lineHeight: 1.45, color: "#1A1814",
              }}>{photo.note}</div>
            </div>
          )}

          {neighbors.length > 0 && (
            <div style={{ marginTop: 24, padding: "0 18px" }}>
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
                color: "#6B6359", marginBottom: 10,
              }}>Neighbors in time</div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                {neighbors.map((n) => (
                  <button key={n.id} onClick={() => onOpenPhoto(n)} style={{
                    flexShrink: 0, width: 132, background: "none",
                    border: "1px solid #EEE6D6", borderRadius: 8, padding: 0,
                    textAlign: "left", cursor: "pointer", overflow: "hidden",
                    fontFamily: "'Work Sans', sans-serif",
                  }}>
                    <div style={{
                      height: 76,
                      background: n.thumb
                        ? `center / cover no-repeat url(${n.thumb})`
                        : "repeating-linear-gradient(135deg, #C8B68F 0 6px, #B8A37A 6px 12px)",
                    }} />
                    <div style={{ padding: 8 }}>
                      <div style={{
                        fontSize: 12, color: "#1A1814", fontWeight: 500, lineHeight: 1.2,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{n.title}</div>
                      <div style={{
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        fontSize: 10, color: "#A39684", marginTop: 3,
                      }}>{n.year} · {n.neighborhood.split("·")[0].trim()}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{
            margin: "22px 18px 0", padding: "14px 16px",
            background: "#FFFFFF", border: "1px dashed #D6CDBD", borderRadius: 6,
          }}>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontSize: 16, color: "#1A1814", marginBottom: 4,
            }}>Do you remember this corner?</div>
            <div style={{ fontSize: 13, color: "#3D3833", lineHeight: 1.45, marginBottom: 10 }}>
              Tell us what you know — a name, a date, a story. CPL staff review every note.
            </div>
            <button style={{
              padding: "8px 14px", background: "#1A1814", color: "#F6F2EB",
              border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer",
              fontFamily: "'Work Sans', sans-serif",
            }}>Add a memory →</button>
          </div>

          <div style={{ margin: "22px 18px 24px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ActionLink>Cite</ActionLink>
            <ActionLink>Share</ActionLink>
            <ActionLink>Request a scan</ActionLink>
            <ActionLink>Visit {photo.branch}</ActionLink>
          </div>
        </div>
      </div>
    </>
  );
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "#A39684",
    }}>{children}</div>
  );
}
function MetaValue({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#1A1814" }}>{children}</div>;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "good" | "warn" | "featured" }) {
  const tones = {
    good: { bg: "#EAF0EF", fg: "#1F5963", bd: "#CBD9D8" },
    warn: { bg: "#FBEFE2", fg: "#8B5E1F", bd: "#E9D6B4" },
    featured: { bg: "#FBF1DC", fg: "#8B6E1F", bd: "#E9D6A0" },
  };
  const t = tones[tone] || tones.good;
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase",
      padding: "4px 9px", borderRadius: 999,
      background: t.bg, color: t.fg, border: "1px solid " + t.bd,
    }}>{children}</span>
  );
}

// ── Tier 1.5 facets block (convergence slice) ───────────────────
// Renders the AI-extracted facets beside the photo, grouped by axis. Honesty-labeled
// "AI-extracted (staff-reviewable)" — the visible-only contract. scene_text shows the
// transcribed signage verbatim (the payoff the catalog can't surface).
const FL = (s: string) => s.replace(/_/g, " ");

function FacetsBlock({ photo }: { photo: Photo }) {
  const f = photo.facets;
  if (!f) return null;

  // Building summary line (decomposed structure facets).
  const buildingBits = [
    f.building_type && FL(f.building_type),
    f.stories && f.stories !== "unknown" && `${f.stories}-story`,
    f.has_porch && "porch",
    f.roof_form?.length && `${f.roof_form.map(FL).join(" / ")} roof`,
  ].filter(Boolean) as string[];

  const chipGroups: [string, string[]][] = [
    ["Materials", (f.materials ?? []).map(FL)],
    ["Street & ground", (f.street_and_ground ?? []).map(FL)],
    ["Transport", (f.transport ?? []).map(FL)],
    ["Vegetation", (f.vegetation ?? []).map(FL)],
    ["Accessory", (f.accessory_structures ?? []).map(FL)],
    ["Change", (f.condition_and_change ?? []).map(FL)],
    ["People", (f.people_present ?? []).map(FL)],
  ];

  return (
    <div style={{ margin: "20px 18px 0", padding: "14px 16px", background: "#FAF6EE", border: "1px solid #EEE6D6", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 9.5, letterSpacing: 0.6,
          textTransform: "uppercase", color: "#8B6E1F", background: "#FBF1DC", border: "1px solid #E9D6A0",
          padding: "2px 7px", borderRadius: 3,
        }}>AI-extracted · staff-reviewable</span>
      </div>

      {photo.caption && (
        <div style={{
          fontFamily: "Spectral, 'Libre Caslon Text', Georgia, serif", fontSize: 14.5, lineHeight: 1.45,
          color: "#1A1814", marginBottom: 12, fontStyle: "italic",
        }}>“{photo.caption}”</div>
      )}

      {buildingBits.length > 0 && (
        <FacetRow label="Building">{buildingBits.join(" · ")}</FacetRow>
      )}

      {chipGroups.filter(([, v]) => v.length).map(([label, vals]) => (
        <div key={label} style={{ marginBottom: 8 }}>
          <FacetRowLabel>{label}</FacetRowLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 3 }}>
            {vals.map((v) => <FacetChip key={v}>{v}</FacetChip>)}
          </div>
        </div>
      ))}

      {f.scene_text?.length ? (
        <div style={{ marginTop: 10 }}>
          <FacetRowLabel>Signage in the photo</FacetRowLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            {f.scene_text.map((s, i) => (
              <div key={i} style={{ fontSize: 13.5, color: "#1A1814" }}>
                <span style={{ fontWeight: 600 }}>“{s.text}”</span>
                <span style={{ color: "#A39684", fontSize: 11.5, marginLeft: 6, fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>{FL(s.kind)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <FacetRowLabel>{label}</FacetRowLabel>
      <div style={{ fontSize: 13.5, color: "#1A1814", marginTop: 2 }}>{children}</div>
    </div>
  );
}
function FacetRowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10, letterSpacing: 0.6,
      textTransform: "uppercase", color: "#A39684",
    }}>{children}</div>
  );
}
function FacetChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 12, color: "#1F5963", background: "#EAF0EF", border: "1px solid #CBD9D8",
      padding: "3px 9px", borderRadius: 999,
    }}>{children}</span>
  );
}

function ActionLink({ children }: { children: React.ReactNode }) {
  return (
    <button style={{
      background: "transparent", border: "1px solid #D6CDBD", borderRadius: 999,
      padding: "7px 14px", fontSize: 13, color: "#1A1814", cursor: "pointer",
      fontFamily: "'Work Sans', sans-serif",
    }}>{children}</button>
  );
}

// ── Story panel (Millionaire's Row map-trail) ───────────────────

export function StoryPanel({
  onClose, onOpenPhoto,
}: {
  onClose: () => void;
  onOpenPhoto: (p: Photo) => void;
}) {
  const stops = MILLIONAIRES_ROW;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 40,
        background: "rgba(26,24,20,0.55)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        padding: "64px 32px", overflowY: "auto",
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, 100%)", background: "#F6F2EB",
          border: "1px solid #D6CDBD", borderRadius: 14,
          boxShadow: "0 24px 60px rgba(26,24,20,0.32)", padding: "32px 40px 40px",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 11, letterSpacing: 1, textTransform: "uppercase",
              color: "#A8362B", marginBottom: 6,
            }}>Story of the week · Map trail</div>
            <h1 style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontWeight: 500, fontSize: 40, letterSpacing: -0.6,
              margin: "0 0 12px", color: "#1A1814",
            }}>Millionaire&apos;s Row</h1>
            <div style={{
              fontFamily: "Spectral, 'Libre Caslon Text', Georgia, 'Times New Roman', serif",
              fontSize: 18, lineHeight: 1.45, color: "#3D3833", maxWidth: 620,
            }}>
              Between 1880 and 1930, four miles of Euclid Avenue held some of the largest private
              fortunes in the country. By the time anyone thought to save it, almost all of it was gone.
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 24, lineHeight: 1, color: "#6B6359",
          }}>×</button>
        </div>

        <div style={{
          marginTop: 18, paddingTop: 14, borderTop: "1px solid #D6CDBD",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, color: "#6B6359", letterSpacing: 0.4, display: "flex", gap: 18,
        }}>
          <span>Curated by Brian K.</span><span>·</span>
          <span>{stops.length} stops</span><span>·</span><span>1900–1928</span>
        </div>

        <div style={{ marginTop: 28, display: "grid", gap: 16 }}>
          {stops.map((s, i) => (
            <button key={s.id} onClick={() => onOpenPhoto(s)} style={{
              display: "grid", gridTemplateColumns: "36px 120px 1fr",
              gap: 18, alignItems: "center", background: "#FFFFFF",
              border: "1px solid #E6DECC", borderRadius: 10, padding: 12,
              textAlign: "left", cursor: "pointer", fontFamily: "'Work Sans', sans-serif",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C8983A")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E6DECC")}
            >
              <div style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 14, color: "#A8362B", textAlign: "center",
              }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{
                width: 120, height: 78,
                background: "repeating-linear-gradient(135deg, #C8B68F 0 8px, #B8A37A 8px 16px)",
                borderRadius: 6,
              }} />
              <div>
                <div style={{
                  fontFamily: "Spectral, serif", fontWeight: 500,
                  fontSize: 18, color: "#1A1814", marginBottom: 4,
                }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#3D3833", lineHeight: 1.4 }}>
                  {s.note || s.address}
                </div>
                <div style={{
                  marginTop: 6, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 11, color: "#A39684",
                }}>{s.year} · {s.address}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
