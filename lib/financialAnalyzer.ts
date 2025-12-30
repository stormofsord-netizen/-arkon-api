export function analyzeValuation(fusedData: any, marketCap: number) {
  const result = {
    per: "N/A", pbr: "N/A", roe: "N/A", roa: "N/A", opm: "N/A", fcf_yield: "N/A",
    score: 0, asof: "최신 데이터 기준"
  };

  try {
    const years = Object.keys(fusedData).map(Number).sort((a, b) => b - a);
    const latestYear = years[0];
    if (!latestYear) return result;

    const data = fusedData[latestYear];
    const bs = data.BS || [];
    const is = data.IS || [];
    const cf = data.CF || [];

    // 🛠️ [GPT 제안] 매핑 강화 함수
    const findAmount = (list: any[], ids: string[], names: string[]) => {
      let item = list.find((x: any) => ids.includes(x.account_id));
      if (!item) {
        // 공백 제거 후 비교 (정확도 향상)
        item = list.find((x: any) => names.some(n => x.account_nm?.replace(/\s/g, "") === n));
      }
      return item ? Number(String(item.amount || item.thstrm_amount || "0").replace(/,/g, "")) : 0;
    };

    // 자본총계 매핑 강화 (모든 변형 커버)
    const equity = findAmount(bs,
      ["ifrs-full_EquityAttributableToOwnersOfParent", "ifrs-full_Equity", "ifrs-full_OwnersEquity"],
      ["자본총계", "지배기업소유주지분", "Equity", "자기자본", "자본"]
    );

    const liabilities = findAmount(bs, ["ifrs-full_Liabilities"], ["부채총계"]);
    const assets = findAmount(bs, ["ifrs-full_Assets"], ["자산총계"]);
    const revenue = findAmount(is, ["ifrs-full_Revenue"], ["매출액"]);
    const op = findAmount(is, ["dart_OperatingIncomeLoss"], ["영업이익"]);
    const netIncome = findAmount(is,
      ["ifrs-full_ProfitLossAttributableToOwnersOfParent", "ifrs-full_ProfitLoss"],
      ["당기순이익(지배)", "당기순이익", "순이익"]
    );

    const ocf = findAmount(cf, ["ifrs-full_CashFlowsFromUsedInOperatingActivities"], ["영업활동현금흐름"]);
    const capex = findAmount(cf, ["ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"], ["유형자산의취득"]);

    // 계산
    if (netIncome > 0 && marketCap > 0) result.per = (marketCap / netIncome).toFixed(2);
    if (equity > 0 && marketCap > 0) result.pbr = (marketCap / equity).toFixed(2);
    if (equity > 0) result.roe = ((netIncome / equity) * 100).toFixed(2) + "%";
    if (assets > 0) result.roa = ((netIncome / assets) * 100).toFixed(2) + "%";
    if (revenue > 0) result.opm = ((op / revenue) * 100).toFixed(2) + "%";

    const fcf = ocf - Math.abs(capex);
    if (marketCap > 0) result.fcf_yield = ((fcf / marketCap) * 100).toFixed(2) + "%";

    // 점수
    let score = 5;
    const perVal = parseFloat(result.per);
    const pbrVal = parseFloat(result.pbr);
    if (perVal > 0 && perVal < 15) score += 2;
    if (pbrVal > 0 && pbrVal < 3) score += 2;
    
    result.score = score;

  } catch (e) {
    console.error("Valuation Error:", e);
  }

  return result;
}