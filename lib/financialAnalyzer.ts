// lib/financialAnalyzer.ts

export function analyzeValuation(fused: any, marketCap: number) {
  try {
    // ✅ 어떤 구조든 내부에서 "재무 row 배열"을 찾아서 사용
    const dataList = extractFinancialRows(fused);

    if (!Array.isArray(dataList) || dataList.length === 0) {
      console.warn("[Valuation] ❌ No DART financial list found.");
      // 디버그용: fused 최상위 키라도 찍어두기
      try {
        console.warn("[Valuation] fused keys:", fused ? Object.keys(fused) : "null");
      } catch {}
      return emptyResult("데이터 없음");
    }

    // ✅ 이름 매칭 함수 (account_nm 기반)
    const findVal = (keywords: string[]) => {
      const item = dataList.find((x: any) => {
        const name = String(x?.account_nm ?? x?.account_name ?? "").replace(/\s/g, "");
        return keywords.some((kw) => name.includes(kw));
      });

      // ✅ amount / thstrm_amount / value 지원
      const raw = item?.thstrm_amount ?? item?.amount ?? item?.value ?? "0";
      const n = Number(String(raw).replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : 0;
    };

    // ✅ 주요 재무 항목 (키워드 매칭)
    const netIncome = findVal(["당기순이익", "순이익", "지배기업소유주지분순이익", "지배주주순이익"]);

    // ⚠️ "자본" 단독 키워드는 너무 넓어서 오탐(자본금/자본잉여금 등) 위험 → 제거
    const equity = findVal([
      "자본총계",
      "지배기업소유주지분",
      "지배기업의소유주에게귀속되는자본",
      "지배기업소유주에게귀속되는자본",
    ]);

    const assets = findVal(["자산총계", "자산"]);
    const liabilities = findVal(["부채총계", "부채"]);
    const revenue = findVal(["매출액", "영업수익"]);
    const operatingIncome = findVal(["영업이익"]);
    const ocf = findVal(["영업활동현금흐름", "영업활동으로인한현금흐름"]);

    const finalEquity = equity > 0 ? equity : assets - liabilities;

    // ✅ 계산
    const per = netIncome > 0 ? (marketCap / netIncome).toFixed(2) : "N/A";
    const pbr = finalEquity > 0 ? (marketCap / finalEquity).toFixed(2) : "N/A";
    const roe = finalEquity > 0 ? ((netIncome / finalEquity) * 100).toFixed(2) + "%" : "N/A";
    const roa = assets > 0 ? ((netIncome / assets) * 100).toFixed(2) + "%" : "N/A";
    const opm = revenue > 0 ? ((operatingIncome / revenue) * 100).toFixed(2) + "%" : "N/A";
    const fcf_yield = marketCap > 0 ? ((ocf / marketCap) * 100).toFixed(2) + "%" : "N/A";

    const score = [per !== "N/A", pbr !== "N/A", roe !== "N/A", opm !== "N/A"].filter(Boolean).length * 2.5;

    console.log(
      `[Valuation✅] rows=${dataList.length} | PER=${per} | PBR=${pbr} | ROE=${roe} | OPM=${opm} | FCF=${fcf_yield}`
    );

    // ✅ 소문자(내부) + ✅ 대문자(리포트 템플릿 호환) 동시 제공
    return {
      per,
      pbr,
      roe,
      roa,
      opm,
      fcf_yield,
      score,
      asof: "최신 데이터 기준",

      // 템플릿 호환 키
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

/**
 * ✅ fused 어떤 구조든 "재무 row 배열"을 찾아 반환
 * - row 조건: (account_nm 존재) AND (amount 또는 thstrm_amount 같은 금액 필드 존재)
 */
function extractFinancialRows(input: any): any[] {
  // 1) 입력이 이미 배열이면 검사 후 반환
  if (Array.isArray(input)) {
    if (looksLikeFinancialRowArray(input)) return input;
    // 배열인데 row가 아닌 경우(예: reports 배열) 내부도 탐색
    for (const it of input) {
      const found = extractFinancialRows(it);
      if (found.length) return found;
    }
    return [];
  }

  // 2) 객체면 흔한 케이스 먼저 체크
  if (input && typeof input === "object") {
    // fused.list
    if (Array.isArray((input as any).list) && looksLikeFinancialRowArray((input as any).list)) {
      return (input as any).list;
    }
    // fused.data
    if (Array.isArray((input as any).data) && looksLikeFinancialRowArray((input as any).data)) {
      return (input as any).data;
    }

    // 3) 재귀 탐색: 모든 value를 훑어서 첫 번째로 매칭되는 배열을 반환
    for (const v of Object.values(input)) {
      const found = extractFinancialRows(v);
      if (found.length) return found;
    }
  }

  return [];
}

function looksLikeFinancialRowArray(arr: any[]): boolean {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  // 샘플 몇 개만 보고 판단
  const sample = arr.slice(0, 10);
  return sample.some((x) => {
    if (!x || typeof x !== "object") return false;
    const hasName =
      typeof (x as any).account_nm === "string" || typeof (x as any).account_name === "string";
    const hasAmount =
      (x as any).thstrm_amount !== undefined || (x as any).amount !== undefined || (x as any).value !== undefined;
    return hasName && hasAmount;
  });
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

    // ✅ 리포트 템플릿 호환
    PER: "N/A",
    PBR: "N/A",
    ROE: "N/A",
    ROA: "N/A",
    OPM: "N/A",
    FCF_Yield: "N/A",
    Score: 0,
  };
}
