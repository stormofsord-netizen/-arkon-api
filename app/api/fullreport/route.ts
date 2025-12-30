/**
 * 📘 /app/api/fullreport/route.ts
 * ARKON-JANUS v3.6.3 (2025 기준)
 *
 * 기능:
 * 1️⃣ ticker 기준으로 전체 분석 파이프라인 실행
 * 2️⃣ dartHandler → financialFusion → financialAnalyzer → riskAnalyzer → quantAnalyzer → reportBuilder 자동 연동
 * 3️⃣ 완전 자동 “Full Report” 모드
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

// Core modules
import { fetchFundamentalsFusion } from "@lib/dartHandler";
import { fuseFinancials } from "@lib/financialFusion";
import { analyzeValuation } from "@lib/financialAnalyzer";
import { analyzeRisk } from "@lib/riskAnalyzer";
import { analyzeQuant } from "@lib/quantAnalyzer";
import { buildReport } from "@lib/reportBuilder";

/**
 * ✅ 헬퍼 함수: 에러 응답
 */
function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { status: "error", message, ...(extra ?? {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * ✅ FULL REPORT 엔드포인트
 * 예시: /api/fullreport?ticker=278470
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ticker = String(url.searchParams.get("ticker") ?? "").trim();

    if (!ticker) return jsonError(400, "ticker is required");

    // 1️⃣ DART 데이터 수집 (최신 분기 + 과거 3개년)
    const dartDataset = await fetchFundamentalsFusion(ticker);
    if (!dartDataset?.data) return jsonError(404, "No DART data found");

    // 2️⃣ 데이터 병합
    const fused = fuseFinancials(Object.values(dartDataset.data));

    // 3️⃣ 밸류에이션 분석
    const valuation = analyzeValuation(fused, dartDataset.marketCap);

    // 4️⃣ 리스크 분석
    const risk = await analyzeRisk(fused, dartDataset.recentNews ?? []);

    // 5️⃣ Quant 분석 (가격 시계열 optional)
    const quant = await analyzeQuant(dartDataset.priceSeries ?? []);

    // 6️⃣ 리포트 통합
    const report = await buildReport(fused, dartDataset.priceSeries, dartDataset.marketCap);

    // 7️⃣ 전체 요약 섹션 추가
    const summary = {
      valuation_score: valuation.score,
      risk_level: risk.alert,
      signal: quant.price_signal,
    };

    // 8️⃣ 최종 리턴
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
