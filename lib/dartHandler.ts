// app/lib/dartHandler.ts
import axios from "axios";
import { getCorpCodeByTicker } from "./corpMap";
import { fetchMarketData } from "./priceFetcher";
import { fetchCompanyNews } from "./newsFetcher";

console.log(
  "[DART DEBUG] DART_API_KEY:",
  process.env.DART_API_KEY ? "✅ Loaded" : "❌ Missing"
);

export interface DartDataset {
  corp_code: string;
  ticker: string;
  marketCap: number;
  price: number;
  data: any;
  history: any[];
  news: string[];
}

/**
 * 📊 DART 재무 데이터 파싱 (계정코드 기반)
 * - fnlttSinglAcntAll(list[]) 응답에서 account_id 기준으로 필요한 값만 추출
 */
function parseFinancialData(accountList: any[]) {
  // 표준 계정 매핑
  const accountMap: { [key: string]: string } = {
    "ifrs-full_Revenue": "Revenue", // 매출액
    "dart_OperatingIncomeLoss": "OperatingIncome", // 영업이익
    "ifrs-full_ProfitLossAttributableToOwnersOfParent": "NetIncome", // 지배주주순이익
    "ifrs-full_Equity": "Equity", // 자본
    "ifrs-full_Assets": "Assets", // 자산
    "ifrs-full_Liabilities": "Liabilities", // 부채
    "ifrs-full_CashFlowsFromUsedInOperatingActivities": "OCF", // 영업현금흐름
  };

  const result: { [key: string]: number } = {};

  if (Array.isArray(accountList)) {
    for (const item of accountList) {
      const accountId = item.account_id;
      const raw = item.thstrm_amount ?? "0";
      const amount = Number(String(raw).replace(/,/g, "").trim()) || 0;

      if (accountMap[accountId]) {
        const key = accountMap[accountId];
        result[key] = amount;

        console.log(
          `[DART PARSED] ${key}: ${amount.toLocaleString("ko-KR")}`
        );
      }
    }
  }

  return result;
}

/**
 * DART API 호출(axios)
 * - fetch가 프록시(127.0.0.1:443)로 빨려 들어가는 문제를 피하려고 axios로 전환
 */
async function fetchDartFinancialList(params: {
  apiKey: string;
  corp_code: string;
  bsns_year: string;
  reprt_code: string;
  fs_div: "CFS" | "OFS";
}) {
  // ✅ 실제로 많이 쓰는 단일계정 전체 API
  const endpoint = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";

  const { data } = await axios.get(endpoint, {
    params: {
      crtfc_key: params.apiKey,
      corp_code: params.corp_code,
      bsns_year: params.bsns_year,
      reprt_code: params.reprt_code,
      fs_div: params.fs_div,
    },
    timeout: 15000,
    // axios는 기본적으로 no-cache 의미 없지만, 혹시 몰라 헤더로 넣음
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
    // 일부 환경에서 압축/프록시 꼬임 방지용(필요시)
    decompress: true,
  });

  return data;
}

/**
 * DART + KRX + NEWS 데이터를 융합하여 반환
 */
export async function fetchFundamentalsFusion(
  ticker: string
): Promise<DartDataset | null> {
  try {
    // 1️⃣ 기업 코드 조회
    const corp_code = await getCorpCodeByTicker(ticker);
    if (!corp_code) {
      console.error(`[DART❌] No corp_code found for ticker: ${ticker}`);
      return null;
    }

    // 2️⃣ DART API 키 확인
    const apiKey = process.env.DART_API_KEY;
    if (!apiKey) {
      console.error("[DART❌] Missing DART_API_KEY (check .env.local)");
      throw new Error("DART_API_KEY missing");
    }

    // 3️⃣ 시도할 보고서 코드 리스트 (최신 우선)
    const reportCodes = [
      { code: "11014", label: "1분기보고서" },
      { code: "11013", label: "3분기보고서" },
      { code: "11012", label: "반기보고서" },
      { code: "11011", label: "사업보고서" },
    ];

    let finalDartData: any = null;
    let parsedFinancials: any = {};
    let reportYear = 2024;
    let usedReportCode = "";

    // 4️⃣ 여러 보고서 순차 시도 (axios)
    for (const { code, label } of reportCodes) {
      try {
        const res = await fetchDartFinancialList({
          apiKey,
          corp_code,
          bsns_year: String(reportYear),
          reprt_code: code,
          fs_div: "CFS",
        });

        if (
          res &&
          res.status === "000" &&
          Array.isArray(res.list) &&
          res.list.length > 0
        ) {
          finalDartData = res;
          usedReportCode = code;

          // ✨ 핵심: 재무 데이터 파싱
          parsedFinancials = parseFinancialData(res.list);

          console.log(
            `[DART✅] ${label} (${code}) data found: ${res.list.length} rows`
          );
          console.log(
            `[DART PARSED] Revenue: ${parsedFinancials.Revenue ?? "N/A"}`
          );
          console.log(
            `[DART PARSED] OperatingIncome: ${
              parsedFinancials.OperatingIncome ?? "N/A"
            }`
          );
          console.log(
            `[DART PARSED] NetIncome: ${parsedFinancials.NetIncome ?? "N/A"}`
          );
          break;
        } else {
          console.log(
            `[DART⚠️] ${label} (${code}) has no data. status=${res?.status ?? "N/A"}`
          );
        }
      } catch (err: any) {
        // axios 에러 메시지
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          String(err ?? "unknown");
        console.error(`[DART ERROR] ${label} fetch failed:`, msg);
      }
    }

    // 5️⃣ 백업: 전년도 사업보고서
    if (!finalDartData) {
      try {
        const fallback = await fetchDartFinancialList({
          apiKey,
          corp_code,
          bsns_year: "2023",
          reprt_code: "11011",
          fs_div: "CFS",
        });

        if (
          fallback &&
          fallback.status === "000" &&
          Array.isArray(fallback.list) &&
          fallback.list.length > 0
        ) {
          finalDartData = fallback;
          parsedFinancials = parseFinancialData(fallback.list);
          usedReportCode = "11011";
          reportYear = 2023;
          console.log(`[DART✅] Fallback to 2023 사업보고서`);
        } else {
          console.warn(
            `[DART❌] No valid data from DART for ${ticker} (fallback). status=${
              fallback?.status ?? "N/A"
            }`
          );
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          String(err ?? "unknown");
        console.error(`[DART ERROR] Fallback fetch failed:`, msg);
      }
    }

    // 6️⃣ KRX 시세 및 뉴스 병렬 수집
    const [marketData, newsData] = await Promise.all([
      fetchMarketData(ticker).catch((err) => {
        console.error(`[DART⚠️] Market data fetch failed: ${err}`);
        return { price: 0, marketCap: 0, history: [] };
      }),
      fetchCompanyNews(ticker).catch(() => []),
    ]);

    // 디버그 로그
    console.log(
      `[DART SUMMARY] corp=${corp_code} | year=${reportYear} | reprt=${usedReportCode} | rows=${
        finalDartData?.list?.length ?? 0
      }`
    );

    // 7️⃣ 최종 결과 반환 (파싱된 재무정보 포함)
    return {
      corp_code,
      ticker,
      marketCap: marketData.marketCap || 0,
      price: marketData.price || 0,
      history: marketData.history || [],
      news: newsData || [],
      data: {
        [reportYear]: {
          reprt: usedReportCode,
          raw: finalDartData?.list || [],
          parsed: parsedFinancials, // ✅ 파싱된 재무정보
        },
      },
    };
  } catch (error) {
    console.error(`[DART ERROR] fetchFundamentalsFusion(${ticker}) failed:`, error);
    return null;
  }
}
