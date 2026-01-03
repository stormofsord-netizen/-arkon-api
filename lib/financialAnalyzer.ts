// lib/financialAnalyzer.ts

export function analyzeValuation(fused: any, marketCap: number, parsed?: any) {
  try {
    // 0. Parsed 정제
    const parsedNums = normalizeParsed(parsed);

    // 1. Rows 추출
    let dataList = extractFinancialRows(fused);
    
    // 2. Map -> Rows 변환
    if ((!Array.isArray(dataList) || dataList.length === 0) && isPlainObject(fused)) {
      dataList = Object.entries(fused)
        .map(([k, v]) => ({ account_nm: String(k), amount: toNumber(pickAmountSmart(v)) }))
        .filter((row) => row.account_nm.length > 0);
    }
    const hasRows = Array.isArray(dataList) && dataList.length > 0;

    // 3. Picker 함수
    const pickFromRows = (opts: { exact?: string[]; contains?: string[]; exclude?: string[] }) => {
      if (!hasRows) return { name: null, value: 0 };
      const exact = (opts.exact ?? []).map(norm);
      const contains = (opts.contains ?? []).map(norm);
      const exclude = (opts.exclude ?? []).map(norm);
      let item = dataList.find((x: any) => {
        const name = norm(x?.account_nm ?? x?.account_name ?? "");
        return name && !exclude.some(ex => name.includes(ex)) && exact.includes(name);
      });
      if (!item && contains.length > 0) {
        item = dataList.find((x: any) => {
          const name = norm(x?.account_nm ?? x?.account_name ?? "");
          return name && !exclude.some(ex => name.includes(ex)) && contains.some(kw => name.includes(kw));
        });
      }
      const raw = item?.thstrm_amount ?? item?.amount ?? item?.value ?? "0";
      const n = toNumber(raw);
      return { name: item ? String(item.account_nm ?? item.account_name ?? "") : null, value: Number.isFinite(n) ? n : 0 };
    };

    // 4. 값 추출
    const assets = parsedNums.assets ?? pickFromRows({ exact: ["자산총계"], contains: ["자산"], exclude: ["유동자산"] }).value;
    const liabilities = parsedNums.liabilities ?? pickFromRows({ exact: ["부채총계"], contains: ["부채"], exclude: ["유동부채"] }).value;
    
    // Equity
    const eqRows = pickFromRows({ exact: ["자본총계"], contains: [], exclude: ["자본금"] }).value;
    const eqRaw = parsedNums.equity ?? eqRows;
    const eqFallback = assets - liabilities;
    // 자본잠식/오류 보정
    const finalEquity = (eqRaw > 0 && eqFallback > 0 && eqRaw < eqFallback * 0.3) ? eqFallback : (eqRaw > 0 ? eqRaw : eqFallback);

    // 5. 핵심: 매출/영업이익 추출
    let revenue = parsedNums.revenue ?? pickFromRows({ exact: ["매출액"], contains: ["영업수익"], exclude: ["기타수익"] }).value;
    let operatingIncome = parsedNums.operatingIncome ?? pickFromRows({ exact: ["영업이익"], contains: [], exclude: [] }).value;
    const ocf = parsedNums.ocf ?? pickFromRows({ exact: ["영업활동현금흐름"], contains: ["영업활동"], exclude: [] }).value;
    const netIncome = parsedNums.netIncome ?? pickFromRows({ exact: ["당기순이익"], contains: ["순이익"], exclude: ["주당이익"] }).value;

    // 🚨🚨🚨 [DEBUGGING FIX] 🚨🚨🚨
    // 이 로그가 안 찍히면 코드가 안 바뀐 것임.
    const rawOp = operatingIncome;
    const rawRev = revenue;
    
    // 강제 보정 로직
    if (operatingIncome > 0 && revenue > 0 && operatingIncome > revenue) {
        operatingIncome = 0; // 매출보다 이익이 크면 0 처리
    }

    // 계산
    const per = netIncome > 0 ? (marketCap / netIncome).toFixed(2) : "N/A";
    const pbr = finalEquity > 0 ? (marketCap / finalEquity).toFixed(2) : "N/A";
    const roe = finalEquity > 0 ? ((netIncome / finalEquity) * 100).toFixed(2) + "%" : "N/A";
    const roa = assets > 0 ? ((netIncome / assets) * 100).toFixed(2) + "%" : "N/A";
    const opm = revenue > 0 ? ((operatingIncome / revenue) * 100).toFixed(2) + "%" : "N/A";
    const fcf_yield = marketCap > 0 ? ((ocf / marketCap) * 100).toFixed(2) + "%" : "N/A";
    const score = [per, pbr, roe, opm].filter(v => v !== "N/A").length * 2.5;

    return {
      per, pbr, roe, roa, opm, fcf_yield, score,
      asof: "최신 데이터 기준",
      PER: per, PBR: pbr, ROE: roe, ROA: roa, OPM: opm, FCF_Yield: fcf_yield, Score: score,
      
      // ✅ [디버그용 태그] 이게 결과에 나와야 함!
      _DEBUG_VERSION: "v3.6.4-FORCED-FIX",
      _DEBUG_RAW: { op: rawOp, rev: rawRev, sanitized_op: operatingIncome }
    };
  } catch (e) {
    console.error(e);
    return emptyResult("오류");
  }
}

// Helpers
function normalizeParsed(p:any){if(!p||typeof p!=="object")return{_used:false,assets:null,equity:null,liabilities:null,revenue:null,operatingIncome:null,netIncome:null,ocf:null};const a=pickNum(p,["Assets","assets","자산총계"]),e=pickNum(p,["Equity","equity","자본총계"]),l=pickNum(p,["Liabilities","liabilities","부채총계"]),r=pickNum(p,["Revenue","revenue","매출","매출액"]),o=pickNum(p,["OperatingIncome","영업이익"]),n=pickNum(p,["NetIncome","순이익","당기순이익"]),c=pickNum(p,["OCF","영업활동현금흐름"]);return{_used:true,assets:a,equity:e,liabilities:l,revenue:r,operatingIncome:o,netIncome:n,ocf:c};}
function pickNum(o:any,k:string[]){for(const x of k)if(o?.[x]!==undefined){const n=toNumber(o[x]);if(Number.isFinite(n))return n;}return null;}
function extractFinancialRows(i:any):any[]{if(Array.isArray(i)){if(looksLikeFinancialRowArray(i))return i;for(const x of i){const f=extractFinancialRows(x);if(f.length)return f;}return[];}if(i&&typeof i==="object"){if(Array.isArray((i as any).list)&&looksLikeFinancialRowArray((i as any).list))return(i as any).list;if(Array.isArray((i as any).data)&&looksLikeFinancialRowArray((i as any).data))return(i as any).data;for(const v of Object.values(i)){const f=extractFinancialRows(v);if(f.length)return f;}}return[];}
function looksLikeFinancialRowArray(a:any[]){return Array.isArray(a)&&a.slice(0,10).some(x=>x&&(x.account_nm||x.account_name)&&(x.thstrm_amount!==undefined||x.amount!==undefined||x.value!==undefined));}
function isPlainObject(v:any){return v&&typeof v==="object"&&!Array.isArray(v);}
function norm(s:any){return String(s??"").replace(/\s/g,"").trim();}
function pickAmountSmart(v:any){if(v===null||v===undefined)return 0;if(typeof v==="number"||typeof v==="string")return v;if(typeof v==="object"&&!Array.isArray(v)){const k=Object.keys(v).filter(x=>/^\d{4}$/.test(x));if(k.length)return v[k.sort((a:any,b:any)=>b-a)[0]];}return 0;}
function toNumber(v:any){if(v==null)return NaN;if(typeof v==="number")return v;const n=Number(String(v).replace(/,/g,"").trim());return Number.isFinite(n)?n:NaN;}
function emptyResult(m:string){return{per:"N/A",pbr:"N/A",roe:"N/A",roa:"N/A",opm:"N/A",fcf_yield:"N/A",score:0,asof:m,PER:"N/A",PBR:"N/A",ROE:"N/A",ROA:"N/A",OPM:"N/A",FCF_Yield:"N/A",Score:0};}
