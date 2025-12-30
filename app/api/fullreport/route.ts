export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

// ✅ 파일이 실제로 존재하는 경로로 수정 (스크린샷 기반)
// 만약 lib폴더가 app폴더 밖(최상위)에 있다면 아래가 맞습니다.
import { fetchFundamentalsFusion } from "@/lib/dartHandler";
import { fuseFinancials } from "@/lib/financialFusion";
import { analyzeValuation } from "@/lib/financialAnalyzer";
import { analyzeRisk } from "@/lib/riskAnalyzer";
import { analyzeQuant } from "@/lib/quantAnalyzer";
import { buildReport } from "@/lib/reportBuilder";

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

    if (!ticker) return jsonError(400, "ticker is required");

    console.log(`[API] Starting Full Report for ${ticker}`);

    // 1️⃣ 펀더멘털 수집
    const dartDataset = await fetchFundamentalsFusion(ticker);
    if (!dartDataset || !dartDataset.data) {
        return jsonError(404, "No DART data found (fetch failed)");
    }

    // 2️⃣ 데이터 구조 통일
    const reports = Object.entries(dartDataset.data).map(([year, v]: any) => ({
      year: Number(year),
      reprt: v.reprt ?? "11011",
      data: v.data ?? [],
    }));

    // 3️⃣ 병합
    const fused = fuseFinancials(reports);

    // 4️⃣ 밸류에이션 분석
    const valuation = analyzeValuation(fused, dartDataset.marketCap);

    // 5️⃣ 리스크 분석
    const risk = await analyzeRisk(fused, []);

    // 6️⃣ 퀀트 분석
    const quant = await analyzeQuant([]);

    // 7️⃣ 리포트 통합
    const report = await buildReport(fused, [], dartDataset.marketCap);

    // 8️⃣ 요약
    const summary = {
      valuation_score: valuation?.score ?? 0,
      risk_level: risk?.alert ?? "Unknown",
      signal: quant?.price_signal ?? "N/A",
    };

    return NextResponse.json(
      {
        status: "ok",
        system: "ARKON-JANUS v3.6.3",
        asof: valuation?.asof,
        generated_at: new Date().toISOString(),
        corp_code: dartDataset.corp_code,
        marketCap: dartDataset.marketCap,
        fundamental: report?.fundamental,
        risk,
        quant,
        summary,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    console.error("FullReport Error:", e);
    return jsonError(500, "Internal Server Error", {
      detail: String(e?.message ?? e),
    });
  }
}