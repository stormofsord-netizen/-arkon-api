/**
 * Financial Fusion Engine (Quarter Fusion + HHL)
 * IS, BS, CF 자동 병합 및 누적 계산
 */

import { parseIS, parseBS, parseCF } from "./utils/financialParser";

export function fuseFinancials(dataMap: Record<number, any>) {
  const years = Object.keys(dataMap).map(Number).sort((a, b) => a - b);
  const latestYear = Math.max(...years);
  const latestReprt = dataMap[latestYear].reprt_code;

  const result: any = {};
  for (const y of years) {
    const data = dataMap[y].list || [];
    result[y] = {
      IS: parseIS(data),
      BS: parseBS(data),
      CF: parseCF(data),
      reprt_code: dataMap[y].reprt_code
    };
  }

  // 출력 메타
  return {
    asof: `${latestYear} ${reprtToLabel(latestReprt)} 누적 실적 기준`,
    historic_range: `${years[0]}~${years[years.length - 2]}`,
    data: result
  };
}

/** 간단한 보고서 코드 라벨링 */
function reprtToLabel(r: string): string {
  const map: Record<string, string> = {
    "11013": "1분기",
    "11012": "반기",
    "11014": "3분기",
    "11011": "사업"
  };
  return map[r] || "기타";
}
