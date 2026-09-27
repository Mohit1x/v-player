import type { PatreonPost } from "./types";

const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePost(item: any): PatreonPost | null {
  const attrs = item?.attributes ?? item;
  const id: string = String(item?.id ?? attrs?.id ?? "");
  if (!id) return null;

  const title: string = attrs?.title ?? attrs?.name ?? "(Untitled)";

  const thumbnail: string | undefined =
    attrs?.image?.thumb_url ??
    attrs?.image?.url ??
    attrs?.thumbnail_url ??
    undefined;

  const publishedAt: string | undefined =
    attrs?.published_at ?? attrs?.created_at ?? undefined;

  const minCents: number = attrs?.min_cents_pledged_to_view ?? 0;
  const isPaid: boolean = minCents > 0 || attrs?.is_paid === true;

  const url: string | undefined = attrs?.url ?? attrs?.patreon_url ?? undefined;

  return { id, title, thumbnail, publishedAt, isPaid, url };
}

export async function getCreatorPosts(
  userId: string,
  cursor?: string
): Promise<{ posts: PatreonPost[]; nextCursor: string | null }> {
  const url = new URL("https://www.patreon.com/api/posts");
  url.searchParams.set("filter[campaign_id]", userId);
  url.searchParams.set("sort", "-published_at");
  url.searchParams.set("page[count]", "12");
  url.searchParams.set(
    "fields[post]",
    "title,image,thumbnail_url,published_at,min_cents_pledged_to_view,url,is_paid"
  );
  if (cursor) url.searchParams.set("page[cursor]", cursor);

  const res = await fetch(url.href, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Patreon posts returned ${res.status}`);

  const json = await res.json();
  const items: unknown[] = json?.data ?? [];

  // Extract next cursor from meta.pagination.cursors.next
  const nextCursor: string | null = json?.meta?.pagination?.cursors?.next ?? null;

  const posts = items
    .map(normalizePost)
    .filter((p): p is PatreonPost => p !== null);

  return { posts, nextCursor };
}
