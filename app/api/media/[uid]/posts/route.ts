import { type NextRequest, NextResponse } from "next/server";
import { getCreatorPosts } from "@/app/lib/patreon/getCreatorPosts";
import { encrypt } from "@/app/lib/crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
): Promise<NextResponse> {
  const { uid } = await params;
  if (!uid || !/^\d+$/.test(uid)) return NextResponse.json({ e: 1 }, { status: 400 });

  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  try {
    const { posts, nextCursor } = await getCreatorPosts(uid, cursor);
    const token = await encrypt({ posts, nextCursor });
    return NextResponse.json({ d: token });
  } catch {
    return NextResponse.json({ e: 1 }, { status: 502 });
  }
}
