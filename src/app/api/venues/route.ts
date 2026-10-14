import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getVenues } from "@/lib/wolt";

/** Venues delivering to central Bucharest. */
export async function GET() {
  try {
    return NextResponse.json(await getVenues());
  } catch (err) {
    return errorResponse(err);
  }
}
