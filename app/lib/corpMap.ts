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

function pick(q: URLSearchParams, key: string, fallback?: string) {
  const v = q.get(key);
  return (v ?? fallback ?? "").trim();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams;

  const ticker = pick(q, "ticker");
  if (!ticker) return jsonError(400, "ticker is required", { ticker });

  const bsns_year = pick(q, "bsns_year", String(new Date().getFullYear() - 1));
  const reprt_code = pick(q, "reprt_code", "11011");
  const fs_div = pick(q, "fs_div", "CFS");

  const dartKey = process.env.DART_API_KEY;
  if (!dartKey) return jsonError(500, "DART_API_KEY is missing on server", { ticker });

  // 1) corp_code 조회 (여기가 크래시 나도 500 대신 JSON으로 방어)
  let corp_code: string | null = null;
  try {
    corp_code = await getCorpCodeByTicker(ticker);
  } catch (e: any) {
    return jsonError(500, "corp_code resolver crashed (corpMap.ts)", {
      ticker,
      detail: e?.message ?? String(e),
    });
  }

  if (!corp_code) {
    return jsonError(404, "corp_code not found for ticker", {
      ticker,
      hint: "DART corpCode.xml에서 해당 종목코드가 stock_code로 매칭되는지 확인",
    });
  }

  // 2) DART 재무 호출
  const endpoint = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";
  const dartUrl = new URL(endpoint);
  dartUrl.searchParams.set("crtfc_key", dartKey);
  dartUrl.searchParams.set("corp_code", corp_code);
  dartUrl.searchParams.set("bsns_year", bsns_year);
  dartUrl.searchParams.set("reprt_code", reprt_code);
  dartUrl.searchParams.set("fs_div", fs_div);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(dartUrl.toString(), {
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return jsonError(502, "DART upstream HTTP error", {
        ticker,
        corp_code,
        http_status: res.status,
        http_status_text: res.statusText,
      });
    }

    const data = await res.json();

    // DART는 보통 status:"000" 성공
    if (data?.status && data.status !== "000") {
      return jsonError(502, "DART returned error", {
        ticker,
        corp_code,
        dart_status: data.status,
        dart_message: data.message,
      });
    }

    return NextResponse.json(
      {
        status: "ok",
        message: "success",
        ticker: ticker.padStart(6, "0"),
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
    return jsonError(500, "fundamentals route crashed", {
      ticker,
      corp_code,
      detail: e?.name === "AbortError" ? "timeout" : e?.message ?? String(e),
    });
  }
}