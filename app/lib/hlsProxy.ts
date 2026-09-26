/**
 * HLS proxy core library.
 *
 * Responsibilities:
 *  - Validate upstream URLs (protocol + SSRF guard)
 *  - Detect HLS playlist responses
 *  - Rewrite HLS playlist URIs so every subsequent request routes through /api/hls
 */

// ── SSRF guard ────────────────────────────────────────────────────────────────

/** IPv4 CIDR ranges that must never be proxied. */
const BLOCKED_IPV4_RANGES: [number, number, number][] = [
  // loopback
  [0x7f000000, 0xff000000, 8],
  // link-local
  [0xa9fe0000, 0xffff0000, 16],
  // private 10.x
  [0x0a000000, 0xff000000, 8],
  // private 172.16–31
  [0xac100000, 0xfff00000, 12],
  // private 192.168
  [0xc0a80000, 0xffff0000, 16],
  // multicast
  [0xe0000000, 0xf0000000, 4],
  // broadcast / reserved
  [0xf0000000, 0xf0000000, 4],
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const byte = parseInt(p, 10);
    if (isNaN(byte) || byte < 0 || byte > 255) return null;
    n = (n << 8) | byte;
  }
  return n >>> 0;
}

function isBlockedIPv4(hostname: string): boolean {
  const n = ipv4ToInt(hostname);
  if (n === null) return false;
  return BLOCKED_IPV4_RANGES.some(([base, mask]) => (n & mask) === base);
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // localhost variants
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  // IPv6 loopback
  if (h === "[::1]" || h === "::1") return true;
  // IPv4 private/loopback
  if (isBlockedIPv4(h)) return true;
  // metadata endpoints (cloud providers)
  if (h === "169.254.169.254") return true;
  if (h === "metadata.google.internal") return true;
  return false;
}

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; status: number; message: string };

export function validateUpstreamUrl(raw: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, status: 400, message: "Invalid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, status: 400, message: "Only http and https URLs are supported." };
  }

  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, status: 403, message: "Upstream host is not permitted." };
  }

  return { ok: true, url: parsed };
}

// ── HLS detection ─────────────────────────────────────────────────────────────

const HLS_CONTENT_TYPES = new Set([
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "audio/mpegurl",
  "audio/x-mpegurl",
]);

export function isHlsContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const base = contentType.split(";")[0].trim().toLowerCase();
  return HLS_CONTENT_TYPES.has(base);
}

export function isHlsUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return pathname.toLowerCase().includes(".m3u8");
  } catch {
    return false;
  }
}

// ── Proxy URL builder ─────────────────────────────────────────────────────────

/**
 * Build a /api/hls?url=<encoded> proxy URL for a given absolute upstream URL.
 * The full URL (including query string) is preserved via encodeURIComponent.
 */
export function buildProxyUrl(absoluteUpstreamUrl: string): string {
  return `/api/hls?url=${encodeURIComponent(absoluteUpstreamUrl)}`;
}

// ── HLS playlist rewriter ─────────────────────────────────────────────────────

/**
 * Tags whose URI attribute must be rewritten.
 * Covers the full HLS spec set of URI-bearing tags.
 */
const URI_ATTRIBUTE_TAGS = [
  "EXT-X-MAP",
  "EXT-X-KEY",
  "EXT-X-SESSION-KEY",
  "EXT-X-MEDIA",
  "EXT-X-I-FRAME-STREAM-INF",
  "EXT-X-IMAGE-STREAM-INF",
  "EXT-X-PRELOAD-HINT",
  "EXT-X-RENDITION-REPORT",
  "EXT-X-PART",
  "EXT-X-DATERANGE",
];

/**
 * Resolve a URI found inside a playlist against the playlist's own URL,
 * then wrap it in the proxy path.
 */
function rewriteUri(uri: string, playlistUrl: string): string {
  // Already a data: or blob: URI — leave alone
  if (uri.startsWith("data:") || uri.startsWith("blob:")) return uri;
  try {
    const absolute = new URL(uri, playlistUrl).href;
    return buildProxyUrl(absolute);
  } catch {
    return uri;
  }
}

/**
 * Rewrite all media URIs inside an HLS playlist text so they route through
 * the /api/hls proxy.  Only touches valid HLS URI references; all other
 * content (comments, metadata, numeric values) is left byte-for-byte intact.
 *
 * @param text        Raw playlist text from the upstream server
 * @param playlistUrl Absolute URL of the playlist itself (used to resolve relative URIs)
 */
export function rewritePlaylist(text: string, playlistUrl: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let nextLineIsUri = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // Preserve original line ending (some servers use \r\n)
    const line = raw.trimEnd();
    const cr = raw.endsWith("\r") ? "\r" : "";

    if (nextLineIsUri) {
      // This line is a bare URI (segment, variant playlist, etc.)
      nextLineIsUri = false;
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        // Empty or unexpected tag — pass through and re-evaluate
        out.push(raw);
        if (trimmed.startsWith("#EXT-X-STREAM-INF") ||
            trimmed.startsWith("#EXT-X-I-FRAME-STREAM-INF") ||
            trimmed.startsWith("#EXTINF") ||
            trimmed.startsWith("#EXT-X-PART:")) {
          nextLineIsUri = true;
        }
        continue;
      }
      out.push(rewriteUri(trimmed, playlistUrl) + cr);
      continue;
    }

    if (!line.startsWith("#")) {
      // Non-tag, non-empty line that wasn't flagged — treat as a bare URI
      // (handles playlists that omit EXTINF for some segments)
      const trimmed = line.trim();
      if (trimmed !== "") {
        out.push(rewriteUri(trimmed, playlistUrl) + cr);
        continue;
      }
      out.push(raw);
      continue;
    }

    // ── Tag line ──────────────────────────────────────────────────────────────

    // Tags whose next non-empty line is a URI
    if (
      line.startsWith("#EXT-X-STREAM-INF:") ||
      line.startsWith("#EXTINF:") ||
      line.startsWith("#EXT-X-DISCONTINUITY") && false // not a URI tag
    ) {
      out.push(raw);
      nextLineIsUri = true;
      continue;
    }

    // EXT-X-I-FRAME-STREAM-INF has URI inline as attribute, not on next line
    // (handled below in URI_ATTRIBUTE_TAGS)

    // Tags with URI="..." attribute
    const tagName = line.slice(1).split(":")[0];
    if (URI_ATTRIBUTE_TAGS.includes(tagName)) {
      // Rewrite URI="..." attribute value in place
      const rewritten = line.replace(
        /URI="([^"]*)"/g,
        (_, uri: string) => `URI="${rewriteUri(uri, playlistUrl)}"`
      );
      out.push(rewritten + cr);
      continue;
    }

    // All other tags — pass through unchanged
    out.push(raw);
  }

  return out.join("\n");
}
