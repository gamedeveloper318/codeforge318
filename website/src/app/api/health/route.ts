import { releaseManifest } from "@/lib/release";

/** Lightweight endpoint for deployment checks: GET /api/health */
export function GET() {
  return Response.json(
    { status: "ok", product: "CodeForge", latestVersion: releaseManifest.version },
    { headers: { "cache-control": "no-store" } },
  );
}
