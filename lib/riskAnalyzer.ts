export async function analyzeRisk(fusedData: any, newsTitles: string[]) {
  const riskReport = {
    score: 10,
    alert: "안정",
    factors: [] as string[],
    news_summary: [] as string[],
    debt_ratio: 0,
    equity_ratio: 0,
    current_ratio: 0
  };

  try {
    const years = Object.keys(fusedData).map(Number).sort((a, b) => b - a);
    const latestYear = years[0];

    if (latestYear) {
      const data = fusedData[latestYear];
      const bs = data.BS || [];
      
      const findAmount = (keywords: string[]) => {
        const item = bs.find((x: any) => {
          const id = (x.account_id || "").toLowerCase();
          const name = (x.account_nm || "").replace(/\s/g, "");
          return keywords.some(k => id.includes(k) || name === k);
        });
        return item ? Number(String(item.amount || item.thstrm_amount || "0").replace(/,/g, "")) : 0;
      };

      const assets = findAmount(["assets", "totalassets", "자산총계", "자산"]);
      const liabilities = findAmount(["liabilities", "totalliabilities", "부채총계", "부채"]);
      const currentAssets = findAmount(["currentassets", "유동자산"]);
      const currentLiabilities = findAmount(["currentliabilities", "유동부채"]);

      // 🔥 자본 = 자산 - 부채 (강제 계산)
      let equity = 0;
      if (assets > 0 && liabilities > 0) {
        equity = assets - liabilities;
      }

      // 지표 계산
      if (equity > 0) {
        riskReport.debt_ratio = (liabilities / equity) * 100;
        riskReport.equity_ratio = (equity / assets) * 100; // 자본비율 추가
      }
      
      if (currentLiabilities > 0) {
        riskReport.current_ratio = (currentAssets / currentLiabilities) * 100;
      }

      // 리스크 판정 로직
      if (riskReport.debt_ratio > 200) {
        riskReport.score -= 3;
        riskReport.factors.push(`⚠️ 부채비율 높음 (${riskReport.debt_ratio.toFixed(1)}%)`);
      }
      
      if (riskReport.current_ratio > 0 && riskReport.current_ratio < 100) {
        riskReport.score -= 2;
        riskReport.factors.push(`⚠️ 유동비율 취약 (${riskReport.current_ratio.toFixed(1)}%)`);
      }
    }
  } catch (e) {
    console.error("Risk Calc Error:", e);
  }

  // 뉴스 분석
  const BAD_KEYWORDS = ["횡령", "배임", "거래정지", "상장폐지", "불성실", "압수수색", "적자전환", "하한가", "유상증자"];
  let badNewsCount = 0;
  
  const detectedNews = (newsTitles || []).filter(title => {
    if (BAD_KEYWORDS.some(k => title.includes(k))) {
      badNewsCount++;
      return true;
    }
    return false;
  }).slice(0, 5);

  riskReport.news_summary = detectedNews.length > 0 ? detectedNews : ["특이사항 없음"];
  if (badNewsCount > 0) {
    riskReport.score -= (badNewsCount * 2);
    riskReport.factors.push(`⚠️ 악재성 뉴스 ${badNewsCount}건 감지`);
  }

  // 등급
  if (riskReport.score <= 4) riskReport.alert = "위험 (KILL)";
  else if (riskReport.score <= 7) riskReport.alert = "주의 (CAUTION)";
  else riskReport.alert = "안정 (GO)";

  return riskReport;
}