/**
 * 📘 financialAnalyzer.ts
 * ARKON-JANUS v3.6.3 (2025 기준)
 *
 * 기능:
 * 1️⃣ fuseFinancials() 결과(FusedFinancials)에서 계정명별 금액 추출
 * 2️⃣ 최신 연도 기준으로 PER, PBR, FCF Yield 계산
 * 3️⃣ ROE, ROA, 영업이익률 등 수익성 지표 산출
 * 4️⃣ Valuation 스코어링 및 밸류 괴리 판정
 */

type FusedFinancials = Record<string, Record<string, number>>;

export type ValuationResult = {
  asof: string;
  per?: number | null;
  pbr?: number | null;
  roe?: number | null;
  roa?: number | null;
  opm?: number | null;
  fcf_yield?: number | null;
  score: string; // "저평가", "적정", "고평가"
  commentary: string;
};

/**
 * 안전 숫자 변환
 */
function n(v: any): number {
  if (v === null || v === undefined) return 0;
  const num = Number(String(v).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

/**
 * 주요 항목 이름 매핑
 */
const KEYS = {
  revenue: ["매출액", "영업수익", "매출"],
  operatingIncome: ["영업이익", "영업손익"],
  netIncome: ["당기순이익", "지배주주순이익"],
  totalAssets: ["자산총계", "총자산"],
  totalEquity: ["자본총계", "자본"],
  operatingCF: ["영업활동현금흐름", "영업현금흐름"],
  marketCap: ["시가총액", "MarketCap"],
};

/**
 * FusedFinancials에서 특정 계정의 최신 연도 금액을 추출
 */
function getLatestValue(fused: FusedFinancials, aliases: string[]): number {
  for (const alias of aliases) {
    const row = fused[alias];
    if (row) {
      const years = Object.keys(row);
      const latestYear = Math.max(...years.map((y) => Number(y)));
      return n(row[latestYear]);
    }
  }
  return 0;
}

/**
 * 밸류에이션 및 수익성 계산
 */
export function analyzeValuation(
  fused: FusedFinancials,
  marketCap?: number
): ValuationResult {
  const rev = getLatestValue(fused, KEYS.revenue);
  const op = getLatestValue(fused, KEYS.operatingIncome);
  const ni = getLatestValue(fused, KEYS.netIncome);
  const eq = getLatestValue(fused, KEYS.totalEquity);
  const as = getLatestValue(fused, KEYS.totalAssets);
  const cf = getLatestValue(fused, KEYS.operatingCF);

  const mc = n(marketCap);

  // 기본 지표 계산
  const per = ni > 0 && mc > 0 ? mc / ni : null;
  const pbr = eq > 0 && mc > 0 ? mc / eq : null;
  const roe = eq > 0 && ni > 0 ? (ni / eq) * 100 : null;
  const roa = as > 0 && ni > 0 ? (ni / as) * 100 : null;
  const opm = rev > 0 && op > 0 ? (op / rev) * 100 : null;
  const fcf_yield = cf > 0 && mc > 0 ? (cf / mc) * 100 : null;

  // 간단한 밸류 스코어링
  let score = "적정";
  if (per && per < 10 && pbr && pbr < 1) score = "저평가";
  else if (per && per > 25 && pbr && pbr > 2) score = "고평가";

  const commentary = [
    per ? `PER: ${per.toFixed(2)}` : "PER: N/A",
    pbr ? `PBR: ${pbr.toFixed(2)}` : "PBR: N/A",
    roe ? `ROE: ${roe.toFixed(2)}%` : "ROE: N/A",
    opm ? `영업이익률: ${opm.toFixed(2)}%` : "영업이익률: N/A",
  ].join(" | ");

  const latestYear = Math.max(
    ...Object.values(fused)
      .map((v) => Math.max(...Object.keys(v).map((y) => Number(y))))
  );

  return {
    asof: `${latestYear}년 기준`,
    per,
    pbr,
    roe,
    roa,
    opm,
    fcf_yield,
    score,
    commentary,
  };
}
