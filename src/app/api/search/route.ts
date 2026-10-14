import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { searchItems, searchVenues } from "@/lib/wolt";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const q = typeof body.q === "string" ? body.q.trim() : "";
  const target = body.target;
  if (!q || (target !== "venues" && target !== "items")) {
    return NextResponse.json(
      { error: 'body must be { q: string, target: "venues" | "items" }' },
      { status: 400 },
    );
  }
  try {
    const results =
      target === "venues"
        ? await searchVenues(q)
        : await searchItems(q);
    return NextResponse.json(results);
  } catch (err) {
    return errorResponse(err);
  }
}
