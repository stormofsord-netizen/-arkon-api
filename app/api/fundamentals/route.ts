import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json(
        { status: "error", message: "ticker is required" },
        { status: 400 }
      );
    }

    // 1단계: 외부 API / DART / fetch 전부 금지
    // 무조건 JSON만 반환

    return NextResponse.json({
      status: "ok",
      ticker,
      service: "arkon-api",
      step: "step-1-json-only",
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        status: "error",
        message: e?.message ?? "unknown error",
      },
      { status: 500 }
    );
  }
}