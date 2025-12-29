// app/api/fundamentals/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCorpCodeByTicker } from "@/app/lib/corpMap";

// 에러 응답 헬퍼 함수
function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { status: "error", message, ...(extra ?? {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // 1. 파라미터 파싱
    const ticker = String(url.searchParams.get("ticker") ?? "").trim();
    const bsns_year = String(url.searchParams.get("bsns_year") ?? "2024").trim();
    const reprt_code = String(url.searchParams.get("reprt_code") ?? "11011").trim();
    const fs_div = String(url.searchParams.get("fs_div") ?? "CFS").trim();

    if (!ticker) return jsonError(400, "ticker is required");

    const apiKey = String(process.env.DART_API_KEY ?? "").trim();
    if (!apiKey) return jsonError(500, "DART_API_KEY is missing");

    // 2. 종목코드(Ticker) -> 고유번호(CorpCode) 변환
    let corp_code: string | null = null;
    try {
      corp_code = await getCorpCodeByTicker(ticker);
    } catch (e: any) {
      return jsonError(500, "corp_code resolver crashed", {
        detail: String(e?.message ?? e),
      });
    }

    if (!corp_code) {
      return jsonError(400, `corp_code not found for ticker: ${ticker} (corpMap 확인 필요)`);
    }

    // 3. DART API 호출
    const dartUrl = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
    dartUrl.searchParams.set("crtfc_key", apiKey);
    dartUrl.searchParams.set("corp_code", corp_code);
    dartUrl.searchParams.set("bsns_year", bsns_year);
    dartUrl.searchParams.set("reprt_code", reprt_code);
    dartUrl.searchParams.set("fs_div", fs_div);

    const dartRes = await fetch(dartUrl.toString(), { cache: "no-store" });
    const rawData = await dartRes.json().catch(() => null);

    // 4. DART 응답 에러 처리
    if (!dartRes.ok || !rawData) {
      return jsonError(502, "DART upstream error", {
        upstream_status: dartRes.status,
        upstream_data: rawData,
      });
    }

    if (rawData.status !== "000" && rawData.message) {
      // DART API 자체 에러 (인증키 만료, 데이터 없음 등)
      return jsonError(404, rawData.message, { dart_code: rawData.status });
    }

    // 5. [핵심] 데이터 다이어트 (GPT 용량 초과 방지)
    // 필요한 필드만 남기고 나머지는 버립니다.
    let slimData = [];
    if (rawData.list && Array.isArray(rawData.list)) {
      slimData = rawData.list.map((item: any) => ({
        // 계정명 (예: 매출액, 영업이익)
        account_nm: item.account_nm || item.account_id,
        // 당기 금액 (쉼표 제거 후 숫자로 변환하거나 문자열 유지)
        amount: item.thstrm_amount || "0",
        // 전기 금액 (비교용)
        prev_amount: item.frmtrm_amount || "0",
        // 구분 (재무상태표/손익계산서)
        type: item.sj_nm,
        // 정렬 순서
        ord: item.ord
      }));
    } else {
      return jsonError(404, "No data list found in DART response");
    }

    // 6. 최종 응답 반환
    return NextResponse.json(
      {
        status: "ok",
        message: "ok",
        ticker,
        corp_code,
        year: bsns_year,
        report: reprt_code,
        data: slimData, // 압축된 데이터
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (e: any) {
    return jsonError(500, "Internal Server Error", { detail: String(e?.message ?? e) });
  }
}