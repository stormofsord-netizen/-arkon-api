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

    // ✅ [핵심] 엄격한 매핑 & 숫자 변환 함수
    const findAmount = (list: any[], ids: string[], names: string[]) => {
      // 1. 표준 ID로 찾기 (가장 정확)
      let item = list.find((x: any) => ids.includes(x.account_id));
      
      // 2. 이름으로 찾기 (공백 제거 후 정확히 일치하는 것만)
      if (!item) {
        item = list.find((x: any) => names.includes(x.account_nm?.replace(/\s/g, "")));
      }
      
      if (!item) return 0;

      // 3. 숫자 변환 (쉼표 제거)
      const val = Number(String(item.amount || item.thstrm_amount || "0").replace(/,/g, ""));
      
      // 4. 단위 보정 (DART API는 기본 원 단위지만, 만약 100조가 넘어가면 단위 확인 필요. 
      // 여기서는 표준인 '원' 단위로 간주하되, 너무 작으면(백만 미만) 1000 곱하는 안전장치만 고려)
      return val; 
    };

    // 👉 여기가 중요: "자본금"이 걸리지 않게 "자본총계", "지배기업소유주지분"만 명시
    const equity = findAmount(bs, ["ifrs-full_EquityAttributableToOwnersOfParent", "ifrs-full_Equity"], ["자본총계", "지배기업소유주지분"]);
    const assets = findAmount(bs, ["ifrs-full_Assets"], ["자산총계"]);
    
    // 손익계산서
    const netIncome = findAmount(is, ["ifrs-full_ProfitLossAttributableToOwnersOfParent", "ifrs-full_ProfitLoss"], ["당기순이익(지배)", "당기순이익"]);
    const revenue = findAmount(is, ["ifrs-full_Revenue"], ["매출액"]);
    const op = findAmount(is, ["dart_OperatingIncomeLoss"], ["영업이익"]);
    
    // 현금흐름
    const ocf = findAmount(cf, ["ifrs-full_CashFlowsFromUsedInOperatingActivities"], ["영업활동현금흐름"]);
    const capex = findAmount(cf, ["ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"], ["유형자산의취득"]);

    // ✅ 계산 로직 (시장 시총과 DART 데이터 단위가 맞아야 함)
    // marketCap: 원 단위 / equity: 원 단위
    
    if (netIncome > 0 && marketCap > 0) result.per = (marketCap / netIncome).toFixed(2);
    if (equity > 0 && marketCap > 0) result.pbr = (marketCap / equity).toFixed(2);
    if (equity > 0) result.roe = ((netIncome / equity) * 100).toFixed(2) + "%";
    if (assets > 0) result.roa = ((netIncome / assets) * 100).toFixed(2) + "%";
    if (revenue > 0) result.opm = ((op / revenue) * 100).toFixed(2) + "%";
    
    // FCF Yield
    const fcf = ocf - Math.abs(capex);
    if (marketCap > 0) result.fcf_yield = ((fcf / marketCap) * 100).toFixed(2) + "%";

    // 점수 산정
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