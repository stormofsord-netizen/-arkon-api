// app/lib/newsFetcher.ts

export async function fetchCompanyNews(ticker: string): Promise<string[]> {
  try {
    // ⚠️ 네이버 JSON API가 아닌 HTML 페이지가 반환되므로, HTML에서 제목만 추출
    const url = `https://m.stock.naver.com/domestic/stock/${ticker}/news`;

    const res = await fetch(url, { cache: "no-store" });
    const html = await res.text();

    // 🧩 정규식으로 뉴스 제목 추출
    const titles = Array.from(html.matchAll(/"title":"([^"]+)"/g)).map(m => m[1]);
    return titles.slice(0, 10);
  } catch (e) {
    console.error(`[NewsFetcher] Error fetching news for ${ticker}:`, e);
    return [];
  }
}