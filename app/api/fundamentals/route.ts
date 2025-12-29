// app/api/fundamentals/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCorpCodeByTicker } from "@/app/lib/corpMap";

const DART_ENDPOINT =
  "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";

function jsonError(
  httpStatus: number,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { status: "error", message, ...(extra ?? {}) },
    {
      status: httpStatus,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 15000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function pickEnvApiKey() {
  // 혹시 키 이름을 다르게 넣었을 가능성까지 방어
  return (
    process.env.DART_API_KEY ||
    process.env.DART_APIKEY ||
    process.env.DART_KEY ||
    ""
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const ticker = (searchParams.get("ticker") || "").trim();
    if (!/^\d{6}$/.test(ticker)) {
      return jsonError(400, "ticker must be 6 digits (e.g. 005930)", { ticker });
    }

    const bsns_year =
      (searchParams.get("bsns_year") || "").trim() ||
      String(new Date().getFullYear() - 1);

    const reprt_code = (searchParams.get("reprt_code") || "").trim() || "11011";
    const fs_div = (searchParams.get("fs_div") || "").trim() || "CFS";

    const apiKey = pickEnvApiKey();
    if (!apiKey) {
      return jsonError(500, "DART_API_KEY is missing in environment variables");
    }

    // corp_code 해결 (여기서 터지면 INTERNAL_FUNCTION_INVOCATION_FAILED 잘 뜸)
    let corp_code: string | null = null;
    try {
      corp_code = await getCorpCodeByTicker(ticker);
    } catch (e: any) {
      return jsonError(500, "corp_code resolver crashed (corpMap.ts)", {
        ticker,
        detail: String(e?.message || e),
      });
    }

    if (!corp_code) {
      return jsonError(404, "corp_code not found for ticker", { ticker });
    }

    const url = new URL(DART_ENDPOINT);
    url.searchParams.set("crtfc_key", apiKey);
    url.searchParams.set("corp_code", corp_code);
    url.searchParams.set("bsns_year", bsns_year);
    url.searchParams.set("reprt_code", reprt_code);
    url.searchParams.set("fs_div", fs_div);

    const res = await fetchWithTimeout(url.toString(), {
      method: "GET",
      timeoutMs: 15000,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return jsonError(502, `DART upstream HTTP ${res.status}`, {
        ticker,
        corp_code,
        upstream_status: res.status,
        upstream_body: text.slice(0, 500),
      });
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      return jsonError(502, "DART response is not valid JSON", {
        ticker,
        corp_code,
        upstream_body: text.slice(0, 500),
      });
    }

    // DART 표준: status === "000" 이 정상
    if (typeof data?.status === "string" && data.status !== "000") {
      return jsonError(502, `DART error ${data.status}: ${data.message ?? ""}`, {
        ticker,
        corp_code,
        dart_status: data.status,
        dart_message: data.message,
      });
    }

    return NextResponse.json(
      {
        status: "ok",
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
    return jsonError(500, "Unhandled server error", {
      detail: String(e?.message || e),
    });
  }
}