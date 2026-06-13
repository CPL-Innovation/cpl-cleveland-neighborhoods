import { redirect } from "next/navigation";

// The patron site (Leaflet map/landing) migration is a later pass. For now the Next app's
// home routes to the staff enrichment surface.
export default function Home() {
  redirect("/staff");
}
