import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getCities } from "@/lib/wolt";

export async function GET() {
  try {
    return NextResponse.json(await getCities());
  } catch (err) {
    return errorResponse(err);
  }
}
