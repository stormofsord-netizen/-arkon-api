// app/lib/financialAnalyzer.ts

export function analyzeValuation(fused: any, marketCap: number) {
  try {
    // ✅ 다양한 구조 지원 (배열/직접형/data/list/연도형 + dart.raw)
    let dataList: any[] = [];

    // 1) fused 자체가 배열인 경우
    if (Array.isArray(fused)) {
      dataList = fused;
    }

    // 2) fused.data / fused.list
    else if (fused?.data && Array.isArray(fused.data)) {
      dataList = fused.data;
    } else if (fused?.list && Array.isArray(fused.list)) {
      dataList = fused.list;
    }

    // 3) fused.raw (혹시 raw를 바로 넘긴 경우)
    else if (fused?.raw && Array.isArray(fused.raw)) {
      dataList = fused.raw;
    }

    // 4) 연도 키 감지: {2024:{data:[...]}} 또는 {2024:{raw:[...]}}
    else if (fused && typeof fused === "object") {
      const yearKey =
        Object.keys(fused).find((k) => Array.isArray(fused?.[k]?.data)) ||
        Object.keys(fused).find((k) => Array.isArray(fused?.[k]?.raw));

      if (yearKey) {
        if (Array.isArray(fused?.[yearKey]?.data)) dataList = fused[yearKey].data;
        else if (Array.isArray(fused?.[yearKey]?.raw)) dataList = fused[yearKey].raw;
      }
    }

    // 5) ✅ "전체 리포트 객체" 형태: { dart: { 2024: { raw:[...] } } }
    if ((!Array.isArray(dataList) || dataList.length === 0) && fused?.dart) {
      const dartObj = fused.dart;

      const yearKey =
        Object.keys(dartObj).find((k) => Array.isArray(dartObj?.[k]?.raw)) ||
        Object.keys(dartObj).find((k) => Array.isArray(dartObj?.[k]?.data));

      if (yearKey) {
        if (Array.isArray(dartObj?.[yearKey]?.raw)) dataList = dartObj[yearKey].raw;
        else if (Array.isArray(dartObj?.[yearKey]?.data)) dataList = dartObj[yearKey].data;
      }
    }

    if (!Array.isArray(dataList) || dataList.length === 0) {
      console.warn("[Valuation] ❌ No DART financial list found.");
      return emptyResult("데이터 없음");
    }

    // ✅ 이름 매칭 함수 (공백 제거 + 부분일치)
    const findVal = (keywords: string[]) => {
      const item = dataList.find((x) => {
        const name = String(x?.account_nm ?? "").replace(/\s/g, "");
        return keywords.some((kw) => name.includes(kw));
      });
      return item ? parseFloat(String(item.thstrm_amount ?? "0").replace(/,/g, "")) : 0;
    };

    // ✅ 주요 재무 항목
    const netIncome = findVal(["당기순이익", "순이익", "지배기업소유주지분순이익", "분기순이익"]);
    const equity = findVal(["자본총계", "지배기업의소유주에게귀속되는자본", "지배기업소유주지분", "지배기업소유주에게귀속되는자본"]);
    const assets = findVal(["자산총계", "자산"]);
    const liabilities = findVal(["부채총계", "부채"]);
    const revenue = findVal(["매출액", "영업수익"]);
    const operatingIncome = findVal(["영업이익"]);
    const ocf = findVal(["영업활동현금흐름"]);

    const finalEquity = equity > 0 ? equity : assets - liabilities;

    // ✅ 계산
    const per = netIncome > 0 ? (marketCap / netIncome).toFixed(2) : "N/A";
    const pbr = finalEquity > 0 ? (marketCap / finalEquity).toFixed(2) : "N/A";
    const roe = finalEquity > 0 ? ((netIncome / finalEquity) * 100).toFixed(2) + "%" : "N/A";
    const roa = assets > 0 ? ((netIncome / assets) * 100).toFixed(2) + "%" : "N/A";
    const opm = revenue > 0 ? ((operatingIncome / revenue) * 100).toFixed(2) + "%" : "N/A";
    const fcf_yield = marketCap > 0 ? ((ocf / marketCap) * 100).toFixed(2) + "%" : "N/A";

    const score =
      [per !== "N/A", pbr !== "N/A", roe !== "N/A", opm !== "N/A"].filter(Boolean).length * 2.5;

    console.log(
      `[Valuation✅] PER=${per} | PBR=${pbr} | ROE=${roe} | OPM=${opm} | FCF=${fcf_yield}`
    );

    // ✅ buildFullReport() 호환(대문자 키)까지 같이 제공
    return {
      // 소문자 (내부/기존)
      per,
      pbr,
      roe,
      roa,
      opm,
      fcf_yield,
      score,
      asof: "최신 데이터 기준",

      // 대문자 (리포트 템플릿 호환)
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
