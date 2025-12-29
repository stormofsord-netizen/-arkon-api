import { NextResponse } from "next/server";

const DART_API_KEY = process.env.DART_API_KEY!;
const DART_URL = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";

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

    const corpCode = ticker; // ⚠️ 임시: 다음 단계에서 corp_code 매핑으로 교체

    const url =
      `${DART_URL}?crtfc_key=${DART_API_KEY}` +
      `&corp_code=${corpCode}` +
      `&bsns_year=2023&reprt_code=11011&fs_div=CFS`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    return NextResponse.json({
      status: "ok",
      ticker,
      source: "dart",
      data,
    });
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", message: e.message },
      { status: 500 }
    );
  }
}