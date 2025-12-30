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

    // 값 찾기 헬퍼 (공백 제거 후 비교)
    const findAmount = (list: any[], ids: string[], names: string[]) => {
      // 1. ID로 찾기
      let item = list.find((x: any) => ids.includes(x.account_id));
      // 2. 이름으로 찾기 (정확히 일치 or 포함)
      if (!item) {
        item = list.find((x: any) => {
          const cleanName = x.account_nm?.replace(/\s/g, "") || "";
          return names.some(n => cleanName === n || cleanName.includes(n));
        });
      }
      return item ? Number(String(item.amount || item.thstrm_amount || "0").replace(/,/g, "")) : 0;
    };

    // 1. 자산 & 부채 가져오기 (가장 명확한 항목)
    const assets = findAmount(bs, ["ifrs-full_Assets"], ["자산총계", "자산"]);
    const liabilities = findAmount(bs, ["ifrs-full_Liabilities"], ["부채총계", "부채"]);

    // 2. 🔥 [핵심] 자본총계 = 자산 - 부채 (계산으로 산출)
    // 항목을 찾다가 '자본금'을 가져오는 실수를 원천 차단함
    let equity = assets - liabilities;

    // 만약 계산값이 이상하면(0 이하), 기존 방식으로 백업 시도
    if (equity <= 0) {
       equity = findAmount(bs, ["ifrs-full_EquityAttributableToOwnersOfParent", "ifrs-full_Equity"], ["자본총계", "지배기업소유주지분"]);
    }

    // 손익 & 현금흐름
    const netIncome = findAmount(is, ["ifrs-full_ProfitLossAttributableToOwnersOfParent", "ifrs-full_ProfitLoss"], ["당기순이익(지배)", "당기순이익", "순이익"]);
    const revenue = findAmount(is, ["ifrs-full_Revenue"], ["매출액", "영업수익"]);
    const op = findAmount(is, ["dart_OperatingIncomeLoss"], ["영업이익"]);
    const ocf = findAmount(cf, ["ifrs-full_CashFlowsFromUsedInOperatingActivities"], ["영업활동현금흐름"]);
    const capex = findAmount(cf, ["ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"], ["유형자산의취득"]);

    // 계산 로직
    if (netIncome > 0 && marketCap > 0) result.per = (marketCap / netIncome).toFixed(2);
    if (equity > 0 && marketCap > 0) result.pbr = (marketCap / equity).toFixed(2);
    if (equity > 0) result.roe = ((netIncome / equity) * 100).toFixed(2) + "%";
    if (assets > 0) result.roa = ((netIncome / assets) * 100).toFixed(2) + "%";
    if (revenue > 0) result.opm = ((op / revenue) * 100).toFixed(2) + "%";
    
    const fcf = ocf - Math.abs(capex);
    if (marketCap > 0) result.fcf_yield = ((fcf / marketCap) * 100).toFixed(2) + "%";

    // 점수 산정
    let score = 5;
    const perVal = parseFloat(result.per);
    const pbrVal = parseFloat(result.pbr);
    
    if (perVal > 0 && perVal < 20) score += 2; // 성장주 감안 범위 확대
    if (pbrVal > 0 && pbrVal < 5) score += 2;
    result.score = score;

  } catch (e) {
    console.error("Valuation Error:", e);
  }

  return result;
}