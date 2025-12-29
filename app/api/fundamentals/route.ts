// app/api/fundamentals/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCorpCodeByTicker } from "@/app/lib/corpMap";

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
    const bsns_year = String(url.searchParams.get("bsns_year") ?? "2024").trim();
    const reprt_code = String(url.searchParams.get("reprt_code") ?? "11011").trim();
    const fs_div = String(url.searchParams.get("fs_div") ?? "CFS").trim();

    if (!ticker) return jsonError(400, "ticker is required");

    const apiKey = String(process.env.DART_API_KEY ?? "").trim();
    if (!apiKey) return jsonError(500, "DART_API_KEY is missing");

    let corp_code: string | null = null;
    try {
      corp_code = await getCorpCodeByTicker(ticker);
    } catch (e: any) {
      return jsonError(500, "corp_code resolver crashed (corpMap.ts)", {
        ticker,
        detail: String(e?.message ?? e),
      });
    }

    if (!corp_code) {
      return jsonError(400, "corp_code not found for ticker", {
        ticker,
      });
    }

    const dartUrl = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
    dartUrl.searchParams.set("crtfc_key", apiKey);
    dartUrl.searchParams.set("corp_code", corp_code);
    dartUrl.searchParams.set("bsns_year", bsns_year);
    dartUrl.searchParams.set("reprt_code", reprt_code);
    dartUrl.searchParams.set("fs_div", fs_div);

    const dartRes = await fetch(dartUrl.toString(), { cache: "no-store" });
    const data = await dartRes.json().catch(() => null);

    if (!dartRes.ok) {
      return jsonError(502, "DART upstream error", {
        ticker,
        corp_code,
        upstream_status: dartRes.status,
        upstream_statusText: dartRes.statusText,
        upstream: data,
      });
    }

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
    // ✅ 최후의 500 방어
    return jsonError(500, "internal error", { detail: String(e?.message ?? e) });
  }
}