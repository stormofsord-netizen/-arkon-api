// app/lib/priceFetcher.ts
// 네이버 금융 API를 통해 실시간 시세와 차트 데이터를 가져옵니다.

export interface MarketData {
  price: number;       // 현재가
  shares: number;      // 상장주식수
  marketCap: number;   // 시가총액 (원)
  history: PriceCandle[]; // 일봉 데이터 (최근 1년)
}

export interface PriceCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchMarketData(ticker: string): Promise<MarketData | null> {
  try {
    // 1. 현재가 및 주식수 조회 (네이버 모바일 API)
    const basicUrl = `https://m.stock.naver.com/api/stock/${ticker}/basic`;
    const basicRes = await fetch(basicUrl, { cache: 'no-store' });
    const basicJson = await basicRes.json();

    if (!basicJson || !basicJson.closePrice) {
      console.error(`[PriceFetcher] No basic data for ${ticker}`);
      return null;
    }

    // 데이터 파싱 (문자열에 있는 콤마 제거)
    const closePrice = parseInt(basicJson.closePrice.replace(/,/g, ''), 10);
    const listedShares = parseInt(basicJson.stockInfo.listedSharesCount.replace(/,/g, ''), 10);
    const marketCap = closePrice * listedShares;

    // 2. 일봉 차트 데이터 조회 (365일치)
    // periodType=dayRange&range=365
    const chartUrl = `https://api.stock.naver.com/chart/domestic/item/${ticker}/day?periodType=dayRange&range=365`;
    const chartRes = await fetch(chartUrl, { cache: 'no-store' });
    const chartJson = await chartRes.json();

    let history: PriceCandle[] = [];
    
    if (Array.isArray(chartJson)) {
      history = chartJson.map((item: any) => ({
        date: item.localDate, // YYYYMMDD
        open: item.openPrice,
        high: item.highPrice,
        low: item.lowPrice,
        close: item.closePrice,
        volume: item.accumulatedTradingVolume
      }));
    }

    return {
      price: closePrice,
      shares: listedShares,
      marketCap: marketCap,
      history: history
    };

  } catch (e) {
    console.error(`[PriceFetcher] Error fetching data for ${ticker}:`, e);
    return null;
  }
}