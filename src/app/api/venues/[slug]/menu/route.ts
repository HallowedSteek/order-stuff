import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getMenu } from "@/lib/wolt";

export async function GET(_: Request, ctx: RouteContext<"/api/venues/[slug]/menu">) {
  const { slug } = await ctx.params;
  try {
    return NextResponse.json(await getMenu(slug));
  } catch (err) {
    return errorResponse(err);
  }
}
