/**
 * 📘 riskAnalyzer.ts
 * ARKON-JANUS v3.6.3 (2025 기준)
 *
 * 기능:
 * 1️⃣ 재무 안전성 지표 계산 (부채비율, 유동비율, 자기자본비율)
 * 2️⃣ 자본잠식 / 부채 과잉 탐지
 * 3️⃣ R6 위험 요인: CB, BW, 담보, M&A 관련 키워드 감지 (optional)
 */

type FusedFinancials = Record<string, Record<string, number>>;

export type RiskResult = {
  asof: string;
  debt_ratio?: number | null;
  current_ratio?: number | null;
  equity_ratio?: number | null;
  alert: "안전" | "주의" | "위험" | "치명적";
  commentary: string;
};

/**
 * 숫자 변환 유틸
 */
function n(v: any): number {
  if (v === null || v === undefined) return 0;
  const num = Number(String(v).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

/**
 * 항목명 매핑
 */
const KEYS = {
  totalLiabilities: ["부채총계", "총부채", "부채"],
  totalAssets: ["자산총계", "총자산", "자산"],
  totalEquity: ["자본총계", "자본", "자기자본"],
  currentAssets: ["유동자산"],
  currentLiabilities: ["유동부채"],
};

/**
 * 최신 연도 값 추출
 */
function getLatestValue(fused: FusedFinancials, aliases: string[]): number {
  for (const alias of aliases) {
    const row = fused[alias];
    if (row) {
      const years = Object.keys(row);
      const latest = Math.max(...years.map((y) => Number(y)));
      return n(row[latest]);
    }
  }
  return 0;
}

/**
 * 메인 분석 함수
 */
export async function analyzeRisk(
  fused: FusedFinancials,
  recentNews?: string[]
): Promise<RiskResult> {
  const liab = getLatestValue(fused, KEYS.totalLiabilities);
  const eq = getLatestValue(fused, KEYS.totalEquity);
  const asset = getLatestValue(fused, KEYS.totalAssets);
  const curA = getLatestValue(fused, KEYS.currentAssets);
  const curL = getLatestValue(fused, KEYS.currentLiabilities);

  const debt_ratio = eq > 0 ? (liab / eq) * 100 : null;
  const current_ratio = curL > 0 ? (curA / curL) * 100 : null;
  const equity_ratio = asset > 0 ? (eq / asset) * 100 : null;

  // 위험 등급 기본값
  let alert: RiskResult["alert"] = "안전";

  // 정량적 판정
  if (debt_ratio && debt_ratio > 200) alert = "주의";
  if (debt_ratio && debt_ratio > 400) alert = "위험";
  if (eq <= 0) alert = "치명적"; // 자본잠식

  if (current_ratio && current_ratio < 80) {
    alert = alert === "위험" ? "치명적" : "주의";
  }

  // R6: 거버넌스 리스크 탐지 (뉴스 키워드)
  if (recentNews && recentNews.length > 0) {
    const R6_KEYWORDS = ["전환사채", "CB", "BW", "담보", "M&A", "유상증자"];
    const match = recentNews.find((n) =>
      R6_KEYWORDS.some((k) => n.includes(k))
    );
    if (match) {
      alert = "치명적";
    }
  }

  const commentary = [
    debt_ratio ? `부채비율: ${debt_ratio.toFixed(1)}%` : "부채비율: N/A",
    equity_ratio ? `자본비율: ${equity_ratio.toFixed(1)}%` : "자본비율: N/A",
    current_ratio ? `유동비율: ${current_ratio.toFixed(1)}%` : "유동비율: N/A",
    eq <= 0 ? "⚠️ 자본잠식 발생" : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const latestYear = Math.max(
    ...Object.values(fused)
      .map((v) => Math.max(...Object.keys(v).map((y) => Number(y))))
  );

  return {
    asof: `${latestYear}년 기준`,
    debt_ratio,
    current_ratio,
    equity_ratio,
    alert,
    commentary,
  };
}
