// Keep the staff side local.
//
// Auth is deferred (see CLAUDE.md), and the "local-only" scan/staff routes only refuse on
// VERCEL — so a dev server shared through a tunnel (cloudflared, ngrok) would hand anyone with
// the link the staff app and every write: un-ingest, geo/then-and-now writes, Prep subprocesses,
// paid VLM retries. This lets the patron site through and answers everything staff-side with a
// plain 404 unless the request is from this machine.
//
// "From this machine": the Host is localhost, there's no tunnel header, and every address in
// X-Forwarded-For is loopback. Next's own dev server adds X-Forwarded-For (127.0.0.1) to local
// requests, so its mere presence proves nothing — a tunnel's tell is a non-loopback address,
// Cloudflare's CF-Connecting-IP, or a public Host.
import { NextResponse, type NextRequest } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;

function fromThisMachine(req: NextRequest): boolean {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").replace(/:\d+$/, "");
  if (!LOCAL_HOSTS.has(host)) return false;
  if (req.headers.has("cf-connecting-ip") || req.headers.has("ngrok-trace-id")) return false;
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return xff.every((ip) => LOOPBACK.test(ip));
}

export function middleware(req: NextRequest) {
  if (fromThisMachine(req)) return NextResponse.next();
  return new NextResponse("Not found", { status: 404 });
}

// Must be a literal — Next reads it statically, and anything computed is ignored (it then
// matches EVERY route, the patron site included).
export const config = {
  matcher: ["/staff", "/staff/:path*", "/api/scan/:path*", "/api/staff/:path*"],
};
