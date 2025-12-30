import { NextResponse } from "next/server";
import { findTickerByName } from "@/app/lib/corpMap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) return NextResponse.json({ status: "error", message: "Query required" });

  try {
    const result = await findTickerByName(query);
    if (result) {
      return NextResponse.json({ status: "ok", ...result });
    } else {
      return NextResponse.json({ status: "not_found", message: "No match" });
    }
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e) });
  }
}