"use client";
// ClevelandMap — Leaflet + a pale keyless basemap (see ./basemap.ts) with CSS-styled div-icon photo dots.
// Ported from cleveland-map.jsx's Leaflet implementation. Loaded via next/dynamic({ssr:false})
// so Leaflet (which needs window/DOM) never runs on the server. The photo pool now arrives
// as a prop (was window.ALL_PHOTOS); the rest of the prop surface is unchanged.
import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./patron.css";
import { MILLIONAIRES_ROW, unprojectXY, type Photo } from "./data";
import { basemap } from "./basemap";
import { groupIntoPlaces, yearSpan } from "@/lib/patron-places";

interface ClevelandMapProps {
  width?: number;
  height?: number;
  zoom?: number;
  yearRange?: [number, number];
  selectedId?: string | null;
  hoveredId?: string | null;
  onDotClick?: ((p: Photo) => void) | null;
  onDotHover?: ((id: string | null) => void) | null;
  nearYou?: { x?: number; y?: number; lat?: number; lng?: number } | null;
  photos?: Photo[];
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[<>&"]/g, (c) => (
    { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string
  ));

export default function ClevelandMap({
  width = 1200,
  height = 700,
  zoom = 1,
  yearRange = [1880, 2020],
  selectedId = null,
  hoveredId = null,
  onDotClick = null,
  onDotHover = null,
  nearYou = null,
  photos = [],
}: ClevelandMapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  // Keyed by PLACE, not photo: repeat visits to one corner share a coordinate, so one marker
  // stands for all of them (lib/patron-places.ts). placeOfPhoto maps back for selection.
  const markersRef = React.useRef<Map<string, L.Marker>>(new Map());
  const placeOfPhotoRef = React.useRef<Map<string, string>>(new Map());
  const corridorRef = React.useRef<L.LayerGroup | null>(null);
  const nearYouRef = React.useRef<L.Marker | null>(null);

  // Keep callbacks fresh without retriggering the markers effect.
  const cbRef = React.useRef({ onDotClick, onDotHover });
  cbRef.current = { onDotClick, onDotHover };

  // ── Mount: initialise Leaflet, base tiles, featured corridor ──
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [41.4995, -81.6938], // Public Square
      zoom: 13,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 90,
      preferCanvas: true, // smoother with many markers
    });

    // See components/patron/basemap.ts — the provider is a seam because CARTO's keyless tiles
    // now render "API KEY REQUIRED" while still returning HTTP 200.
    const base = basemap();
    L.tileLayer(base.url, {
      attribution: base.attribution,
      subdomains: base.subdomains ?? "abc",
      maxZoom: 19,
      maxNativeZoom: base.maxNativeZoom, // past this the provider has no tiles — upscale, don't blank
    }).addTo(map);
    if (base.labels) {
      // Place names ride on their own layer for this provider; without it the city loses its
      // neighbourhood names, which are half of how you find your street. Its own pane, sitting
      // between the tiles (200) and the vectors (400), so the featured corridor and the photo dots
      // stay on top — and pointer-events off, so a label tile can never swallow a click on a dot.
      const pane = map.createPane("basemapLabels");
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
      L.tileLayer(base.labels.url, {
        maxZoom: 19,
        maxNativeZoom: base.labels.maxNativeZoom,
        pane: "basemapLabels",
      }).addTo(map);
    }

    // Featured Millionaire's Row corridor — soft glow + crisp dashed line.
    const corridor = MILLIONAIRES_ROW.map((p) => {
      const ll = unprojectXY(p.x, p.y);
      return [ll.lat, ll.lng] as [number, number];
    });
    const corridorGlow = L.polyline(corridor, {
      color: "#C8983A", weight: 14, opacity: 0.18,
      lineCap: "round", lineJoin: "round", interactive: false,
    }).addTo(map);
    const corridorDash = L.polyline(corridor, {
      color: "#C8983A", weight: 2, opacity: 0.7,
      dashArray: "1, 7", lineCap: "round", interactive: false,
    }).addTo(map);
    corridorRef.current = L.layerGroup([corridorGlow, corridorDash]).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Resize when container changes ──
  React.useEffect(() => {
    if (mapRef.current) mapRef.current.invalidateSize();
  }, [width, height]);

  // ── External zoom prop → Leaflet zoom level ──
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = 13 + (zoom - 1) * 2.5;
    if (Math.abs(map.getZoom() - target) > 0.05) {
      map.setZoom(target, { animate: true });
    }
  }, [zoom]);

  // ── Photo markers ──
  const [lo, hi] = yearRange;
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    placeOfPhotoRef.current.clear();

    groupIntoPlaces(photos).forEach((place) => {
      // The slider filters *within* a place: the count reflects what's in range, and the dot
      // only dims when the whole corner falls outside it. A corner never vanishes because one
      // of its visits is out of range.
      const inRange = place.photos.filter((p) => p.year >= lo && p.year <= hi);
      const isIn = inRange.length > 0;
      const shown = isIn ? inRange : place.photos;
      const lead = shown[0];
      const isFeatured = shown.some((p) => p.featured);
      const stacked = inRange.length > 1;

      for (const p of place.photos) placeOfPhotoRef.current.set(p.id, place.key);

      const classes = [
        "cm-dot",
        isFeatured ? "cm-dot--featured" : "",
        !isIn ? "cm-dot--dim" : "",
        stacked ? "cm-dot--stacked" : "",
      ].filter(Boolean).join(" ");

      const badge = stacked ? `<span class="cm-dot-count">${inRange.length}</span>` : "";
      const icon = L.divIcon({
        className: "cm-dot-wrap",
        html: `<div class="${classes}" data-place-key="${esc(place.key)}"><span class="cm-dot-ring"></span><span class="cm-dot-core"></span>${badge}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([place.lat, place.lng], {
        icon,
        interactive: isIn,
        keyboard: false,
        riseOnHover: true,
        riseOffset: 250,
      });

      if (isIn) {
        const yearClass = isFeatured ? "cm-year cm-year--featured" : "cm-year";
        const span = yearSpan(shown);
        const metaParts: string[] = [];
        if (lead.neighborhood) metaParts.push(lead.neighborhood);
        if (lead.story) metaParts.push(lead.story);
        if (stacked) metaParts.unshift(`${inRange.length} photographs`);
        const metaHtml = metaParts.length
          ? `<span class="cm-meta">${esc(metaParts.join(" · "))}</span>`
          : "";
        marker.bindTooltip(
          `<span class="${yearClass}">${span ?? "date unknown"}</span>` +
            `<span class="cm-title">${esc(lead.title)}</span>` +
            metaHtml,
          { direction: "top", offset: [0, -8], className: "cm-tooltip", opacity: 1, sticky: false },
        );
        marker.on("click", () => cbRef.current.onDotClick && cbRef.current.onDotClick(lead));
        marker.on("mouseover", () => cbRef.current.onDotHover && cbRef.current.onDotHover(lead.id));
        marker.on("mouseout", () => cbRef.current.onDotHover && cbRef.current.onDotHover(null));
      }

      marker.addTo(map);
      markersRef.current.set(place.key, marker);
    });
  }, [lo, hi, photos]);

  // ── Highlight selected (CSS class on the div-icon) ──
  React.useEffect(() => {
    const selectedPlace = selectedId ? placeOfPhotoRef.current.get(selectedId) : null;
    markersRef.current.forEach((m, key) => {
      const el = m.getElement();
      if (!el) return;
      const dot = el.querySelector(".cm-dot");
      if (!dot) return;
      dot.classList.toggle("cm-dot--selected", key === selectedPlace);
    });
  }, [selectedId]);

  // ── "You are here" marker ──
  React.useEffect(() => {
    if (nearYouRef.current) {
      nearYouRef.current.remove();
      nearYouRef.current = null;
    }
    const map = mapRef.current;
    if (!map || !nearYou) return;
    const ll = (nearYou.lat != null && nearYou.lng != null)
      ? { lat: nearYou.lat, lng: nearYou.lng }
      : unprojectXY(nearYou.x ?? 0, nearYou.y ?? 0);
    const icon = L.divIcon({
      className: "cm-near",
      html: '<div class="cm-near-pulse"></div><div class="cm-near-dot"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    nearYouRef.current = L.marker([ll.lat, ll.lng], { icon, interactive: false, keyboard: false }).addTo(map);
  }, [nearYou]);

  // hoveredId is wired through for parity with the prototype's prop surface; hover styling
  // is handled by Leaflet's :hover CSS on the div-icon, so no effect is needed here.
  void hoveredId;

  return <div ref={containerRef} style={{ width, height, background: "#F1ECE2" }} />;
}
