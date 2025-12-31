// app/api/fundamentals/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCorpCodeByTicker } from "@lib/corpMap";
import { buildFullReport } from "@lib/reportBuilder";

const DART_API = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";

// 에러 응답 헬퍼
function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { status: "error", message, ...(extra ?? {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ticker = String(url.searchParams.get("ticker") ?? "").trim();
    const bsns_year = String(url.searchParams.get("year") ?? "").trim();
    const reprt_code = String(url.searchParams.get("reprt") ?? "11011").trim(); // 기본: 사업보고서(연간)
    const fs_div = String(url.searchParams.get("fs_div") ?? "CFS").trim(); // 기본: 연결

    if (!ticker) return jsonError(400, "ticker is required");
    if (!bsns_year) return jsonError(400, "year is required");

    const corp_code = await getCorpCodeByTicker(ticker);
    if (!corp_code) return jsonError(404, `corp_code not found for ticker=${ticker}`);

    const apiKey = process.env.DART_API_KEY;
    if (!apiKey) return jsonError(500, "DART_API_KEY is not set");

    const params = new URLSearchParams({
      crtfc_key: apiKey,
      corp_code,
      bsns_year,
      reprt_code,
      fs_div,
    });

    const res = await fetch(`${DART_API}?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();

    // DART 실패
    if (!data || data.status !== "000") {
      return jsonError(502, "DART fetch failed", { dart: data });
    }

    const list = Array.isArray(data.list) ? data.list : [];

    // 여기서 리포트 텍스트를 만들고 싶다면 buildFullReport 사용
    // (기존 buildReport가 없으니 아래처럼 통일)
    const reportText = buildFullReport(
      { PER: "N/A", PBR: "N/A", ROE: "N/A", OPM: "N/A", FCF_Yield: "N/A", Score: 0 } as any,
      { alert: "Unknown" } as any,
      { price_signal: "N/A" } as any,
      {
        valuation_score: "N/A",
        risk_level: "Unknown",
        signal: "N/A",
      }
    );

    return NextResponse.json(
      {
        status: "ok",
        ticker,
        corp_code,
        query: { bsns_year, reprt_code, fs_div },
        rows: list.length,
        list,
        report_text: reportText,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    console.error("fundamentals route error:", e);
    return jsonError(500, "Internal Server Error", { detail: String(e?.message ?? e) });
  }
}
