/**
 * financialAnalyzer.ts
 * - 누적 실적 데이터에서 PER, PBR, ROE, YoY, CAGR 계산
 */

export function analyzeValuation(dataset: any, marketCap: number) {
  const years = Object.keys(dataset).map(Number).sort((a, b) => a - b);
  const latest = Math.max(...years);
  const prev = latest - 1;

  const cur = dataset[latest];
  const prevData = dataset[prev];

  const revenue = Number(cur.IS?.Revenue ?? 0);
  const op = Number(cur.IS?.OP ?? 0);
  const ni = Number(cur.IS?.NI ?? 0);
  const equity = Number(cur.BS?.Equity ?? 0);

  const per = ni > 0 ? marketCap / ni : null;
  const pbr = equity > 0 ? marketCap / equity : null;
  const roe = equity > 0 ? (ni / equity) * 100 : null;

  let yoy = null;
  if (prevData?.IS?.Revenue)
    yoy = ((revenue - prevData.IS.Revenue) / prevData.IS.Revenue) * 100;

  // CAGR (3년 기준)
  let cagr = null;
  const oldest = dataset[years[0]];
  if (oldest?.IS?.Revenue)
    cagr =
      ((revenue / oldest.IS.Revenue) ** (1 / (years.length - 1)) - 1) * 100;

  return {
    Revenue: revenue,
    OperatingIncome: op,
    NetIncome: ni,
    Equity: equity,
    PER: per,
    PBR: pbr,
    ROE: roe,
    YoY: yoy,
    CAGR: cagr,
  };
}
