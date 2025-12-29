import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json(
        { status: "error", message: "ticker required" },
        { status: 400 }
      );
    }

    // 🔹 STEP-2: 실제 로직은 여기부터 확장
    // 지금은 테스트용
    return NextResponse.json({
      status: "ok",
      ticker,
      stage: "step-2-ready",
      note: "real fundamentals logic will be attached here",
    });

  } catch (e: any) {
    return NextResponse.json(
      { status: "error", message: e.message },
      { status: 500 }
    );
  }
}