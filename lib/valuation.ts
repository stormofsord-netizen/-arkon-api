// lib/valuation.ts

export type ValuationInput = {
  ticker: string;
  price?: number | null; // 현재가
  marketCap?: number | null; // 시가총액 (원)
  sharesOutstanding?: number | null; // 상장주식수(주)
  fundamentals?: {
    revenue?: number | null; // 매출 (원)
    operatingIncome?: number | null; // 영업이익 (원)
    netIncome?: number | null; // 순이익 (원)
    equity?: number | null; // 자본총계 (원)
    assets?: number | null; // 자산총계 (원)
    liabilities?: number | null; // 부채총계 (원)
  } | null;
};

export type ValuationOutput = {
  ticker: string;
  inputs: {
    price: number | null;
    marketCap: number | null;
    sharesOutstanding: number | null;
  };
  metrics: {
    per: number | null;
    pbr: number | null;
    roe: number | null; // %
    psr: number | null;
    opm: number | null; // 영업이익률 %
    npm: number | null; // 순이익률 %
    debtRatio: number | null; // 부채비율 %
    bps: number | null;
    eps: number | null;
    sps: number | null;
  };
  notes: string[];
};

/**
 * 핵심 원칙:
 * - "계산 가능한 것만" 계산 (없으면 null)
 * - 분모가 0이거나 음수면 보수적으로 null 처리(특히 PER)
 */
export function computeValuation(input: ValuationInput): ValuationOutput {
  const notes: string[] = [];

  const price = toNum(input.price);
  const marketCap = toNum(input.marketCap);
  const shares = toNum(input.sharesOutstanding);

  const f = input.fundamentals ?? null;
  const revenue = toNum(f?.revenue);
  const op = toNum(f?.operatingIncome);
  const ni = toNum(f?.netIncome);
  const equity = toNum(f?.equity);
  const assets = toNum(f?.assets);
  const liab = toNum(f?.liabilities);

  // 상장주식수 없을 때: marketCap과 price로 역산 (가능한 경우만)
  let sharesResolved = shares;
  if (!sharesResolved && price && marketCap) {
    sharesResolved = safeDiv(marketCap, price);
    if (sharesResolved) notes.push("상장주식수는 시가총액/현재가로 역산했습니다.");
  }

  // EPS/BPS/SPS
  const eps = sharesResolved && ni ? safeDiv(ni, sharesResolved) : null;
  const bps = sharesResolved && equity ? safeDiv(equity, sharesResolved) : null;
  const sps = sharesResolved && revenue ? safeDiv(revenue, sharesResolved) : null;

  // PER: 순이익이 0 이하이면 의미 왜곡이 커서 null 처리
  const per =
    price && eps && eps > 0 ? safeDiv(price, eps) : null;

  // PBR
  const pbr =
    price && bps && bps > 0 ? safeDiv(price, bps) : null;

  // ROE(%)
  const roe =
    ni && equity && equity !== 0 ? safeMul(safeDiv(ni, equity), 100) : null;

  // PSR
  const psr =
    marketCap && revenue && revenue > 0 ? safeDiv(marketCap, revenue) : null;

  // 마진(%)
  const opm =
    op && revenue && revenue !== 0 ? safeMul(safeDiv(op, revenue), 100) : null;

  const npm =
    ni && revenue && revenue !== 0 ? safeMul(safeDiv(ni, revenue), 100) : null;

  // 부채비율(%): liabilities/equity
  const debtRatio =
    liab && equity && equity !== 0 ? safeMul(safeDiv(liab, equity), 100) : null;

  // 데이터 누락 노트
  if (!price) notes.push("현재가(price)가 없어 밸류에이션 일부가 계산 불가입니다.");
  if (!marketCap) notes.push("시가총액(marketCap)이 없어 PSR 등이 계산 불가입니다.");
  if (!ni) notes.push("순이익(netIncome)이 없어 PER/ROE/NPM 등이 계산 불가입니다.");
  if (!equity) notes.push("자본총계(equity)가 없어 PBR/ROE/부채비율 등이 계산 불가입니다.");
  if (!revenue) notes.push("매출(revenue)이 없어 PSR/마진 등이 계산 불가입니다.");

  return {
    ticker: input.ticker,
    inputs: {
      price,
      marketCap,
      sharesOutstanding: sharesResolved,
    },
    metrics: {
      per: round(per),
      pbr: round(pbr),
      roe: round(roe),
      psr: round(psr),
      opm: round(opm),
      npm: round(npm),
      debtRatio: round(debtRatio),
      bps: round(bps),
      eps: round(eps),
      sps: round(sps),
    },
    notes,
  };
}

/* ---------- helpers ---------- */

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (!a || !b) return null;
  if (b === 0) return null;
  const v = a / b;
  return Number.isFinite(v) ? v : null;
}

function safeMul(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  const v = a * b;
  return Number.isFinite(v) ? v : null;
}

function round(v: number | null, digits = 4): number | null {
  if (v === null) return null;
  const p = Math.pow(10, digits);
  return Math.round(v * p) / p;
}
