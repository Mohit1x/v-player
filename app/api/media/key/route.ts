import { NextResponse } from "next/server";

const SECRET = process.env.RESPONSE_SECRET ?? "default-dev-secret-change-in-prod";

export async function GET(): Promise<NextResponse> {
  const raw = new TextEncoder().encode(SECRET.padEnd(32, "0").slice(0, 32));
  const b64 = btoa(String.fromCharCode(...raw));
  return NextResponse.json({ k: b64 });
}
