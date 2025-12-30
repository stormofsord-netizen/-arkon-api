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
    if (!latestYear) return riskReport;

    const data = fusedData[latestYear];
    const bs = data.BS || [];

    const findAmount = (ids: string[], names: string[]) => {
      let item = bs.find((x: any) => ids.includes(x.account_id));
      if (!item) {
        item = bs.find((x: any) => names.some(n => x.account_nm?.replace(/\s/g, "") === n));
      }
      return item ? Number(String(item.amount || item.thstrm_amount || "0").replace(/,/g, "")) : 0;
    };

    const liabilities = findAmount(["ifrs-full_Liabilities"], ["부채총계"]);
    const equity = findAmount(
      ["ifrs-full_EquityAttributableToOwnersOfParent", "ifrs-full_Equity", "ifrs-full_OwnersEquity"],
      ["자본총계", "지배기업소유주지분", "Equity", "자기자본", "자본"]
    );

    if (equity > 0) {
      riskReport.debt_ratio = (liabilities / equity) * 100;
      if (riskReport.debt_ratio > 200) {
        riskReport.score -= 2;
        riskReport.factors.push(`⚠️ 부채비율 높음 (${riskReport.debt_ratio.toFixed(1)}%)`);
      }
    }
  } catch (e) {
    console.error("Risk Calc Error:", e);
  }

  // 뉴스 리스크
  const BAD = ["횡령", "배임", "거래정지", "상장폐지", "압수수색", "불성실", "적자전환", "하한가", "유상증자"];
  const badCount = (newsTitles || []).filter(n => BAD.some(k => n.includes(k))).length;
  if (badCount > 0) {
    riskReport.score -= badCount * 2;
    riskReport.factors.push(`⚠️ 악재 뉴스 ${badCount}건 감지`);
  }

  if (riskReport.score <= 4) riskReport.alert = "위험 (KILL)";
  else if (riskReport.score <= 7) riskReport.alert = "주의 (CAUTION)";
  else riskReport.alert = "안정 (GO)";

  return riskReport;
}