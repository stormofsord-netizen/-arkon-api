/**
 * ARKON-JANUS v3.6.3r1
 * DART Multi-Fetch Handler (Quarter Fusion + Historic Sync)
 */

import fetch from "node-fetch";
import { fuseFinancials } from "./financialFusion";

const DART_API = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";
const API_KEY = process.env.DART_API_KEY || "<YOUR_DART_KEY>";

/** 보고서 코드 자동 탐색 */
function getLatestReportCode(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 11) return "11014"; // 3Q
  if (m >= 8) return "11012";  // 2Q
  if (m >= 5) return "11013";  // 1Q
  return "11011";              // FY
}

/** DART 단일 호출 */
async function callDart(ticker: string, year: number, reprt: string, fs = "CFS") {
  const params = new URLSearchParams({
    crtfc_key: API_KEY,
    corp_code: ticker,
    bsns_year: year.toString(),
    reprt_code: reprt,
    fs_div: fs
  });

  const res = await fetch(`${DART_API}?${params.toString()}`);
  const json = await res.json().catch(() => null);
  if (json?.status === "000") return json;
  return null;
}

/** 현재 + 과거 3개년 데이터 수집 */
export async function fetchFundamentalsFusion(ticker: string) {
  const thisYear = new Date().getFullYear();
  const latestReprt = getLatestReportCode();

  const targets = [
    { y: thisYear, r: latestReprt },
    { y: thisYear - 1, r: latestReprt }, // 전년 동일 분기
    { y: thisYear - 2, r: "11011" },
    { y: thisYear - 3, r: "11011" }
  ];

  const dataMap: Record<number, any> = {};
  for (const { y, r } of targets) {
    const data = await callDart(ticker, y, r);
    if (data) dataMap[y] = { ...data, reprt_code: r };
  }

  return fuseFinancials(dataMap);
}
