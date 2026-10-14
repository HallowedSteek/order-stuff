import { NextResponse } from "next/server";
import { NotLoggedInError } from "./session";
import { WoltError } from "./wolt";

export function errorResponse(err: unknown) {
  if (err instanceof NotLoggedInError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof WoltError) {
    return NextResponse.json({ error: err.message, upstream: err.body }, { status: 502 });
  }
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status: 500 });
}
