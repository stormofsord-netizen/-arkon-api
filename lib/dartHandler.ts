// app/lib/dartHandler.ts
import { getCorpCodeByTicker } from "./corpMap";
import { fetchMarketData } from "./priceFetcher"; // ✅ 추가됨

export interface DartDataset {
  corp_code: string;
  ticker: string;
  marketCap: number; // ✅ 실시간 시총
  price: number;     // ✅ 실시간 주가
  data: any;         // DART 재무 데이터
  history: any[];    // ✅ 차트 데이터
}

export async function fetchFundamentalsFusion(ticker: string): Promise<DartDataset | null> {
  // 1. Corp Code 찾기
  const corp_code = await getCorpCodeByTicker(ticker);
  if (!corp_code) return null;

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("DART_API_KEY is missing");

  // 2. DART 데이터 가져오기 (병렬 처리로 속도 향상)
  // (여기서는 3Q와 사업보고서를 동시에 찔러봅니다)
  const url3Q = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${apiKey}&corp_code=${corp_code}&bsns_year=2024&reprt_code=11013&fs_div=CFS`;
  const urlAnnual = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${apiKey}&corp_code=${corp_code}&bsns_year=2023&reprt_code=11011&fs_div=CFS`;

  // 3. 시장 데이터(가격) 가져오기 ✅
  const marketPromise = fetchMarketData(ticker);
  const dartPromise3Q = fetch(url3Q, { cache: 'no-store' }).then(r => r.json());
  const dartPromiseAnnual = fetch(urlAnnual, { cache: 'no-store' }).then(r => r.json());

  const [marketData, data3Q, dataAnnual] = await Promise.all([marketPromise, dartPromise3Q, dartPromiseAnnual]);

  // 4. 데이터 우선순위 결정 (3Q 성공하면 3Q, 아니면 Annual)
  let finalDartData = null;
  let reportYear = 2023;
  
  if (data3Q && data3Q.status === "000") {
    finalDartData = data3Q;
    reportYear = 2024;
  } else if (dataAnnual && dataAnnual.status === "000") {
    finalDartData = dataAnnual;
    reportYear = 2023;
  }

  // 5. 최종 데이터셋 구성
  // 시장 데이터가 없으면(에러나면) 안전하게 0 처리 (LOCK 걸리도록)
  const safePrice = marketData?.price || 0;
  const safeMarketCap = marketData?.marketCap || 0;
  const safeHistory = marketData?.history || [];

  return {
    corp_code,
    ticker,
    marketCap: safeMarketCap,
    price: safePrice,
    history: safeHistory,
    data: {
      [reportYear]: {
        reprt: reportYear === 2024 ? "11013" : "11011",
        data: finalDartData?.list || []
      }
    }
  };
}