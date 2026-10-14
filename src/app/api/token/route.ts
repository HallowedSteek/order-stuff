import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { connect, isConnected } from "@/lib/session";

export async function GET() {
  return NextResponse.json({ connected: await isConnected() });
}

/** Exchange a refresh token from wolt.com and keep the session server-side. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { refresh_token?: unknown };
  if (typeof body.refresh_token !== "string" || !body.refresh_token.trim()) {
    return NextResponse.json({ error: "refresh_token is required" }, { status: 400 });
  }
  try {
    await connect(body.refresh_token.trim());
    return NextResponse.json({ connected: true });
  } catch (err) {
    return errorResponse(err);
  }
}
