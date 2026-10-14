import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { refreshToken } from "@/lib/wolt";

// The doc only covers refreshing; you need a refresh token from an existing
// Wolt web session to begin with.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { refresh_token?: unknown };
  if (typeof body.refresh_token !== "string" || !body.refresh_token) {
    return NextResponse.json({ error: "refresh_token is required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await refreshToken(body.refresh_token));
  } catch (err) {
    return errorResponse(err);
  }
}
