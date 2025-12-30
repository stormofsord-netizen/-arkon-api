// app/lib/dartHandler.ts
import { getCorpCodeByTicker } from "./corpMap";
import { fetchMarketData } from "./priceFetcher";
import { fetchCompanyNews } from "./newsFetcher"; // ✅ 추가됨

export interface DartDataset {
  corp_code: string;
  ticker: string;
  marketCap: number;
  price: number;
  data: any;
  history: any[];
  news: string[]; // ✅ 추가됨
}

export async function fetchFundamentalsFusion(ticker: string): Promise<DartDataset | null> {
  const corp_code = await getCorpCodeByTicker(ticker);
  if (!corp_code) return null;

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("DART_API_KEY is missing");

  // DART URL
  const url3Q = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${apiKey}&corp_code=${corp_code}&bsns_year=2024&reprt_code=11013&fs_div=CFS`;
  const urlAnnual = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${apiKey}&corp_code=${corp_code}&bsns_year=2023&reprt_code=11011&fs_div=CFS`;

  // ✅ 병렬 실행: 마켓데이터 + DART(3Q/Annual) + 뉴스
  const [marketData, data3Q, dataAnnual, newsData] = await Promise.all([
    fetchMarketData(ticker),
    fetch(url3Q, { cache: 'no-store' }).then(r => r.json().catch(() => null)),
    fetch(urlAnnual, { cache: 'no-store' }).then(r => r.json().catch(() => null)),
    fetchCompanyNews(ticker) // ✅ 뉴스 가져오기
  ]);

  // 데이터 우선순위 결정
  let finalDartData = null;
  let reportYear = 2023;
  
  if (data3Q && data3Q.status === "000") {
    finalDartData = data3Q;
    reportYear = 2024;
  } else if (dataAnnual && dataAnnual.status === "000") {
    finalDartData = dataAnnual;
    reportYear = 2023;
  }

  return {
    corp_code,
    ticker,
    marketCap: marketData?.marketCap || 0,
    price: marketData?.price || 0,
    history: marketData?.history || [],
    news: newsData || [], // ✅ 뉴스 데이터 전달
    data: {
      [reportYear]: {
        reprt: reportYear === 2024 ? "11013" : "11011",
        data: finalDartData?.list || []
      }
    }
  };
}