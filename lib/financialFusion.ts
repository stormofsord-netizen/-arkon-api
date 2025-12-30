/**
 * 📘 financialFusion.ts
 * 여러 연도의 DART 재무데이터(list[])를 병합/정리하는 로직 (Next 15 + TS 호환 완전판)
 */

type FinancialItem = {
  account_nm: string;
  amount: string;
  prev_amount?: string;
  type?: string;
  ord?: string;
};

type YearlyData = {
  year: number;
  reprt: string;
  data: FinancialItem[];
};

export type FusedFinancials = Record<string, Record<string, number>>;

/**
 * 숫자형 변환 (내장)
 */
function parseAmount(v: string | number | null | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

/**
 * 계정명 표준화 (내장)
 */
function normalizeAccountName(name: string): string {
  if (!name) return "기타";
  return name
    .replace(/\(.+\)/g, "") // 괄호 제거
    .replace(/\s+/g, "") // 공백 제거
    .trim();
}

/**
 * 핵심 병합 함수
 */
function fuseFinancials(reports: YearlyData[]): FusedFinancials {
  const fused: FusedFinancials = {};

  for (const report of reports) {
    const year = report.year.toString();

    for (const item of report.data) {
      const key = normalizeAccountName(item.account_nm);
      const value = parseAmount(item.amount);

      if (!fused[key]) fused[key] = {};
      fused[key][year] = value;
    }
  }

  return fused;
}

/**
 * 💡 성장률 자동 계산
 */
function enrichWithGrowthStats(fused: FusedFinancials): any {
  const enriched: any = {};

  for (const [account, years] of Object.entries(fused)) {
    const sortedYears = Object.keys(years).sort(
      (a, b) => Number(a) - Number(b)
    );
    const latest = sortedYears.at(-1)!;
    const prev = sortedYears.at(-2);

    const latestValue = years[latest] ?? 0;
    const prevValue = prev ? years[prev] ?? 0 : 0;
    const growthRate = prevValue
      ? ((latestValue - prevValue) / prevValue) * 100
      : null;

    enriched[account] = {
      ...years,
      growth_rate:
        growthRate !== null ? Number(growthRate.toFixed(2)) : null,
    };
  }

  return enriched;
}

// ✅ 명시적 내보내기 (Next.js 정적 Export 인식용)
export { fuseFinancials, enrichWithGrowthStats };
export type { FinancialItem, YearlyData };
