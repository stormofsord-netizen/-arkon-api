// lib/financialAnalyzer.ts

/**
 * analyzeValuation(fused, marketCap, parsed?)
 * - parsed가 있으면(=dartHandler가 이미 숫자로 확정한 값) 그걸 최우선으로 사용
 * - parsed가 없을 때만 fused에서 키워드로 추출
 */
export function analyzeValuation(fused: any, marketCap: number, parsed?: any) {
  try {
    // ⚡ 진단 로그
    console.log(`[VALUATION DEBUG] parsed=${parsed ? "EXISTS" : "NULL"}`);

    // ✅ 0) parsed 우선 소스
    const parsedNums = normalizeParsed(parsed);

    // 1) "재무 row 배열" 추출 시도
    let dataList = extractFinancialRows(fused);

    // 2) fused가 객체(map) 형태면 rows로 강제 변환
    if ((!Array.isArray(dataList) || dataList.length === 0) && isPlainObject(fused)) {
      const entries = Object.entries(fused);
      dataList = entries
        .map(([k, v]) => ({
          account_nm: String(k),
          amount: toNumber(pickAmountSmart(v)),
        }))
        .filter((row) => row.account_nm.length > 0);
    }

    const hasRows = Array.isArray(dataList) && dataList.length > 0;

    // ✅ 3) rows 기반 picker (Fallback)
    const pickFromRows = (opts: { exact?: string[]; contains?: string[]; exclude?: string[] }) => {
      if (!hasRows) return { name: null as string | null, value: 0 };
      const exact = (opts.exact ?? []).map(norm);
      const contains = (opts.contains ?? []).map(norm);
      const exclude = (opts.exclude ?? []).map(norm);

      let item = dataList.find((x: any) => {
        const name = norm(x?.account_nm ?? x?.account_name ?? "");
        if (!name) return false;
        if (exclude.some((ex) => name.includes(ex))) return false;
        return exact.includes(name);
      }) ?? null;

      if (!item && contains.length > 0) {
        item = dataList.find((x: any) => {
            const name = norm(x?.account_nm ?? x?.account_name ?? "");
            if (!name) return false;
            if (exclude.some((ex) => name.includes(ex))) return false;
            return contains.some((kw) => name.includes(kw));
          }) ?? null;
      }
      const raw = item?.thstrm_amount ?? item?.amount ?? item?.value ?? "0";
      const n = toNumber(raw);
      return { name: item ? String(item.account_nm ?? item.account_name ?? "") : null, value: Number.isFinite(n) ? n : 0 };
    };

    // ✅ 4) 최종 숫자 결정 (여기서 let을 사용해 수정 가능하게 변경)
    const assets = parsedNums.assets ?? pickFromRows({ exact: ["자산총계"], contains: ["자산"], exclude: ["유동자산", "비유동자산"] }).value;
    const liabilities = parsedNums.liabilities ?? pickFromRows({ exact: ["부채총계"], contains: ["부채"], exclude: ["유동부채", "비유동부채"] }).value;
    
    // Equity 로직
    const equityFromRows = pickFromRows({ exact: ["자본총계"], contains: [], exclude: ["자본금", "기타자본", "기타불입자본", "기타포괄손익누계액"] }).value;
    const equityRaw = parsedNums.equity ?? equityFromRows;
    const equityFallback = assets > 0 ? assets - liabilities : 0;
    
    // Equity Sanity Check
    const finalEquity = equityRaw > 0 && equityFallback > 0 && equityRaw < equityFallback * 0.3
        ? equityFallback
        : equityRaw > 0 ? equityRaw : equityFallback;

    // Revenue & OperatingIncome & NetIncome & OCF
    let revenue = parsedNums.revenue ?? pickFromRows({ exact: ["매출액"], contains: ["영업수익"], exclude: ["기타수익", "금융수익"] }).value;
    let operatingIncome = parsedNums.operatingIncome ?? pickFromRows({ exact: ["영업이익"], contains: [], exclude: [] }).value;
    const ocf = parsedNums.ocf ?? pickFromRows({ exact: ["영업활동현금흐름"], contains: ["영업활동으로인한현금흐름"], exclude: [] }).value;

    const netIncomeFromRowsPrimary = pickFromRows({ exact: ["당기순이익"], contains: ["지배기업소유주지분순이익"], exclude: ["기본주당이익"] }).value;
    const netIncomeFromRowsFallback = netIncomeFromRowsPrimary > 0 ? 0 : pickFromRows({ exact: ["분기순이익"], contains: ["순이익"], exclude: ["기본주당이익"] }).value;
    const netIncome = parsedNums.netIncome ?? (netIncomeFromRowsPrimary > 0 ? netIncomeFromRowsPrimary : netIncomeFromRowsFallback);

    // 🚨🚨🚨 [CRITICAL FIX] 🚨🚨🚨
    // 데이터 소스가 어디든(parsed든 rows든) 최종 단계에서 한 번 더 검사!
    // 영업이익이 매출보다 크면 100% 데이터 오류이므로 영업이익을 0으로 강제 초기화
    if (operatingIncome > 0 && revenue > 0 && operatingIncome > revenue) {
      console.warn(`[Valuation🚨] FINAL SANITY TRIGGERED: OperatingIncome(${operatingIncome}) > Revenue(${revenue}). Forcing OP to 0.`);
      operatingIncome = 0;
    }

    console.log(`[Valuation✅] FINAL: Net=${netIncome} Eq=${finalEquity} Rev=${revenue} OP=${operatingIncome}`);

    // ✅ 계산
    const per = netIncome > 0 ? (marketCap / netIncome).toFixed(2) : "N/A";
    const pbr = finalEquity > 0 ? (marketCap / finalEquity).toFixed(2) : "N/A";
    const roe = finalEquity > 0 ? ((netIncome / finalEquity) * 100).toFixed(2) + "%" : "N/A";
    const roa = assets > 0 ? ((netIncome / assets) * 100).toFixed(2) + "%" : "N/A";
    
    // 이제 operatingIncome이 0으로 보정되었으므로 OPM은 "0.00%"가 나오거나 정상 계산됨
    const opm = revenue > 0 ? ((operatingIncome / revenue) * 100).toFixed(2) + "%" : "N/A";
    const fcf_yield = marketCap > 0 ? ((ocf / marketCap) * 100).toFixed(2) + "%" : "N/A";

    const score = [per !== "N/A", pbr !== "N/A", roe !== "N/A", opm !== "N/A"].filter(Boolean).length * 2.5;

    return {
      per, pbr, roe, roa, opm, fcf_yield, score, asof: "최신 데이터 기준",
      PER: per, PBR: pbr, ROE: roe, ROA: roa, OPM: opm, FCF_Yield: fcf_yield, Score: score,
    };
  } catch (e) {
    console.error("[Valuation ERROR]", e);
    return emptyResult("오류 발생");
  }
}

/* ---------------- helpers (기존과 동일하지만 간소화) ---------------- */
function normalizeParsed(parsed: any) {
    // (기존 로직 유지하되, 여기서도 체크하고 위에서도 체크하면 2중 안전장치)
    if (!parsed || typeof parsed !== "object") return { _used: false, assets: null, equity: null, liabilities: null, revenue: null, operatingIncome: null, netIncome: null, ocf: null };
    
    const assets = pickNum(parsed, ["Assets", "assets", "asset", "자산총계"]);
    const equity = pickNum(parsed, ["Equity", "equity", "자본총계"]);
    const liabilities = pickNum(parsed, ["Liabilities", "liabilities", "부채총계"]);
    const revenue = pickNum(parsed, ["Revenue", "revenue", "매출", "매출액"]);
    const operatingIncome = pickNum(parsed, ["OperatingIncome", "operatingIncome", "영업이익"]);
    const netIncome = pickNum(parsed, ["NetIncome", "netIncome", "당기순이익", "순이익"]);
    const ocf = pickNum(parsed, ["OCF", "ocf", "영업활동현금흐름"]);

    return {
        _used: true,
        assets: isFin(assets) ? assets : null,
        equity: isFin(equity) ? equity : null,
        liabilities: isFin(liabilities) ? liabilities : null,
        revenue: isFin(revenue) ? revenue : null,
        operatingIncome: isFin(operatingIncome) ? operatingIncome : null,
        netIncome: isFin(netIncome) ? netIncome : null,
        ocf: isFin(ocf) ? ocf : null,
    };
}

function pickNum(obj: any, keys: string[]): number {
  for (const k of keys) {
    if (obj?.[k] !== undefined) {
      const n = toNumber(obj[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return NaN;
}

function extractFinancialRows(input: any): any[] {
  if (Array.isArray(input)) {
    if (looksLikeFinancialRowArray(input)) return input;
    for (const it of input) { const found = extractFinancialRows(it); if (found.length) return found; }
    return [];
  }
  if (input && typeof input === "object") {
    if (Array.isArray((input as any).list) && looksLikeFinancialRowArray((input as any).list)) return (input as any).list;
    if (Array.isArray((input as any).data) && looksLikeFinancialRowArray((input as any).data)) return (input as any).data;
    for (const v of Object.values(input)) { const found = extractFinancialRows(v); if (found.length) return found; }
  }
  return [];
}

function looksLikeFinancialRowArray(arr: any[]): boolean {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.slice(0, 10).some((x) => x && typeof x === "object" && (typeof (x as any).account_nm === "string" || typeof (x as any).account_name === "string") && ((x as any).thstrm_amount !== undefined || (x as any).amount !== undefined || (x as any).value !== undefined));
}

function isPlainObject(v: any): boolean { return v && typeof v === "object" && !Array.isArray(v); }
function norm(s: any): string { return String(s ?? "").replace(/\s/g, "").trim(); }
function pickAmountSmart(v: any): any {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object" && !Array.isArray(v)) {
    const keys = Object.keys(v as any);
    const yearKeys = keys.filter((k) => /^\d{4}$/.test(k));
    if (yearKeys.length > 0) return (v as any)[yearKeys.sort((a, b) => Number(b) - Number(a))[0]];
  }
  return 0;
}
function toNumber(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function isFin(n: number) { return typeof n === 'number' && Number.isFinite(n); }
function emptyResult(msg: string) {
  return { per: "N/A", pbr: "N/A", roe: "N/A", roa: "N/A", opm: "N/A", fcf_yield: "N/A", score: 0, asof: msg, PER: "N/A", PBR: "N/A", ROE: "N/A", ROA: "N/A", OPM: "N/A", FCF_Yield: "N/A", Score: 0 };
}
