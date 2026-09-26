import { type NextRequest, NextResponse } from "next/server";
import {
  validateUpstreamUrl,
  isHlsContentType,
  isHlsUrl,
  rewritePlaylist,
} from "@/app/lib/hlsProxy";

/** Headers we forward from the upstream response to the browser. */
const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "cache-control",
  "expires",
  "last-modified",
  "etag",
  "accept-ranges",
];

/** Headers we send upstream so the remote server sees a reasonable request. */
const UPSTREAM_REQUEST_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (compatible; HLSProxy/1.0)",
  Accept: "*/*",
  "Accept-Encoding": "identity", // avoid compressed responses we'd need to decompress
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Extract and validate the upstream URL ────────────────────────────────
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return errorResponse(400, "Missing url parameter.");
  }

  const validation = validateUpstreamUrl(rawUrl);
  if (!validation.ok) {
    return errorResponse(validation.status, validation.message);
  }

  const upstreamUrl = validation.url.href;

  // ── 2. Fetch from upstream ──────────────────────────────────────────────────
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      headers: UPSTREAM_REQUEST_HEADERS,
      // Do not follow redirects blindly — validate the redirect target too
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // Don't expose the full URL (may contain signed tokens)
    console.error("[hls-proxy] upstream fetch failed:", msg);
    return errorResponse(502, "Unable to reach the upstream server.");
  }

  // ── 3. Handle redirects (re-validate destination) ──────────────────────────
  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    const location = upstreamRes.headers.get("location");
    if (!location) return errorResponse(502, "Upstream redirect with no Location.");
    const redirectValidation = validateUpstreamUrl(
      new URL(location, upstreamUrl).href
    );
    if (!redirectValidation.ok) {
      return errorResponse(403, "Upstream redirect target is not permitted.");
    }
    // Re-fetch the redirect destination
    try {
      upstreamRes = await fetch(redirectValidation.url.href, {
        headers: UPSTREAM_REQUEST_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return errorResponse(502, "Unable to reach the redirected upstream server.");
    }
  }

  // ── 4. Propagate upstream errors ────────────────────────────────────────────
  if (!upstreamRes.ok) {
    const status = upstreamRes.status;
    if (status === 403) return errorResponse(403, "Upstream server denied access (403).");
    if (status === 404) return errorResponse(404, "Upstream resource not found (404).");
    if (status === 410) return errorResponse(410, "Upstream resource is gone (410).");
    return errorResponse(status, `Upstream server returned ${status}.`);
  }

  // ── 5. Build response headers ───────────────────────────────────────────────
  const responseHeaders = new Headers();
  // Always allow the browser to read this response
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");

  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstreamRes.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // ── 6. Decide: playlist (rewrite) or segment (stream) ──────────────────────
  const contentType = upstreamRes.headers.get("content-type");
  const looksLikePlaylist = isHlsContentType(contentType) || isHlsUrl(upstreamUrl);

  if (looksLikePlaylist) {
    // Read the full playlist text (playlists are small — a few KB at most)
    let text: string;
    try {
      text = await upstreamRes.text();
    } catch {
      return errorResponse(502, "Failed to read upstream playlist.");
    }

    // Sanity-check: must start with #EXTM3U
    if (!text.trimStart().startsWith("#EXTM3U")) {
      // Not actually a playlist — stream it as-is
      return new NextResponse(text, {
        status: 200,
        headers: responseHeaders,
      });
    }

    const rewritten = rewritePlaylist(text, upstreamUrl);

    // Ensure correct content-type for HLS
    responseHeaders.set("content-type", "application/vnd.apple.mpegurl");
    // Remove content-length since rewriting changes the byte count
    responseHeaders.delete("content-length");
    // Playlists should not be cached aggressively
    responseHeaders.set("cache-control", "no-cache");

    return new NextResponse(rewritten, {
      status: 200,
      headers: responseHeaders,
    });
  }

  // ── 7. Stream binary segment ────────────────────────────────────────────────
  if (!upstreamRes.body) {
    return errorResponse(502, "Upstream returned an empty body.");
  }

  return new NextResponse(upstreamRes.body, {
    status: 200,
    headers: responseHeaders,
  });
}

/** Handle CORS preflight */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    },
  });
}

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
