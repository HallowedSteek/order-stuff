import { NextResponse } from "next/server";
import { errorResponse, parseCoords } from "@/lib/api";
import { searchItems, searchVenues } from "@/lib/wolt";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const q = typeof body.q === "string" ? body.q.trim() : "";
  const target = body.target;
  const coords = parseCoords(body.lat, body.lon);
  if (!q || !coords || (target !== "venues" && target !== "items")) {
    return NextResponse.json(
      { error: 'body must be { q: string, target: "venues" | "items", lat: number, lon: number }' },
      { status: 400 },
    );
  }
  try {
    const results =
      target === "venues"
        ? await searchVenues(q, coords.lat, coords.lon)
        : await searchItems(q, coords.lat, coords.lon);
    return NextResponse.json(results);
  } catch (err) {
    return errorResponse(err);
  }
}
