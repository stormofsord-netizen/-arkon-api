export async function analyzeRisk(fusedData: any, newsTitles: string[]) {
  const riskReport = {
    score: 10,
    alert: "안정",
    factors: [] as string[],
    news_summary: [] as string[],
    debt_ratio: 0,
  };

  try {
    const years = Object.keys(fusedData).map(Number).sort((a, b) => b - a);
    const latestYear = years[0];

    if (latestYear) {
      const data = fusedData[latestYear];
      const bs = data.BS || [];
      
      const findAmount = (ids: string[], names: string[]) => {
        let item = bs.find((x: any) => ids.includes(x.account_id));
        if (!item) {
          item = bs.find((x: any) => {
            const cleanName = x.account_nm?.replace(/\s/g, "") || "";
            return names.some(n => cleanName === n || cleanName.includes(n));
          });
        }
        return item ? Number(String(item.amount || item.thstrm_amount || "0").replace(/,/g, "")) : 0;
      };

      // 1. 자산, 부채 찾기
      const assets = findAmount(["ifrs-full_Assets"], ["자산총계", "자산"]);
      const liabilities = findAmount(["ifrs-full_Liabilities"], ["부채총계", "부채"]);
      
      // 2. 🔥 [핵심] 자본 = 자산 - 부채
      let equity = assets - liabilities;
      
      // 백업 로직 (혹시나 해서 남겨둠)
      if (equity <= 0) {
         equity = findAmount(["ifrs-full_Equity"], ["자본총계"]);
      }

      if (equity > 0) {
        riskReport.debt_ratio = (liabilities / equity) * 100;
        
        // 부채비율 리스크 판정 (200% 초과 시)
        if (riskReport.debt_ratio > 200) {
          riskReport.score -= 2;
          riskReport.factors.push(`⚠️ 부채비율 높음 (${riskReport.debt_ratio.toFixed(1)}%)`);
        }
      } else {
         // 자본이 0 이하(자본잠식)인 경우
         riskReport.score -= 5;
         riskReport.factors.push("🚨 자본잠식 의심 (Equity <= 0)");
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

  if (riskReport.score <= 4) riskReport.alert = "위험 (KILL)";
  else if (riskReport.score <= 7) riskReport.alert = "주의 (CAUTION)";
  else riskReport.alert = "안정 (GO)";

  return riskReport;
}