import type { PatreonCreator } from "./types";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Encoding": "identity",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCampaign(data: any): PatreonCreator | null {
  const id: string = String(data?.id ?? "");
  if (!id) return null;

  const attrs = data?.attributes ?? {};
  const name: string = attrs?.name ?? attrs?.creation_name ?? "";
  if (!name) return null;

  const avatar: string | undefined =
    attrs?.avatar_photo_url ??
    attrs?.avatar_photo_image_urls?.thumbnail ??
    attrs?.image_small_url ??
    undefined;

  const url: string | undefined = attrs?.url ?? undefined;

  return { id, name, avatar, url };
}

async function fetchCampaign(campaignId: string): Promise<PatreonCreator | null> {
  try {
    const res = await fetch(`https://www.patreon.com/api/campaigns/${campaignId}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return normalizeCampaign(json?.data);
  } catch {
    return null;
  }
}

export async function searchCreators(query: string): Promise<PatreonCreator[]> {
  const searchUrl = new URL("https://www.patreon.com/api/search_feed/v1/campaign");
  searchUrl.searchParams.set("filter[query]", query);

  const res = await fetch(searchUrl.href, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Patreon search returned ${res.status}`);
  }

  const json = await res.json();
  const items: unknown[] = Array.isArray(json?.data) ? json.data : [];

  // IDs come as "campaign-3523273" — strip the prefix
  const campaignIds: string[] = items
    .map((item: unknown) => {
      const raw = String((item as Record<string, unknown>)?.id ?? "");
      return raw.startsWith("campaign-") ? raw.slice("campaign-".length) : raw;
    })
    .filter(Boolean);

  if (campaignIds.length === 0) return [];

  // Fetch up to 10 campaigns in parallel to keep response time reasonable
  const results = await Promise.all(campaignIds.slice(0, 10).map(fetchCampaign));
  return results.filter((c): c is PatreonCreator => c !== null);
}
