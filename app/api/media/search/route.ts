import { type NextRequest, NextResponse } from "next/server";
import { searchCreators } from "@/app/lib/patreon/searchCreators";
import { encrypt } from "@/app/lib/crypto";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ e: 1 }, { status: 400 });

  try {
    const creators = await searchCreators(q);
    const token = await encrypt({ creators });
    return NextResponse.json({ d: token });
  } catch {
    return NextResponse.json({ e: 1 }, { status: 502 });
  }
}
