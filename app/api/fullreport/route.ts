export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchFundamentalsFusion } from "@lib/dartHandler";
import { fuseFinancials } from "@lib/financialFusion";
import { analyzeValuation } from "@lib/financialAnalyzer";
import { analyzeRisk } from "@lib/riskAnalyzer";
import { analyzeQuant } from "@lib/quantAnalyzer";
import { buildReport } from "@lib/reportBuilder";

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

    // 1️⃣ DART 데이터 수집 (최신 분기 + 과거 3개년)
    const dartDataset = await fetchFundamentalsFusion(ticker);
    if (!dartDataset?.data) return jsonError(404, "No DART data found");

    // ✅ 2️⃣ 데이터 변환 → YearlyData[] 구조로 맞춤
    const reports = Object.entries(dartDataset.data).map(([year, v]: any) => ({
      year: Number(year),
      reprt: v.reprt ?? "11011",
      data: v.data ?? [],
    }));

    // ✅ 3️⃣ 데이터 병합
    const fused = fuseFinancials(reports);

    // 4️⃣ 밸류에이션 분석
    const valuation = analyzeValuation(fused, dartDataset.marketCap);

    // 5️⃣ 리스크 분석
    const risk = await analyzeRisk(fused, dartDataset.recentNews ?? []);

    // 6️⃣ Quant 분석
    const quant = await analyzeQuant(dartDataset.priceSeries ?? []);

    // 7️⃣ 통합 리포트
    const report = await buildReport(fused, dartDataset.priceSeries, dartDataset.marketCap);

    // 8️⃣ 요약 섹션
    const summary = {
      valuation_score: valuation.score,
      risk_level: risk.alert,
      signal: quant.price_signal,
    };

    // ✅ 최종 응답
    return NextResponse.json(
      {
        status: "ok",
        system: "ARKON-JANUS v3.6.3",
        asof: valuation.asof,
        generated_at: new Date().toISOString(),
        fundamental: report.fundamental,
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
    return jsonError(500, "Internal Server Error", {
      detail: String(e?.message ?? e),
    });
  }
}
