/**
 * 📘 reportBuilder.ts
 * ARKON-JANUS v3.6.3 (2025 기준)
 * 
 * 기능:
 * 1️⃣ dartHandler → financialFusion → financialAnalyzer → riskAnalyzer 연동
 * 2️⃣ 최신 분기 기준 재무 요약 리포트 구성
 */

import { analyzeValuation } from "@lib/financialAnalyzer";
import { analyzeRisk } from "@lib/riskAnalyzer";
import { analyzeQuant } from "@lib/quantAnalyzer";

/**
 * 🧩 reportBuilder
 * @param fusedData - fuseFinancials() 결과
 * @param priceSeries - 주가 시계열 (옵션)
 * @param marketCap - 시가총액 (백만원 단위)
 */
export async function buildReport(
  fusedData: any,
  priceSeries?: any[],
  marketCap?: number
) {
  try {
    // 1️⃣ Valuation 분석
    const valuation = analyzeValuation(fusedData, marketCap);

    // 2️⃣ Risk 분석
    const risk = analyzeRisk ? await analyzeRisk(fusedData) : null;

    // 3️⃣ Quant 분석
    const quant = analyzeQuant ? await analyzeQuant(priceSeries) : null;

    // 4️⃣ 리포트 구조 구성
    const fundamental = {
      Valuation: {
        PER: valuation.per?.toFixed(2) ?? "N/A",
        PBR: valuation.pbr?.toFixed(2) ?? "N/A",
        ROE: valuation.roe ? `${valuation.roe.toFixed(2)}%` : "N/A",
        ROA: valuation.roa ? `${valuation.roa.toFixed(2)}%` : "N/A",
        OPM: valuation.opm ? `${valuation.opm.toFixed(2)}%` : "N/A",
        FCF_Yield: valuation.fcf_yield
          ? `${valuation.fcf_yield.toFixed(2)}%`
          : "N/A",
        Score: valuation.score,
      },
      Commentary: valuation.commentary,
    };

    // 5️⃣ 리포트 헤더 요약
    const header = {
      status: "ok",
      asof: valuation.asof,
      generated_at: new Date().toISOString(),
      system: "ARKON-JANUS v3.6.3",
    };

    // 6️⃣ 최종 리포트
    const report = {
      ...header,
      fundamental,
      risk: risk ?? { message: "risk module skipped" },
      quant: quant ?? { message: "quant module skipped" },
    };

    return report;
  } catch (e: any) {
    return {
      status: "error",
      message: "reportBuilder failed",
      detail: String(e?.message ?? e),
    };
  }
}
