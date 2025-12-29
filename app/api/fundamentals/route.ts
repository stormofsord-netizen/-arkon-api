import { NextResponse } from "next/server";
import { getCorpCodeByTicker } from "@/app/lib/corpMap";

export const runtime = "nodejs"; // DART 호출은 node 런타임이 안전함

type DartError = { status?: string; message?: string };

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { status: "error", message, ...(extra ?? {}) },
    { status }
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const ticker = searchParams.get("ticker")?.trim();
    if (!ticker) return jsonError("ticker is required", 400);

    const DART_API_KEY = process.env.DART_API_KEY;
    if (!DART_API_KEY) return jsonError("DART_API_KEY is missing in environment variables", 500);

    // DART 재무제표 API 파라미터
    // - bsns_year: 사업연도 (예: 2024)
    // - reprt_code: 11011(사업보고서/연간), 11012(반기), 11013(1분기), 11014(3분기)
    // - fs_div: CFS(연결) / OFS(별도)
    const bsns_year = (searchParams.get("bsns_year") ?? "").trim() || String(new Date().getFullYear() - 1);
    const reprt_code = (searchParams.get("reprt_code") ?? "").trim() || "11011";
    const fs_div = (searchParams.get("fs_div") ?? "").trim() || "CFS";

    const corp_code = getCorpCodeByTicker(ticker);
    if (!corp_code) {
      return jsonError("corp_code not found for ticker (corpMap.ts 확인 필요)", 400, { ticker });
    }

    // fnlttSinglAcnt: 단일회사 주요계정 재무제표(요약)
    const url = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcnt.json");
    url.searchParams.set("crtfc_key", DART_API_KEY);
    url.searchParams.set("corp_code", corp_code);
    url.searchParams.set("bsns_year", bsns_year);
    url.searchParams.set("reprt_code", reprt_code);
    url.searchParams.set("fs_div", fs_div);

    const upstream = await fetch(url.toString(), { method: "GET" });
    const text = await upstream.text();

    // DART가 장애 시 HTML/텍스트를 줄 때가 있어 → JSON 파싱 보호
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return jsonError("Upstream(DART) returned non-JSON response", 502, { preview: text.slice(0, 120) });
    }

    const d = data as DartError;

    // DART status != 000 이면 그대로 내려서 원인 파악 가능하게
    return NextResponse.json({
      status: "ok",
      ticker,
      corp_code,
      source: "dart.fnlttSinglAcnt",
      request: { bsns_year, reprt_code, fs_div },
      data,
      dart_status: d?.status ?? null,
      dart_message: d?.message ?? null,
    });
  } catch (e: any) {
    return jsonError("Unhandled server error", 500, { detail: String(e?.message ?? e) });
  }
}