import { analyzeValuation } from "@/lib/financialAnalyzer";
import { analyzeRisk } from "@/lib/riskAnalyzer";

export async function buildReport(fusedData: any, priceSeries: any[], marketCap: number) {
  try {
    // 1️⃣ Valuation 계산
    const valuation = analyzeValuation(fusedData, marketCap);

    // 2️⃣ Risk 분석 (수정된 부분: 뉴스 데이터 자리에 빈 배열 [] 추가)
    // 리포트 텍스트 생성용이므로 뉴스는 생략하고 재무 리스크만 봅니다.
    const risk = await analyzeRisk(fusedData, []);

    // 3️⃣ 텍스트 생성 (Commentary)
    const valuationText = `PER: ${valuation.PER} | PBR: ${valuation.PBR} | ROE: ${valuation.ROE} | 영업이익률: ${valuation.OPM}`;
    
    let riskText = `부채비율: ${risk.debt_ratio.toFixed(1)}%`;
    if (risk.alert === "위험 (KILL)") riskText += " (⚠️ 위험 경고)";

    return {
      fundamental: {
        Valuation: {
          PER: valuation.PER,
          PBR: valuation.PBR,
          ROE: valuation.ROE,
          ROA: valuation.ROA,
          OPM: valuation.OPM,
          FCF_Yield: valuation.FCF_Yield,
          Score: valuation.score.toString()
        },
        Commentary: valuationText
      },
      risk: {
        ...risk,
        commentary: riskText
      }
    };

  } catch (e) {
    console.error("ReportBuilder Error:", e);
    return {
      fundamental: null,
      risk: null,
      error: String(e)
    };
  }
}