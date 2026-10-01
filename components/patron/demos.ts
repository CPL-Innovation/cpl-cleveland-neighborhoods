// One-off demo: "this corner in 3D", for a single photograph — 3410 Sackett Avenue, 1929
// (ContentDM 8617, Clark-Fulton). Not a feature of the collection; a showcase of where the
// photo-detail panel could go. Keyed by ContentDM id so it survives however the Photo was built.
//
// The media are static files under public/, served as-is:
//   public/demos/3410-sackett/model.mp4   → the 3D model, presented as a turntable video
//   public/demos/3410-sackett/world.jpg   → a still from the walkable 3D world
// Either can be missing: the panel shows a hatched placeholder naming the file it expected,
// rather than an empty frame, so the demo degrades visibly and never silently.
import type { Photo } from "./data";

export interface Photo3DDemo {
  /** The street as it is named in the copy — "Sackett Avenue". */
  place: string;
  /** The year the reconstruction depicts (the photograph's year). */
  year: number;
  /** Turntable/fly-around video of the 3D model. */
  modelVideo: string;
  /** Still image standing in for the walkable world. */
  worldImage: string;
  /** Provenance line under the model — what made it, and what it is not. */
  credit: string;
  /** The live, interactive model on the tool that made it (opens in a new tab). */
  modelUrl: string;
  modelHost: string;
  /** The walkable world itself — the image here is only a still from it. */
  worldUrl: string;
  worldHost: string;
  worldCredit: string;
}

const DEMOS: Record<string, Photo3DDemo> = {
  "8617": {
    place: "Sackett Avenue",
    year: 1929,
    modelVideo: "/demos/3410-sackett/model.mp4",
    worldImage: "/demos/3410-sackett/world.jpg",
    credit: "Demonstration · 3D model made with Tripo AI — an interpretation of the photograph, not a measured survey",
    modelUrl: "https://studio.tripo3d.ai/3d-model/914a8425-defb-4eb9-a49e-447d6be8d006?invite_code=CFFO6L",
    modelHost: "Tripo",
    worldUrl: "https://marble.worldlabs.ai/worldvr/5ff83207-416e-4f17-a3fb-ab72c3e55928",
    worldHost: "Marble",
    worldCredit: "World made with World Labs Marble",
  },
};

export function demo3DFor(photo: Photo): Photo3DDemo | null {
  return photo.contentdm_id != null ? DEMOS[String(photo.contentdm_id)] ?? null : null;
}
