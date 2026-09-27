const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

export async function getPostStream(userId: string, postId: string): Promise<string | null> {
  const url = `https://pawchive.pw/patreon/user/${userId}/post/${postId}`;

  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) return null;

  const html = await res.text();

  // If Pawchive redirected to the creator list, post isn't archived
  if (!html.includes("post__videos")) return null;

  // HLS stream
  const hlsMatch = html.match(/src="(https:\/\/t\d+\.pawchive\.pw\/v\/[^"]+\.m3u8[^"]*)"/);
  if (hlsMatch) return hlsMatch[1].replace(/&amp;/g, "&");

  // Direct MP4 (file.pawchive.pw/data/...)
  const mp4Match = html.match(/src="(https:\/\/file\.pawchive\.pw\/data\/[^"]+\.mp4[^"]*)"/);
  if (mp4Match) return mp4Match[1].replace(/&amp;/g, "&");

  return null;
}
