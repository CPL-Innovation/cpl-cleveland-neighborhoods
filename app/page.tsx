import type { Metadata } from "next";
import PatronLanding from "@/components/patron/landing";

// The patron-facing discovery interface (Leaflet map + landing), migrated from the static
// prototype (index.html + cleveland-map.jsx + desktop-landing.jsx) into the Next tree.
// The Leaflet map inside <PatronLanding/> is client-only (dynamic, ssr:false).
export const metadata: Metadata = {
  title: "Cleveland Neighborhoods — A century of Cleveland, mapped to the corner",
  description:
    "An archival map of historic Cleveland Public Library photographs, browsable by place and time.",
};

export default function Home() {
  return <PatronLanding />;
}
