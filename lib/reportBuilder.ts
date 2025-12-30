import { analyzeValuation } from "@/lib/financialAnalyzer";
import { analyzeRisk } from "@/lib/riskAnalyzer";

export async function buildReport(fusedData: any, priceSeries: any[], marketCap: number) {
  try {
    // 1️⃣ Valuation 계산
    const valuation = analyzeValuation(fusedData, marketCap);

    // 2️⃣ Risk 분석
    const risk = await analyzeRisk(fusedData, []);

    // 3️⃣ 텍스트 생성 (Commentary)
    // 🛠️ [수정됨] 대문자(PER) -> 소문자(per)로 수정
    const valuationText = `PER: ${valuation.per} | PBR: ${valuation.pbr} | ROE: ${valuation.roe} | 영업이익률: ${valuation.opm}`;
    
    let riskText = `부채비율: ${risk.debt_ratio.toFixed(1)}%`;
    if (risk.alert === "위험 (KILL)") riskText += " (⚠️ 위험 경고)";

    return {
      fundamental: {
        Valuation: {
          // 🛠️ [수정됨] 값을 가져올 때는 소문자(valuation.per) 사용
          PER: valuation.per,
          PBR: valuation.pbr,
          ROE: valuation.roe,
          ROA: valuation.roa,
          OPM: valuation.opm,
          FCF_Yield: valuation.fcf_yield, // 보통 snake_case 사용됨
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