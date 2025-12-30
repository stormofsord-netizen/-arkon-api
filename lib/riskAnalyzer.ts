export async function analyzeRisk(fusedData: any, newsTitles: string[]) {
  const riskReport = {
    score: 10,
    alert: "안정",
    factors: [] as string[],
    news_summary: [] as string[],
    debt_ratio: 0, // ✅ 부채비율 필드 추가 (초기값 0)
  };

  // 1️⃣ 재무 리스크 분석 (부채비율 계산)
  try {
    // fusedData에서 가장 최신 연도 찾기
    const years = Object.keys(fusedData).map(Number).sort((a, b) => b - a);
    const latestYear = years[0];

    if (latestYear) {
      const data = fusedData[latestYear];
      // BS(재무상태표)에서 자산/부채/자본 찾기 (계정과목명 매핑 시도)
      // fusedData 구조: { BS: [ { account_nm: "부채총계", amount: ... }, ... ] }
      const bs = data.BS || [];
      
      const findAmount = (names: string[]) => {
        const item = bs.find((x: any) => names.includes(x.account_nm) || names.includes(x.account_id));
        return item ? Number(item.amount || item.thstrm_amount || 0) : 0;
      };

      const liabilities = findAmount(["부채총계", "ifrs-full_Liabilities"]);
      const equity = findAmount(["자본총계", "ifrs-full_Equity"]);

      if (equity > 0) {
        riskReport.debt_ratio = (liabilities / equity) * 100;
        
        // 부채비율 리스크 판정
        if (riskReport.debt_ratio > 200) {
          riskReport.score -= 2;
          riskReport.factors.push(`⚠️ 부채비율 높음 (${riskReport.debt_ratio.toFixed(1)}%)`);
        }
      }
    }
  } catch (e) {
    console.error("Risk Calc Error:", e);
  }

  // 2️⃣ 뉴스 키워드 분석 (악재 감지)
  const BAD_KEYWORDS = ["횡령", "배임", "거래정지", "상장폐지", "불성실", "압수수색", "적자전환", "하한가", "유상증자", "감자"];
  const ISSUE_KEYWORDS = ["급등", "신고가", "수주", "M&A", "인수", "공급계약"];

  let badNewsCount = 0;
  
  // 뉴스 제목 필터링
  const detectedNews = (newsTitles || []).filter(title => {
    if (BAD_KEYWORDS.some(k => title.includes(k))) {
      badNewsCount++;
      return true;
    }
    if (ISSUE_KEYWORDS.some(k => title.includes(k))) {
      return true;
    }
    return false;
  }).slice(0, 5);

  riskReport.news_summary = detectedNews.length > 0 ? detectedNews : ["특이사항 없음"];

  if (badNewsCount > 0) {
    riskReport.score -= (badNewsCount * 2);
    riskReport.factors.push(`⚠️ 악재성 뉴스 ${badNewsCount}건 감지`);
  }

  // 3️⃣ 최종 등급 판정
  if (riskReport.score <= 4) riskReport.alert = "위험 (KILL)";
  else if (riskReport.score <= 7) riskReport.alert = "주의 (CAUTION)";
  else riskReport.alert = "안정 (GO)";

  return riskReport;
}