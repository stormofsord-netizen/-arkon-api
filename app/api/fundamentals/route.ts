// app/api/fundamentals/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { status: "error", message: "ticker is required" },
      { status: 400 }
    );
  }

  const BASE = process.env.ARKON_UPSTREAM_URL;
  if (!BASE) {
    return NextResponse.json(
      { status: "error", message: "ARKON_UPSTREAM_URL not set" },
      { status: 500 }
    );
  }

  const url = `${BASE}/api/fundamentals?ticker=${ticker}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", message: e?.message || "fetch failed" },
      { status: 500 }
    );
  }
}