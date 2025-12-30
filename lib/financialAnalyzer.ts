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

    // 🛠️ [광범위 매핑] ID 및 이름 정규화 검색
    const findAmount = (list: any[], keywords: string[]) => {
      // 1. ID나 이름에 키워드가 포함되면 가져옴
      const item = list.find((x: any) => {
        const id = (x.account_id || "").toLowerCase();
        const name = (x.account_nm || "").replace(/\s/g, "");
        return keywords.some(k => id.includes(k) || name === k);
      });
      
      return item ? Number(String(item.amount || item.thstrm_amount || "0").replace(/,/g, "")) : 0;
    };

    // 1. 자산 & 부채 (가능한 모든 ID/이름 패턴 총동원)
    const assets = findAmount(bs, ["assets", "totalassets", "자산총계", "자산"]);
    const liabilities = findAmount(bs, ["liabilities", "totalliabilities", "부채총계", "부채"]);

    // 2. 자본 계산 (계산 우선)
    let equity = 0;
    if (assets > 0 && liabilities > 0) {
      equity = assets - liabilities;
    } 
    
    // 계산 실패 시에만 직접 찾기 (단, '자본금'은 절대 제외)
    if (equity <= 0) {
       equity = findAmount(bs, ["equity", "owners", "지배기업소유주지분", "자본총계"]);
       // 만약 찾아낸 값이 너무 작으면(자산의 10% 미만) 자본금일 확률이 높으므로 무시
       if (assets > 0 && equity < assets * 0.1) equity = 0; 
    }

    // 손익 & 현금흐름
    const netIncome = findAmount(is, ["profitloss", "netincome", "당기순이익", "순이익"]);
    const revenue = findAmount(is, ["revenue", "sales", "매출액", "영업수익"]);
    const op = findAmount(is, ["operatingincome", "operatingprofit", "영업이익"]);
    const ocf = findAmount(cf, ["cashflowsfromusedinoperating", "영업활동현금흐름"]);
    const capex = findAmount(cf, ["purchaseofproperty", "유형자산의취득", "유형자산취득"]);

    // 계산 (안전장치: 0이면 N/A)
    if (netIncome > 0 && marketCap > 0) result.per = (marketCap / netIncome).toFixed(2);
    // PBR 계산 시 자본이 너무 작으면(오류면) 표기 안 함
    if (equity > 10000000000 && marketCap > 0) result.pbr = (marketCap / equity).toFixed(2); // 100억 이상일 때만
    
    if (equity > 0) result.roe = ((netIncome / equity) * 100).toFixed(2) + "%";
    if (assets > 0) result.roa = ((netIncome / assets) * 100).toFixed(2) + "%";
    if (revenue > 0) result.opm = ((op / revenue) * 100).toFixed(2) + "%";
    
    const fcf = ocf - Math.abs(capex);
    if (marketCap > 0) result.fcf_yield = ((fcf / marketCap) * 100).toFixed(2) + "%";

    // 점수 산정
    let score = 5;
    const perVal = parseFloat(result.per);
    const pbrVal = parseFloat(result.pbr);
    
    if (perVal > 0 && perVal < 25) score += 2;
    if (pbrVal > 0 && pbrVal < 5) score += 2;
    result.score = score;

  } catch (e) {
    console.error("Valuation Error:", e);
  }

  return result;
}