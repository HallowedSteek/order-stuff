import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { BasketError, getSavedBaskets, saveBasket } from "@/lib/basket";
import type { BasketLine } from "@/lib/types";

function parseLines(v: unknown): BasketLine[] | null {
  if (!Array.isArray(v)) return null;
  const lines: BasketLine[] = [];
  for (const l of v as Record<string, unknown>[]) {
    if (typeof l?.itemId !== "string" || typeof l.count !== "number") return null;
    const options: Record<string, string[]> = {};
    for (const [k, vals] of Object.entries((l.options ?? {}) as Record<string, unknown>)) {
      if (!Array.isArray(vals) || !vals.every((x) => typeof x === "string")) return null;
      options[k] = vals;
    }
    lines.push({ itemId: l.itemId, count: l.count, options });
  }
  return lines;
}

/** Save the basket for one venue to the connected Wolt account. Never checks out. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { slug?: unknown; lines?: unknown };
  const lines = parseLines(body.lines);
  if (typeof body.slug !== "string" || !body.slug || !lines) {
    return NextResponse.json({ error: "body must be { slug: string, lines: BasketLine[] }" }, { status: 400 });
  }
  try {
    return NextResponse.json(await saveBasket(body.slug, lines));
  } catch (err) {
    if (err instanceof BasketError) return NextResponse.json({ error: err.message }, { status: 422 });
    return errorResponse(err);
  }
}

/** What Wolt has stored for the account (raw), to compare against what we sent. */
export async function GET() {
  try {
    return NextResponse.json(await getSavedBaskets());
  } catch (err) {
    return errorResponse(err);
  }
}
