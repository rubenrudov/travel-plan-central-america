import { NextRequest, NextResponse } from "next/server";
import { readState, writeState } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(readState(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function PUT(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      return NextResponse.json({ error: "Origin rejected" }, { status: 403 });
    const data = await req.json();
    return NextResponse.json(writeState(data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid data";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("Conflict") ? 409 : 400 },
    );
  }
}
