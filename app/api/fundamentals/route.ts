// app/api/fundamentals/route.ts
import { NextResponse } from "next/server";
import { getCorpCodeByTicker } from "@/app/lib/corpMap";

function jsonError(status: number, message: string, extra?: Record<string, any>) {
  return NextResponse.json(
    { status: "error", message, ...(extra ?? {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const ticker = (url.searchParams.get("ticker") || "").trim();
    if (!ticker) return jsonError(400, "ticker(query)가 필요합니다.");

    const bsns_year = (url.searchParams.get("bsns_year") || "2024").trim();
    const reprt_code = (url.searchParams.get("reprt_code") || "11011").trim();
    const fs_div = (url.searchParams.get("fs_div") || "CFS").trim();

    const apiKey =
      process.env.DART_API_KEY ||
      process.env.DART_APIKEY ||
      process.env.DART_CRTFC_KEY ||
      "";

    if (!apiKey) {
      return jsonError(500, "서버에 DART_API_KEY 환경변수가 없습니다.");
    }

    // ✅ 핵심: corp_code 자동 조회 (전 종목 대응)
    const corp_code = await getCorpCodeByTicker(ticker);
    if (!corp_code) {
      return jsonError(
        400,
        `corp_code not found for ticker=${ticker} (DART corpCode.xml 기준)`,
        { ticker }
      );
    }

    const dartUrl = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";
    const params = new URLSearchParams({
      crtfc_key: apiKey,
      corp_code,
      bsns_year,
      reprt_code,
      fs_div,
    });

    const res = await fetch(`${dartUrl}?${params.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return jsonError(500, `DART 호출 실패: HTTP ${res.status}`, {
        ticker,
        corp_code,
      });
    }

    const data = await res.json();

    // DART가 자체적으로 status/message를 주는 케이스(예: 013 등)도 그대로 전달
    return NextResponse.json(
      {
        status: "ok",
        message: "ok",
        ticker,
        corp_code,
        source: "dart",
        data,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    return jsonError(500, e?.message || "unknown error");
  }
}