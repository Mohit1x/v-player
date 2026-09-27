import { type NextRequest, NextResponse } from "next/server";
import { getPostStream } from "@/app/lib/pawchive/getPostStream";
import { encrypt } from "@/app/lib/crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; postId: string }> }
): Promise<NextResponse> {
  const { uid, postId } = await params;

  if (!uid || !/^\d+$/.test(uid)) return NextResponse.json({ e: 1 }, { status: 400 });
  if (!postId || !/^\d+$/.test(postId)) return NextResponse.json({ e: 1 }, { status: 400 });

  const patreonUserId = req.nextUrl.searchParams.get("u");
  const userIdForPawchive = (patreonUserId && /^\d+$/.test(patreonUserId)) ? patreonUserId : uid;

  try {
    const streamUrl = await getPostStream(userIdForPawchive, postId);
    if (!streamUrl) return NextResponse.json({ e: 1 }, { status: 404 });
    const token = await encrypt({ streamUrl });
    return NextResponse.json({ d: token });
  } catch {
    return NextResponse.json({ e: 1 }, { status: 502 });
  }
}
