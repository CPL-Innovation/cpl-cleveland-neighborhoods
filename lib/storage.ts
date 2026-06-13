// Derivative JPEG store. Two backends, chosen at runtime:
//
//   • local  — writes JPEGs under public/derivatives/ and serves them at /derivatives/<chc>.jpg.
//              The default in dev: no Supabase project needed. Files are gitignored.
//   • supabase — uploads to a public Supabase Storage bucket (the deployed path).
//
// Backend selection: `STORAGE_BACKEND=local|supabase` if set, else auto — Supabase when
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present, otherwise local disk.
//
// Server-side only (the Supabase path uses the service-role key). Both `uploadDerivative`
// (local CLI) and `fetchDerivativeBytes` (serverless retry) work against either backend.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const BUCKET = process.env.SUPABASE_DERIVATIVES_BUCKET || "derivatives";

function useSupabase(): boolean {
  const backend = process.env.STORAGE_BACKEND;
  if (backend === "supabase") return true;
  if (backend === "local") return false;
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── local disk backend ──────────────────────────────────────────────────────
// public/ is served by Next at the web root, so a file at public/derivatives/x.jpg
// is reachable at /derivatives/x.jpg. We store that relative URL in the DB; the
// review UI's <img> resolves it against the page origin, and fetchDerivativeBytes
// reads it back off disk (a server-side fetch of a relative URL would have no host).
const PUBLIC_DIR = resolve(process.cwd(), "public");
const LOCAL_DERIV_DIR = join(PUBLIC_DIR, "derivatives");

async function uploadLocal(chcId: string, jpeg: Buffer | Uint8Array): Promise<string> {
  await mkdir(LOCAL_DERIV_DIR, { recursive: true });
  await writeFile(join(LOCAL_DERIV_DIR, `${chcId}.jpg`), jpeg);
  return `/derivatives/${chcId}.jpg`;
}

// ── supabase storage backend ────────────────────────────────────────────────
let _client: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. See .env.local.example."
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

async function ensureBucket(): Promise<void> {
  const sb = admin();
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    await sb.storage.createBucket(BUCKET, { public: true });
  }
}

async function uploadSupabase(chcId: string, jpeg: Buffer | Uint8Array): Promise<string> {
  const sb = admin();
  await ensureBucket();
  const path = `${chcId}.jpg`;
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ── public API ──────────────────────────────────────────────────────────────

/** Upload a derived JPEG (idempotent) and return its URL (relative for local, public for Supabase). */
export async function uploadDerivative(chcId: string, jpeg: Buffer | Uint8Array): Promise<string> {
  return useSupabase() ? uploadSupabase(chcId, jpeg) : uploadLocal(chcId, jpeg);
}

/** Fetch a stored derivative's bytes (used by the retry path for a server-side VLM re-run). */
export async function fetchDerivativeBytes(jpegUrl: string): Promise<Buffer> {
  // Absolute URL → HTTP fetch (Supabase public URL). Relative path → read off disk
  // (the local backend stores "/derivatives/x.jpg", which has no host to fetch from).
  if (/^https?:\/\//.test(jpegUrl)) {
    const res = await fetch(jpegUrl);
    if (!res.ok) throw new Error(`could not fetch derivative (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const path = join(PUBLIC_DIR, jpegUrl.replace(/^\//, ""));
  return readFile(path);
}
