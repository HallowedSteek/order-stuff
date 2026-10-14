import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, parseCoords } from "@/lib/api";
import { getVenues } from "@/lib/wolt";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const coords = parseCoords(sp.get("lat"), sp.get("lon"));
  if (!coords) {
    return NextResponse.json({ error: "lat and lon query params are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getVenues(coords.lat, coords.lon));
  } catch (err) {
    return errorResponse(err);
  }
}
