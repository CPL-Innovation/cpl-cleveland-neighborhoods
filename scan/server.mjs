#!/usr/bin/env node
// Write-back server — the project's first server, needed only for scan review.
//
// In a no-DB static site the spec's durable `scan_review` table needs somewhere to
// write. This tiny node:http server serves the existing static app (so the React
// surfaces load exactly as under python -m http.server) AND persists review verdicts
// via read-modify-write to data/scan/scan_review.json. No dependencies.
//
//   GET  /api/scan/records            → all records (array)
//   GET  /api/scan/records/:chc_id    → one record
//   POST /api/scan/records/:chc_id    → merge a review patch (or {accept:true}) → save
//   GET  /api/scan/accuracy[?format=csv]
//   POST /api/scan/retry/:chc_id      → re-run the pipeline for one photo
//   (everything else) → static file from the repo root, incl. /derivatives/*.jpg

import "./env.mjs"; // load .env so the retry endpoint's spawned run.mjs inherits GEMINI_API_KEY
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, join, normalize } from "node:path";
import { spawn } from "node:child_process";
import { loadStore, saveStore, upsert, REPO_ROOT } from "./store.mjs";
import { computeAccuracy, toCSV } from "./accuracy.mjs";

const PORT = Number(process.env.PORT) || 8000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve_, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve_(data));
    req.on("error", reject);
  });
}

// Build the photo_enrichment-shaped fields from confirmed review values (PoC: stored
// on the record; the real merge into a photo_enrichment store is a future hook).
function buildEnrichment(rec) {
  const r = rec.review || {};
  const confirmedAddress =
    r.address?.verdict === "correct" ? rec.vlm?.address
    : r.address?.verdict === "edited" ? r.address.value
    : ""; // flag → unconfirmed
  const confirmedYear =
    r.year?.verdict === "correct" ? rec.vlm?.year
    : r.year?.verdict === "edited" ? r.year.value
    : "";
  const desc =
    r.description?.verdict === "edited" ? r.description.value
    : r.description?.verdict === "accepted" ? rec.vlm?.description
    : "";
  const yr = /\d{4}/.exec(confirmedYear || "")?.[0] || null;
  return {
    patron_caption: desc || null,
    accessibility_alt_text: desc || null,
    date_start: yr,
    date_end: yr,
    date_precision: yr ? "year" : null,
    address: confirmedAddress || null, // NO geocoding in this pilot — clean string only
    lat: null,
    lng: null,
    neighborhood_tag: null,
    caption_quality: "auto_only",
    public_status: "draft",
    record_key: rec.chc_id, // box-scans have no contentdm_id
    // hook: graduating to a real photo_enrichment row happens downstream.
  };
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api","scan",...]
  const section = parts[2];

  if (section === "records") {
    const chcId = parts[3] ? decodeURIComponent(parts[3]) : null;
    const store = await loadStore();

    if (req.method === "GET") {
      if (chcId) {
        return store[chcId] ? sendJSON(res, 200, store[chcId]) : sendJSON(res, 404, { error: "not found" });
      }
      return sendJSON(res, 200, Object.values(store));
    }

    if (req.method === "POST" && chcId) {
      let patch;
      try {
        patch = JSON.parse((await readBody(req)) || "{}");
      } catch {
        return sendJSON(res, 400, { error: "invalid JSON" });
      }
      if (!store[chcId]) return sendJSON(res, 404, { error: "unknown chc_id" });

      const { accept, ...rest } = patch;
      const updated = upsert(store, chcId, rest); // merges review etc.
      if (accept) updated.enrichment = buildEnrichment(updated);
      await saveStore(store);
      return sendJSON(res, 200, updated);
    }
    return sendJSON(res, 405, { error: "method not allowed" });
  }

  if (section === "accuracy" && req.method === "GET") {
    const store = await loadStore();
    if (url.searchParams.get("format") === "csv") {
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="accuracy.csv"',
      });
      return res.end(toCSV(store));
    }
    return sendJSON(res, 200, computeAccuracy(store));
  }

  if (section === "retry" && req.method === "POST") {
    const chcId = parts[3] ? decodeURIComponent(parts[3]) : null;
    if (!chcId) return sendJSON(res, 400, { error: "missing chc_id" });
    const child = spawn(process.execPath, [resolve(REPO_ROOT, "scan/run.mjs"), "--only", chcId], {
      cwd: REPO_ROOT,
      env: process.env,
    });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    child.on("close", async (code) => {
      const store = await loadStore();
      sendJSON(res, code === 0 ? 200 : 500, { code, record: store[chcId] || null, log: log.slice(-2000) });
    });
    return;
  }

  return sendJSON(res, 404, { error: "no such endpoint" });
}

async function serveStatic(req, res, url) {
  // Resolve within the repo root; reject traversal.
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html"; // patron site is the homepage; staff app is /enrichment-app.html
  const abs = normalize(join(REPO_ROOT, rel));
  if (!abs.startsWith(REPO_ROOT)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  try {
    const info = await stat(abs);
    if (info.isDirectory()) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    const buf = await readFile(abs);
    const type = MIME[extname(abs).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Scan review server → http://localhost:${PORT}/enrichment-app.html`);
  console.log(`(serves the static app + persists review verdicts to data/scan/scan_review.json)`);
});
