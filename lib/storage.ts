// Supabase Storage — holds the derived JPEGs (serverless has no persistent disk).
// The local CLI uploads here; the review UI <img> loads the public URL; retry fetches
// the bytes back for a re-run. Server-side only (uses the service-role key).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_DERIVATIVES_BUCKET || "derivatives";

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

/** Upload a derived JPEG (idempotent) and return its public URL. */
export async function uploadDerivative(chcId: string, jpeg: Buffer | Uint8Array): Promise<string> {
  const sb = admin();
  await ensureBucket();
  const path = `${chcId}.jpg`;
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Fetch a stored derivative's bytes (used by the retry path for a server-side VLM re-run). */
export async function fetchDerivativeBytes(jpegUrl: string): Promise<Buffer> {
  const res = await fetch(jpegUrl);
  if (!res.ok) throw new Error(`could not fetch derivative (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
