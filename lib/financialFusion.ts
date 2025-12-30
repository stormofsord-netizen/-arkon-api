/**
 * 📘 financialFusion.ts
 * 여러 연도의 DART 재무데이터(list[])를 병합/정리하는 로직
 * 
 * 1. DART raw list[]를 받아서 항목별로 정리
 * 2. 연도별 데이터(1Q, 2Q, 3Q, 사업보고서 등)를 병합
 * 3. 일관된 계정명(account_nm) 기준으로 매핑
 * 4. 각 계정별로 최신 연도, 전년, 전전년 금액 비교가 가능하도록 변환
 * 
 * Output 예시:
 * {
 *   "매출액": { "2025": 1000, "2024": 950, "2023": 890 },
 *   "영업이익": { "2025": 150, "2024": 120, "2023": 100 }
 * }
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

type FusedFinancials = Record<
  string,
  Record<string, number>
>;

/**
 * 숫자형 변환 헬퍼
 */
function parseAmount(v: string | number | null | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

/**
 * 계정명 표준화 (한글 기준)
 * 예: '매출액(Revenue)' → '매출액'
 */
function normalizeAccountName(name: string): string {
  if (!name) return "기타";
  return name
    .replace(/\(.+\)/g, "") // 괄호 제거
    .replace(/\s+/g, "")    // 공백 제거
    .trim();
}

/**
 * 핵심 병합 함수
 * @param reports DART 데이터 (여러 년도)
 * @returns FusedFinancials
 */
export function fuseFinancials(reports: YearlyData[]): FusedFinancials {
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
 * 💡 정리 + 통계용 부가 기능 (선택적)
 * 최신 연도 대비 성장률 / 전년 대비 증감률 자동 계산
 */
export function enrichWithGrowthStats(fused: FusedFinancials): any {
  const enriched: any = {};

  for (const [account, years] of Object.entries(fused)) {
    const sortedYears = Object.keys(years).sort((a, b) => Number(a) - Number(b));
    const latest = sortedYears.at(-1)!;
    const prev = sortedYears.at(-2);

    const latestValue = years[latest] ?? 0;
    const prevValue = prev ? years[prev] ?? 0 : 0;
    const growthRate = prevValue ? ((latestValue - prevValue) / prevValue) * 100 : null;

    enriched[account] = {
      ...years,
      growth_rate: growthRate !== null ? Number(growthRate.toFixed(2)) : null,
    };
  }

  return enriched;
}
