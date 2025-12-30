/**
 * riskAnalyzer.ts
 * - 재무 안정성 및 현금흐름 리스크 분석
 */

export function analyzeRisk(dataset: any) {
  const years = Object.keys(dataset).map(Number).sort((a, b) => a - b);
  const latest = Math.max(...years);
  const cur = dataset[latest];

  const assets = Number(cur.BS?.Assets ?? 0);
  const liabilities = Number(cur.BS?.Liabilities ?? 0);
  const equity = Number(cur.BS?.Equity ?? 0);
  const ocf = Number(cur.CF?.OCF ?? 0);
  const capex = Number(cur.CF?.CAPEX ?? 0);
  const fcf = Number(cur.CF?.FCF ?? 0);

  const debtRatio = equity > 0 ? (liabilities / equity) * 100 : null;
  const fcfSign = fcf >= 0 ? "Positive" : "Negative";

  // R6/R4 간단한 리스크 판단 예시
  const r6 = debtRatio && debtRatio > 200 ? "High Leverage" : "Normal";
  const r4 = ocf < 0 && fcf < 0 ? "Cash Flow Warning" : "Normal";

  const keyRisk =
    r6 !== "Normal"
      ? "R6: High Leverage"
      : r4 !== "Normal"
      ? "R4: Cash Flow Warning"
      : "None";

  return {
    DebtRatio: debtRatio,
    FCF: fcf,
    FCFSign: fcfSign,
    OCF: ocf,
    CAPEX: capex,
    R6: r6,
    R4: r4,
    KeyRisk: keyRisk,
  };
}
