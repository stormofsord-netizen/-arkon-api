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

  return NextResponse.json({
    status: "ok",
    ticker,
    source: "arkon-api",
    message: "API route is working",
  });
}