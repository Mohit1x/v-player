import { type NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/app/lib/crypto";

const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Encoding": "identity",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
): Promise<NextResponse> {
  const { uid } = await params;
  if (!uid || !/^\d+$/.test(uid)) return NextResponse.json({ e: 1 }, { status: 400 });

  try {
    const res = await fetch(`https://www.patreon.com/api/campaigns/${uid}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const token = await encrypt({ creator: null });
      return NextResponse.json({ d: token });
    }
    const json = await res.json();
    const data = json?.data;
    const attrs = data?.attributes ?? {};
    const token = await encrypt({
      creator: {
        id: String(data?.id ?? uid),
        patreonUserId: String(data?.relationships?.creator?.data?.id ?? "") || null,
        name: attrs?.name ?? attrs?.creation_name ?? null,
        avatar: attrs?.avatar_photo_url ?? attrs?.avatar_photo_image_urls?.thumbnail ?? null,
        url: attrs?.url ?? null,
      },
    });
    return NextResponse.json({ d: token });
  } catch {
    const token = await encrypt({ creator: null });
    return NextResponse.json({ d: token });
  }
}
