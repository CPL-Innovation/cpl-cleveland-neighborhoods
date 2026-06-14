"use client";
// ClevelandMap — Leaflet + CARTO Positron basemap with CSS-styled div-icon photo dots.
// Ported from cleveland-map.jsx's Leaflet implementation. Loaded via next/dynamic({ssr:false})
// so Leaflet (which needs window/DOM) never runs on the server. The photo pool now arrives
// as a prop (was window.ALL_PHOTOS); the rest of the prop surface is unchanged.
import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./patron.css";
import { MILLIONAIRES_ROW, unprojectXY, type Photo } from "./data";

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
  const markersRef = React.useRef<Map<string, L.Marker>>(new Map());
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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

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

    photos.forEach((p) => {
      const isIn = p.year >= lo && p.year <= hi;
      const isFeatured = !!p.featured;
      const ll = (p.lat != null && p.lng != null)
        ? { lat: p.lat, lng: p.lng }
        : unprojectXY(p.x, p.y);

      const classes = [
        "cm-dot",
        isFeatured ? "cm-dot--featured" : "",
        !isIn ? "cm-dot--dim" : "",
      ].filter(Boolean).join(" ");

      const icon = L.divIcon({
        className: "cm-dot-wrap",
        html: `<div class="${classes}" data-photo-id="${esc(p.id)}"><span class="cm-dot-ring"></span><span class="cm-dot-core"></span></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([ll.lat, ll.lng], {
        icon,
        interactive: isIn,
        keyboard: false,
        riseOnHover: true,
        riseOffset: 250,
      });

      if (isIn) {
        const yearClass = isFeatured ? "cm-year cm-year--featured" : "cm-year";
        const metaParts: string[] = [];
        if (p.neighborhood) metaParts.push(p.neighborhood);
        if (p.story) metaParts.push(p.story);
        const metaHtml = metaParts.length
          ? `<span class="cm-meta">${esc(metaParts.join(" · "))}</span>`
          : "";
        marker.bindTooltip(
          `<span class="${yearClass}">${p.year}</span>` +
            `<span class="cm-title">${esc(p.title)}</span>` +
            metaHtml,
          { direction: "top", offset: [0, -8], className: "cm-tooltip", opacity: 1, sticky: false },
        );
        marker.on("click", () => cbRef.current.onDotClick && cbRef.current.onDotClick(p));
        marker.on("mouseover", () => cbRef.current.onDotHover && cbRef.current.onDotHover(p.id));
        marker.on("mouseout", () => cbRef.current.onDotHover && cbRef.current.onDotHover(null));
      }

      marker.addTo(map);
      markersRef.current.set(p.id, marker);
    });
  }, [lo, hi, photos]);

  // ── Highlight selected (CSS class on the div-icon) ──
  React.useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const el = m.getElement();
      if (!el) return;
      const dot = el.querySelector(".cm-dot");
      if (!dot) return;
      dot.classList.toggle("cm-dot--selected", id === selectedId);
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
