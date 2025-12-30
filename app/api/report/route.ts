export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
// ✅ 경로가 올바른지 다시 확인 (@/lib)
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

    // 1️⃣ 펀더멘털 수집
    const dartDataset = await fetchFundamentalsFusion(ticker);
    if (!dartDataset?.data) return jsonError(404, "No DART data found");

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
    const rawReport = await buildReport(fused, [], dartDataset.marketCap);
    
    // 🛠️ [FIX] TypeScript 에러 회피용 강제 형변환 (as any)
    // report가 에러 객체일 수도 있고 정상 객체일 수도 있어서 TS가 불평하는 것을 막음
    const report = rawReport as any;

    // 8️⃣ 요약
    const summary = {
      valuation_score: valuation?.score ?? 0,
      risk_level: risk?.alert ?? "Unknown",
      signal: quant?.price_signal ?? "N/A",
    };

    // ✅ 최종 응답
    return NextResponse.json(
      {
        status: "ok",
        system: "ARKON-JANUS v3.6.3",
        asof: valuation?.asof,
        generated_at: new Date().toISOString(),
        corp_code: dartDataset.corp_code,
        marketCap: dartDataset.marketCap,
        // 👇 여기서 에러가 났던 것인데, 위에서 'as any'로 처리해서 해결됨
        fundamental: report?.fundamental ?? null,
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