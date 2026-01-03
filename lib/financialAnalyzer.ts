// lib/financialAnalyzer.ts

/**
 * analyzeValuation(fused, marketCap, parsed?)
 * - parsed가 있으면(=dartHandler가 이미 숫자로 확정한 값) 그걸 최우선으로 사용
 * - parsed가 없을 때만 fused에서 키워드로 추출
 */
export function analyzeValuation(fused: any, marketCap: number, parsed?: any) {
  try {
    // ⚡ 진단 로그 (이걸 보면 모든 게 명확해집니다)
    console.log(`[VALUATION DEBUG] parsed=${parsed ? "EXISTS" : "NULL"}`);
    if (parsed) {
      console.log(`[VALUATION DEBUG] parsed.OperatingIncome=${parsed.OperatingIncome}, parsed.Revenue=${parsed.Revenue}`);
    }

    // ✅ 0) parsed 우선 소스 (네 로그의 [DART PARSED] 값들이 여기 들어있어야 정상)
    const parsedNums = normalizeParsed(parsed);
    console.log(`[VALUATION DEBUG] parsedNums.operatingIncome=${parsedNums.operatingIncome}, parsedNums.revenue=${parsedNums.revenue}`);

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

      console.log(`[Valuation✅] fused map→rows forced: rows=${dataList.length}`);
    }

    const hasRows = Array.isArray(dataList) && dataList.length > 0;

    // ✅ 3) rows 기반 picker(only fallback용)
    const pickFromRows = (opts: { exact?: string[]; contains?: string[]; exclude?: string[] }) => {
      if (!hasRows) return { name: null as string | null, value: 0 };

      const exact = (opts.exact ?? []).map(norm);
      const contains = (opts.contains ?? []).map(norm);
      const exclude = (opts.exclude ?? []).map(norm);

      let item =
        dataList.find((x: any) => {
          const name = norm(x?.account_nm ?? x?.account_name ?? "");
          if (!name) return false;
          if (exclude.some((ex) => name.includes(ex))) return false;
          return exact.includes(name);
        }) ?? null;

      if (!item && contains.length > 0) {
        item =
          dataList.find((x: any) => {
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

    // ✅ 4) 최종 숫자 결정: parsed 우선, 없으면 rows에서
    const assets =
      parsedNums.assets ??
      pickFromRows({ exact: ["자산총계"], contains: ["자산"], exclude: ["유동자산", "비유동자산"] }).value;

    const liabilities =
      parsedNums.liabilities ??
      pickFromRows({ exact: ["부채총계"], contains: ["부채"], exclude: ["유동부채", "비유동부채"] }).value;

    // equity는 parsed가 있으면 그걸 신뢰. 없으면 자본총계 exact → 그래도 이상하면 assets-liabilities
    const equityFromRows = pickFromRows({
      exact: ["자본총계"],
      contains: [],
      exclude: ["자본금", "기타자본", "기타불입자본", "기타포괄손익누계액"],
    }).value;

    const equityRaw = parsedNums.equity ?? equityFromRows;
    const equityFallback = assets > 0 ? assets - liabilities : 0;

    // ✅ sanity check: equity가 너무 작으면(자본금 오탐 케이스) assets-liab로 교정
    const finalEquity =
      equityRaw > 0 && equityFallback > 0 && equityRaw < equityFallback * 0.3
        ? equityFallback
        : equityRaw > 0
          ? equityRaw
          : equityFallback;

    const revenue =
      parsedNums.revenue ??
      pickFromRows({ exact: ["매출액"], contains: ["영업수익"], exclude: ["기타수익", "금융수익"] }).value;

    const operatingIncome =
      parsedNums.operatingIncome ??
      pickFromRows({ exact: ["영업이익"], contains: [], exclude: [] }).value;

    const ocf =
      parsedNums.ocf ??
      pickFromRows({ exact: ["영업활동현금흐름"], contains: ["영업활동으로인한현금흐름"], exclude: [] }).value;

    // netIncome도 parsed 우선. 없으면 '당기순이익' → '분기순이익' 순서
    const netIncomeFromRowsPrimary = pickFromRows({
      exact: ["당기순이익"],
      contains: ["지배기업소유주지분순이익", "지배주주순이익"],
      exclude: ["기본주당이익", "희석주당이익"],
    }).value;

    const netIncomeFromRowsFallback =
      netIncomeFromRowsPrimary > 0
        ? 0
        : pickFromRows({
            exact: ["분기순이익"],
            contains: ["순이익"],
            exclude: ["기본주당이익", "희석주당이익"],
          }).value;

    const netIncome = parsedNums.netIncome ?? (netIncomeFromRowsPrimary > 0 ? netIncomeFromRowsPrimary : netIncomeFromRowsFallback);

    console.log(
      `[Valuation✅] final picks | netIncome=${netIncome} equity=${finalEquity} assets=${assets} liab=${liabilities} revenue=${revenue} op=${operatingIncome} ocf=${ocf} (parsed=${parsedNums._used ? "YES" : "NO"})`
    );

    // ✅ 계산
    const per = netIncome > 0 ? (marketCap / netIncome).toFixed(2) : "N/A";
    const pbr = finalEquity > 0 ? (marketCap / finalEquity).toFixed(2) : "N/A";
    const roe = finalEquity > 0 ? ((netIncome / finalEquity) * 100).toFixed(2) + "%" : "N/A";
    const roa = assets > 0 ? ((netIncome / assets) * 100).toFixed(2) + "%" : "N/A";
    const opm = revenue > 0 ? ((operatingIncome / revenue) * 100).toFixed(2) + "%" : "N/A";
    const fcf_yield = marketCap > 0 ? ((ocf / marketCap) * 100).toFixed(2) + "%" : "N/A";

    const score = [per !== "N/A", pbr !== "N/A", roe !== "N/A", opm !== "N/A"].filter(Boolean).length * 2.5;

    console.log(`[Valuation✅] rows=${hasRows ? dataList.length : 0} | PER=${per} | PBR=${pbr} | ROE=${roe} | OPM=${opm} | FCF=${fcf_yield}`);

    return {
      per,
      pbr,
      roe,
      roa,
      opm,
      fcf_yield,
      score,
      asof: "최신 데이터 기준",

      PER: per,
      PBR: pbr,
      ROE: roe,
      ROA: roa,
      OPM: opm,
      FCF_Yield: fcf_yield,
      Score: score,
    };
  } catch (e) {
    console.error("[Valuation ERROR]", e);
    return emptyResult("오류 발생");
  }
}

/* ---------------- helpers ---------------- */

function normalizeParsed(parsed: any): {
  _used: boolean;
  assets: number | null;
  equity: number | null;
  liabilities: number | null;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ocf: number | null;
} {
  if (!parsed || typeof parsed !== "object") {
    return {
      _used: false,
      assets: null,
      equity: null,
      liabilities: null,
      revenue: null,
      operatingIncome: null,
      netIncome: null,
      ocf: null,
    };
  }

  // dartHandler 쪽 키 네이밍이 바뀔 수 있으니 넓게 대응
  const assets = pickNum(parsed, ["Assets", "assets", "asset", "자산총계"]);
  let equity = pickNum(parsed, ["Equity", "equity", "자본총계"]);
  const liabilities = pickNum(parsed, ["Liabilities", "liabilities", "부채총계"]);
  const revenue = pickNum(parsed, ["Revenue", "revenue", "매출", "매출액"]);
  let operatingIncome = pickNum(parsed, ["OperatingIncome", "operatingIncome", "영업이익"]); // let으로 변경
  const netIncome = pickNum(parsed, ["NetIncome", "netIncome", "당기순이익", "순이익"]);
  const ocf = pickNum(parsed, ["OCF", "ocf", "영업활동현금흐름"]);

  // ✅ [NEW] Sanity Check: OperatingIncome > Revenue 감지 시 강제 0
  // 이 부분이 OPM 160% 문제를 해결하는 핵심 로직입니다.
  if (
    Number.isFinite(operatingIncome as any) &&
    Number.isFinite(revenue as any) &&
    (operatingIncome as number) > 0 &&
    (revenue as number) > 0 &&
    (operatingIncome as number) > (revenue as number)
  ) {
    console.warn(
      `[Valuation✅] SANITY CHECK: OperatingIncome (${operatingIncome}) > Revenue (${revenue}). ` +
        `This is physically impossible. Forcing OperatingIncome = 0 to prevent OPM hallucination.`
    );
    operatingIncome = 0;
  }

  // ✅ Equity Sanity Check (기존)
  // Equity가 '자본금'으로 오염되는 케이스가 있어서(=너 로그처럼 Equity가 수십억 수준)
  // Assets/Liabilities가 동시에 있으면 assets-liabilities로 sanity 교정해서 상위 모듈들(RISK 포함)도 안전하게 만든다.
  const assetsOK = Number.isFinite(assets as any);
  const liabOK = Number.isFinite(liabilities as any);
  const eqOK = Number.isFinite(equity as any);

  if (assetsOK && liabOK) {
    const eqFallback = (assets as number) - (liabilities as number);

    // eqFallback이 정상 범위(>0)일 때만 적용
    if (Number.isFinite(eqFallback) && eqFallback > 0) {
      // equity가 너무 작으면(자본금 오탐) → 교정
      if (!eqOK || (equity as number) <= 0 || (equity as number) < eqFallback * 0.3) {
        const before = eqOK ? equity : NaN;
        equity = eqFallback;
        console.log(
          `[Valuation✅] normalizeParsed equity corrected: before=${Number.isFinite(before as any) ? before : "N/A"} → after=${equity} (assets-liab=${eqFallback})`
        );
      }
    }
  }

  const used = [assets, equity, liabilities, revenue, operatingIncome, netIncome, ocf].some(
    (v) => typeof v === "number" && Number.isFinite(v)
  );

  return {
    _used: used,
    assets: Number.isFinite(assets as any) ? (assets as number) : null,
    equity: Number.isFinite(equity as any) ? (equity as number) : null,
    liabilities: Number.isFinite(liabilities as any) ? (liabilities as number) : null,
    revenue: Number.isFinite(revenue as any) ? (revenue as number) : null,
    operatingIncome: Number.isFinite(operatingIncome as any) ? (operatingIncome as number) : null,
    netIncome: Number.isFinite(netIncome as any) ? (netIncome as number) : null,
    ocf: Number.isFinite(ocf as any) ? (ocf as number) : null,
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

/**
 * fused 어떤 구조든 "재무 row 배열"을 찾아 반환
 */
function extractFinancialRows(input: any): any[] {
  if (Array.isArray(input)) {
    if (looksLikeFinancialRowArray(input)) return input;
    for (const it of input) {
      const found = extractFinancialRows(it);
      if (found.length) return found;
    }
    return [];
  }

  if (input && typeof input === "object") {
    if (Array.isArray((input as any).list) && looksLikeFinancialRowArray((input as any).list)) {
      return (input as any).list;
    }
    if (Array.isArray((input as any).data) && looksLikeFinancialRowArray((input as any).data)) {
      return (input as any).data;
    }

    for (const v of Object.values(input)) {
      const found = extractFinancialRows(v);
      if (found.length) return found;
    }
  }

  return [];
}

function looksLikeFinancialRowArray(arr: any[]): boolean {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const sample = arr.slice(0, 10);
  return sample.some((x) => {
    if (!x || typeof x !== "object") return false;
    const hasName = typeof (x as any).account_nm === "string" || typeof (x as any).account_name === "string";
    const hasAmount =
      (x as any).thstrm_amount !== undefined || (x as any).amount !== undefined || (x as any).value !== undefined;
    return hasName && hasAmount;
  });
}

function isPlainObject(v: any): boolean {
  return v && typeof v === "object" && !Array.isArray(v);
}

function norm(s: any): string {
  return String(s ?? "").replace(/\s/g, "").trim();
}

function pickAmountSmart(v: any): any {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" || typeof v === "string") return v;

  if (typeof v === "object" && !Array.isArray(v)) {
    const keys = Object.keys(v as any);
    const yearKeys = keys.filter((k) => /^\d{4}$/.test(k));
    if (yearKeys.length > 0 && yearKeys.length === keys.length) {
      const latestYear = yearKeys.sort((a, b) => Number(b) - Number(a))[0];
      return (v as any)[latestYear];
    }
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

function emptyResult(msg: string) {
  return {
    per: "N/A",
    pbr: "N/A",
    roe: "N/A",
    roa: "N/A",
    opm: "N/A",
    fcf_yield: "N/A",
    score: 0,
    asof: msg,

    PER: "N/A",
    PBR: "N/A",
    ROE: "N/A",
    ROA: "N/A",
    OPM: "N/A",
    FCF_Yield: "N/A",
    Score: 0,
  };
}
