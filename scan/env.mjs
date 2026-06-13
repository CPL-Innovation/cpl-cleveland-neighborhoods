// Minimal .env loader (no dependency). Reads <repo>/.env.local then <repo>/.env and
// populates process.env for any key not already set. Import this first in any CLI
// entrypoint or config that needs GEMINI_API_KEY / DATABASE_URL / SUPABASE_* — the
// Next.js app loads .env.local itself, this is for the scan CLI + drizzle-kit.
//
// .env / .env.local are gitignored — secrets never enter version control.

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

// .env.local wins over .env (loaded first; loadFile only sets unset keys).
loadFile(resolve(REPO_ROOT, ".env.local"));
loadFile(resolve(REPO_ROOT, ".env"));
