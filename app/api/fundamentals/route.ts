import { NextResponse } from "next/server";

const DART_API_KEY = process.env.DART_API_KEY;

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

    if (!DART_API_KEY) {
      return NextResponse.json(
        { status: "error", message: "DART_API_KEY missing" },
        { status: 500 }
      );
    }

    // ⚠️ 예제: 삼성전자 corp_code (고정)
    // 다음 단계에서 자동 매핑으로 바꾼다
    const corpCode = "00126380";

    const url =
      "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json" +
      `?crtfc_key=${DART_API_KEY}` +
      `&corp_code=${corpCode}` +
      `&bsns_year=2023` +
      `&reprt_code=11011`;

    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json(
        { status: "error", message: "DART fetch failed" },
        { status: 502 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      status: "ok",
      ticker,
      source: "dart",
      data,
      stage: "step-3-dart-connected",
    });
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", message: e.message },
      { status: 500 }
    );
  }
}