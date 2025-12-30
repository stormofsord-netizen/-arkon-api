import fetch from "node-fetch";
import { fuseFinancials } from "./financialFusion";
import { getCorpCodeByTicker } from "./corpMap";

const DART_API = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";

/**
 * 🧩 최신 분기 + 과거 3개년 DART 데이터 병합
 */
export async function fetchFundamentalsFusion(ticker: string) {
  const apiKey = String(process.env.DART_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("DART_API_KEY missing");

  const corp_code = await getCorpCodeByTicker(ticker);
  if (!corp_code) throw new Error(`corp_code not found for ticker ${ticker}`);

  // ✅ 보고서 코드 자동 감지
  function getLatestReportCode(): string {
    const m = new Date().getMonth() + 1;
    if (m >= 11) return "11014"; // 3분기
    if (m >= 8) return "11012";  // 반기
    if (m >= 5) return "11013";  // 1분기
    return "11011";              // 사업
  }

  const thisYear = new Date().getFullYear();
  const latest = getLatestReportCode();

  const targets = [
    { y: thisYear, r: latest },
    { y: thisYear - 1, r: latest },
    { y: thisYear - 2, r: "11011" },
    { y: thisYear - 3, r: "11011" },
  ];

  const results = await Promise.all(
    targets.map(async ({ y, r }) => {
      const dartUrl = new URL(DART_API);
      dartUrl.searchParams.set("crtfc_key", apiKey);
      dartUrl.searchParams.set("corp_code", corp_code);
      dartUrl.searchParams.set("bsns_year", y.toString());
      dartUrl.searchParams.set("reprt_code", r);
      dartUrl.searchParams.set("fs_div", "CFS");

      const res = await fetch(dartUrl.toString(), { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (json?.status !== "000") return null;

      const list = (json.list ?? []).map((item: any) => ({
        account_nm: item.account_nm || item.account_id,
        amount: Number(item.thstrm_amount?.replace(/,/g, "") || 0),
        prev_amount: Number(item.frmtrm_amount?.replace(/,/g, "") || 0),
        type: item.sj_nm,
        ord: item.ord,
      }));

      return { year: y, reprt: r, data: list };
    })
  );

  const valid = results.filter(Boolean);
  if (!valid.length) throw new Error("No valid DART data found");

  // ✅ 임시 시가총액 계산 (실제는 KRX API나 프론트에서 보강)
  const latestPrice = 100000; // (임시값 또는 fetch로 대체)
  const shares = 20000000;    // (임시값)
  const marketCap = latestPrice * shares;

  return {
    status: "ok",
    asof: `${thisYear}년 ${latest === "11014" ? "3분기" : "사업"} 기준`,
    historic_range: `${thisYear - 3}~${thisYear - 1}`,
    reports: valid.length,
    corp_code,
    marketCap, // ✅ 추가됨
    data: Object.fromEntries(valid.map((v) => [v.year, v])),
  };
}
