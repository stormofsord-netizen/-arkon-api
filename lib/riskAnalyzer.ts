// app/lib/riskAnalyzer.ts

export async function analyzeRisk(fusedData: any, newsTitles: string[]) {
  const riskReport = {
    score: 10, // 10점 만점
    alert: "안정", // 안정, 주의, 위험
    factors: [] as string[],
    news_summary: [] as string[]
  };

  // 1. 뉴스 키워드 분석 (R-Checklist)
  const BAD_KEYWORDS = ["횡령", "배임", "거래정지", "상장폐지", "불성실", "압수수색", "적자전환", "하한가", "유상증자", "감자"];
  const ISSUE_KEYWORDS = ["급등", "신고가", "수주", "M&A", "인수", "공급계약"];

  let badNewsCount = 0;
  const detectedNews = newsTitles.filter(title => {
    // 악재 키워드 체크
    if (BAD_KEYWORDS.some(k => title.includes(k))) {
      badNewsCount++;
      return true;
    }
    // 주요 이슈 체크 (리포트에는 포함하되 점수 차감은 안 함)
    if (ISSUE_KEYWORDS.some(k => title.includes(k))) {
      return true;
    }
    return false;
  }).slice(0, 5); // 최대 5개만 노출

  riskReport.news_summary = detectedNews.length > 0 ? detectedNews : ["특이사항 없음"];

  if (badNewsCount > 0) {
    riskReport.score -= (badNewsCount * 2);
    riskReport.factors.push(`⚠️ 악재성 키워드 뉴스 ${badNewsCount}건 감지`);
  }

  // 2. 재무 리스크 분석 (부채비율)
  // (fusedData 구조에 따라 다를 수 있으나, 안전장치 추가)
  try {
    const latestYear = Object.keys(fusedData).sort().pop();
    if (latestYear) {
        const bs = fusedData[latestYear]?.BS || {};
        // 자산, 부채가 숫자로 있으면 계산
        // (여기서는 간단한 예시 로직만 포함)
    }
  } catch (e) {
    // 재무 데이터 파싱 실패 시 패스
  }

  // 3. 최종 등급 판정
  if (riskReport.score <= 4) riskReport.alert = "위험 (KILL)";
  else if (riskReport.score <= 7) riskReport.alert = "주의 (CAUTION)";
  else riskReport.alert = "안정 (GO)";

  return riskReport;
}