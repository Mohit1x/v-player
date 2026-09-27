import { type NextRequest, NextResponse } from "next/server";
import {
  validateUpstreamUrl,
  isHlsContentType,
  isHlsUrl,
  rewritePlaylist,
} from "@/app/lib/hlsProxy";

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "cache-control",
  "expires",
  "last-modified",
  "etag",
  "accept-ranges",
];

const UPSTREAM_REQUEST_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (compatible; MediaProxy/1.0)",
  Accept: "*/*",
  "Accept-Encoding": "identity",
};

const FORWARD_REQUEST_HEADERS = ["range", "if-range"];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rawUrl = req.nextUrl.searchParams.get("u");
  if (!rawUrl) {
    return errorResponse(400, "Bad request.");
  }

  const validation = validateUpstreamUrl(rawUrl);
  if (!validation.ok) {
    return errorResponse(validation.status, "Bad request.");
  }

  const upstreamUrl = validation.url.href;

  const upstreamReqHeaders: Record<string, string> = { ...UPSTREAM_REQUEST_HEADERS };
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(h);
    if (v) upstreamReqHeaders[h] = v;
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      headers: upstreamReqHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Never log or expose the upstream URL
    return errorResponse(502, "Unable to load media.");
  }

  // Handle redirects — re-validate destination
  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    const location = upstreamRes.headers.get("location");
    if (!location) return errorResponse(502, "Unable to load media.");
    const redirectValidation = validateUpstreamUrl(
      new URL(location, upstreamUrl).href
    );
    if (!redirectValidation.ok) return errorResponse(403, "Unable to load media.");
    try {
      upstreamRes = await fetch(redirectValidation.url.href, {
        headers: upstreamReqHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return errorResponse(502, "Unable to load media.");
    }
  }

  if (!upstreamRes.ok && upstreamRes.status !== 206) {
    const s = upstreamRes.status;
    if (s === 403 || s === 401) return errorResponse(403, "Access denied.");
    if (s === 404) return errorResponse(404, "Media not found.");
    if (s === 410) return errorResponse(410, "Media no longer available.");
    return errorResponse(502, "Unable to load media.");
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");

  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstreamRes.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const contentRange = upstreamRes.headers.get("content-range");
  if (contentRange) responseHeaders.set("content-range", contentRange);
  responseHeaders.set("accept-ranges", "bytes");

  const contentType = upstreamRes.headers.get("content-type");
  const looksLikePlaylist = isHlsContentType(contentType) || isHlsUrl(upstreamUrl);

  if (looksLikePlaylist) {
    let text: string;
    try {
      text = await upstreamRes.text();
    } catch {
      return errorResponse(502, "Unable to load media.");
    }

    if (!text.trimStart().startsWith("#EXTM3U")) {
      return new NextResponse(text, { status: 200, headers: responseHeaders });
    }

    const rewritten = rewritePlaylist(text, upstreamUrl);
    responseHeaders.set("content-type", "application/vnd.apple.mpegurl");
    responseHeaders.delete("content-length");
    responseHeaders.set("cache-control", "no-cache");

    return new NextResponse(rewritten, { status: 200, headers: responseHeaders });
  }

  if (!upstreamRes.body) {
    return errorResponse(502, "Unable to load media.");
  }

  return new NextResponse(upstreamRes.body, { status: upstreamRes.status, headers: responseHeaders });
}

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
