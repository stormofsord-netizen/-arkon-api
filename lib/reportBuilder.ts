/**
 * reportBuilder.ts
 * ARKON-JANUS v3.6.3 FINAL
 * Phase 4: Executor
 *
 * 역할:
 *  - Phase 1~3 결과를 통합하여 EXECUTIVE SUMMARY 리포트 생성
 *  - JANUS 시스템 표준 포맷 준수
 */

import { analyzeValuation } from "@lib/financialAnalyzer";
import { analyzeRisk } from "@lib/riskAnalyzer";
import { analyzeQuant } from "@lib/quantAnalyzer";


export async function buildReport(dataset: any, priceSeries: any[], marketCap: number) {
  // 1️⃣ 각 Phase 실행
  const valuation = analyzeValuation(dataset, marketCap);
  const risk = analyzeRisk(dataset);
  const quant = analyzeQuant(priceSeries);

  // 2️⃣ 최종 판정 (GO / NO-GO / CAUTION / KILL)
  const decision = getDecision(valuation, risk, quant);

  // 3️⃣ Executive Summary 구성
  const summary = {
    MODE: "FULL",
    판정: decision.flag,
    "Key Risk": risk.KeyRisk,
  };

  const fundamental = {
    Valuation: {
      PER: valuation.PER?.toFixed(2) ?? "N/A",
      PBR: valuation.PBR?.toFixed(2) ?? "N/A",
      ROE: `${valuation.ROE?.toFixed(2) ?? "N/A"}%`,
      YoY: `${valuation.YoY?.toFixed(2) ?? "N/A"}%`,
      CAGR: `${valuation.CAGR?.toFixed(2) ?? "N/A"}%`,
    },
    Risk: {
      DebtRatio: `${risk.DebtRatio?.toFixed(1) ?? "N/A"}%`,
      FCF: risk.FCF,
      OCF: risk.OCF,
      R6: risk.R6,
      R4: risk.R4,
    },
  };

  const quantStats = {
    Signal: quant.signal,
    ATR: quant.ATR?.toFixed(2) ?? "N/A",
    RSI: quant.RSI?.toFixed(1) ?? "N/A",
  };

  // 4️⃣ 종합 리포트 반환
  return {
    EXECUTIVE_SUMMARY: summary,
    FUNDAMENTAL_AND_RISK: fundamental,
    QUANT_AND_PRICE: quantStats,
  };
}

/**
 * 내부 판단 로직 (GO / NO-GO / CAUTION / KILL)
 */
function getDecision(val: any, risk: any, quant: any) {
  // 기본 값
  let flag = "CAUTION";
  let reason = "";

  // R6/R4 위험 우선
  if (risk.KeyRisk !== "None") {
    flag = "KILL";
    reason = risk.KeyRisk;
  } else if (val.ROE && val.ROE > 10 && val.YoY && val.YoY > 5) {
    flag = "GO";
  } else if (val.ROE && val.ROE > 5) {
    flag = "CAUTION";
  } else {
    flag = "NO-GO";
  }

  // RSI 신호 보정
  if (quant.signal === "OVERBOUGHT" && flag === "GO") flag = "CAUTION";
  if (quant.signal === "OVERSOLD" && flag === "CAUTION") flag = "GO";

  return { flag, reason };
}
