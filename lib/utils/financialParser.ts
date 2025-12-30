export function parseIS(data: any[]) {
  const r: Record<string, number> = {};
  for (const row of data) {
    const nm = row.account_nm;
    if (nm.includes("매출")) r.Revenue = row.thstrm_amount * 1;
    if (nm.includes("영업이익")) r.OP = row.thstrm_amount * 1;
    if (nm.includes("당기순이익")) r.NI = row.thstrm_amount * 1;
  }
  return r;
}

export function parseBS(data: any[]) {
  const r: Record<string, number> = {};
  for (const row of data) {
    const nm = row.account_nm;
    if (nm.includes("자산총계")) r.Assets = row.thstrm_amount * 1;
    if (nm.includes("부채총계")) r.Liabilities = row.thstrm_amount * 1;
    if (nm.includes("자본총계")) r.Equity = row.thstrm_amount * 1;
  }
  return r;
}

export function parseCF(data: any[]) {
  const r: Record<string, number> = {};
  for (const row of data) {
    const nm = row.account_nm;
    if (nm.includes("영업활동현금흐름")) r.OCF = row.thstrm_amount * 1;
    if (nm.includes("투자활동현금흐름")) r.CAPEX = row.thstrm_amount * 1;
  }
  if (r.OCF && r.CAPEX) r.FCF = r.OCF + r.CAPEX;
  return r;
}
