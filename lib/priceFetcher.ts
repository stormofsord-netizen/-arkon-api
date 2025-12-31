// app/lib/priceFetcher.ts
import axios from "axios";

export async function fetchMarketData(ticker: string) {
  console.log(`[KRX] Fetching data for ${ticker} ...`);

  const authKey = process.env.KRX_AUTH_KEY;
  if (!authKey) {
    console.error("[KRX❌] Missing KRX_AUTH_KEY");
    return { price: 0, marketCap: 0, history: [] };
  }

  // KRX에서 사용하는 8자리 코드 변환
  const isuSrtCd = ticker.padStart(8, "0");
  const url = "http://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd";
  const headers = { AUTH_KEY: authKey };
  const today = new Date();
  const yester = new Date(today);
  yester.setDate(today.getDate() - 1);
  const basDd = yester.toISOString().slice(0, 10).replace(/-/g, "");

  try {
    // KRX API 호출
    const { data } = await axios.get(url, {
      headers,
      params: { basDd, isuSrtCd },
      timeout: 10000,
    });

    if (!data || !data.OutBlock_1) {
      console.warn(`[KRX❌] No data returned for ${ticker}`);
      return { price: 0, marketCap: 0, history: [] };
    }

    const record = data.OutBlock_1[0];
    const price = Number(record.TDD_CLSPRC || 0);
    const shares = Number(record.LIST_SHRS || 0);
    const marketCap = Number(record.MKTCAP || price * shares);

    console.log(
      `[KRX✅] ${ticker} | Price: ${price.toLocaleString()} | Shares: ${shares.toLocaleString()} | MarketCap: ${marketCap.toLocaleString()}`
    );

    return { price, marketCap, history: [] };
  } catch (err: any) {
    console.error(`[KRX❌] ${ticker}: ${err.message}`);
    return { price: 0, marketCap: 0, history: [] };
  }
}
