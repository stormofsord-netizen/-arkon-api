// app/lib/newsFetcher.ts
// 네이버 금융 API를 이용해 종목 관련 최신 뉴스 제목을 가져옵니다.

export async function fetchCompanyNews(ticker: string): Promise<string[]> {
  try {
    // 네이버 모바일 증권 뉴스 API (최신 10개)
    // page=1&pageSize=10
    const url = `https://m.stock.naver.com/api/stock/${ticker}/news/real-time?page=1&pageSize=15`;
    
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();

    if (!Array.isArray(json)) {
      return [];
    }

    // 제목만 추출 (HTML 태그 제거 등 정제)
    const titles = json.map((item: any) => {
      // &quot; 같은 엔티티 제거 및 단순화
      let title = item.tit || "";
      title = title.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      return title;
    });

    return titles;

  } catch (e) {
    console.error(`[NewsFetcher] Error fetching news for ${ticker}:`, e);
    return [];
  }
}