/**
 * 📘 dartHandler.ts
 * DART (금융감독원 전자공시) API 핸들러
 * - 최신 보고서 자동 선택 (분석 요청 시점 기준)
 * - 전년/전전년 비교용 데이터 병렬 수집
 * - Next.js 런타임 기본 fetch() 사용 (node-fetch 불필요)
 */

import { fuseFinancials } from "./financialFusion";

const DART_API = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";

/**
 * 보고서 코드 자동 감지 (요청 시점 기준)
 * 11011: 사업보고서 / 11012: 반기 / 11013: 1분기 / 11014: 3분기
 */
function getLatestReportCode(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 11) return "11014"; // 3분기
  if (month >= 8) return "11012";  // 반기
  if (month >= 5) return "11013";  // 1분기
  return "11011";                  // 사업
}

/**
 * DART API 호출 함수
 */
export async function fetchDartData(
  corp_code: string,
  bsns_year: number,
  reprt_code: string = getLatestReportCode(),
  fs_div: string = "CFS"
): Promise<any | null> {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("DART_API_KEY is missing in environment");

  const url = new URL(DART_API);
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("corp_code", corp_code);
  url.searchParams.set("bsns_year", bsns_year.toString());
  url.searchParams.set("reprt_code", reprt_code);
  url.searchParams.set("fs_div", fs_div);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`DART API fetch failed: ${res.status}`);

  const json = await res.json().catch(() => null);
  if (!json || json.status !== "000") return null;

  return json.list.map((item: any) => ({
    account_nm: item.account_nm || item.account_id,
    amount: item.thstrm_amount || "0",
    prev_amount: item.frmtrm_amount || "0",
    type: item.sj_nm,
    ord: item.ord,
  }));
}

/**
 * 최신 분기 + 과거 3개년 병합 데이터 수집
 * @param corp_code 기업 고유번호
 */
export async function fetchFundamentalsFusion(corp_code: string) {
  const thisYear = new Date().getFullYear();
  const latestReport = getLatestReportCode();

  // 병렬 요청 대상 설정
  const targets = [
    { y: thisYear, r: latestReport },
    { y: thisYear - 1, r: latestReport }, // 전년 동분기
    { y: thisYear - 2, r: "11011" },      // 2년 전 연간
    { y: thisYear - 3, r: "11011" }       // 3년 전 연간
  ];

  const results = await Promise.all(
    targets.map(async ({ y, r }) => {
      const data = await fetchDartData(corp_code, y, r);
      if (!data) return null;
      return { year: y, reprt: r, data };
    })
  );

  // 유효 데이터만 추출
  const valid = results.filter(Boolean) as {
    year: number;
    reprt: string;
    data: any[];
  }[];

  if (valid.length === 0) throw new Error("No valid DART data found");

  // 병합 실행
  const fused = fuseFinancials(valid);

  // 보고서 기준 라벨
  const latestLabel =
    latestReport === "11014" ? "3분기" :
    latestReport === "11012" ? "반기" :
    latestReport === "11013" ? "1분기" : "사업";

  return {
    status: "ok",
    asof: `${thisYear}년 ${latestLabel} 누적 실적 기준`,
    historic_range: `${thisYear - 3}~${thisYear - 1}`,
    reports: valid.length,
    data: fused
  };
}
