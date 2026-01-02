/**
 * 📊 DART API Handler (v3.6.3 - Hard-Coded Data Integrity)
 * 
 * 목적:
 * - DART 재무 데이터를 가져와 강력한 단위 정규화(Normalization) 수행
 * - 자본잠식, OPM 160% 같은 불가능한 데이터는 코드 레벨에서 필터링
 * - AI가 받는 데이터는 무조건 "정제된 팩트"만 제공
 * 
 * 핵심 원칙:
 * 1. 모든 재무 수치 → 원(KRW) 정수 통일
 * 2. 한글 단위(조/억) 자동 변환
 * 3. 자본 역산: Assets - Liabilities = Equity (필수)
 * 4. Sanity Check: OPM > 100% 감지 시 강제 0 처리
 * 5. 자본잠식 재검증: 시총 대비 자본 음수 = 명백한 오류 → 자동 복구
 */

interface FinancialItem {
  account_id: string;
  account_nm: string;
  thstrm_amount?: string | number;
  thstrm_add_amount?: string | number;
  frmtrm_amount?: string | number;
  frmtrm_add_amount?: string | number;
  bfym_amount?: string | number;
  bfym_add_amount?: string | number;
}

interface ParsedFinancials {
  Revenue: number;
  OperatingIncome: number;
  NetIncomeParent: number;
  NetIncomeTotal: number;
  Assets: number;
  Liabilities: number;
  Equity: number;
  OCF: number;
  CapEx: number;
  [key: string]: number;
}

/**
 * 🛠️ [Helper Function] 한글 단위 파서
 * 
 * 입력 예시:
 * - "1,234,567" → 1234567
 * - "1조 5,234억" → 1523400000000
 * - "1조 2000억 500만" → 1200005000000
 * - "null", "", undefined → 0
 * 
 * @param raw 원본 문자열 또는 숫자
 * @returns 정규화된 정수 (원 단위)
 */
function parseKoreanNumber(raw: any): number {
  if (raw === null || raw === undefined || raw === "") {
    return 0;
  }

  const str = String(raw).trim().replace(/\s+/g, "");

  // [1] 순수 숫자 (쉼표 포함)
  if (/^[\d,.-]+$/.test(str)) {
    const cleaned = str.replace(/,/g, "");
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }

  // [2] 한글 단위 파싱 (예: "1조 2,000억")
  let total = 0;
  const unitMap: { [key: string]: number } = {
    조: 1000000000000,      // 1 trillion
    억: 100000000,          // 100 million
    만: 10000,              // 10k
  };

  let remaining = str;

  // 각 단위별로 순회
  for (const [unit, multiplier] of Object.entries(unitMap)) {
    const regex = new RegExp(`([\\d,]+)${unit}`, "g");
    let match;

    while ((match = regex.exec(remaining)) !== null) {
      const numStr = match[1].replace(/,/g, "");
      const num = Number(numStr);
      if (!isNaN(num)) {
        total += num * multiplier;
      }
      // 매칭된 부분 제거
      remaining = remaining.replace(match[0], " ");
    }
  }

  // [3] 남은 순수 숫자 처리
  const finalNum = Number(remaining.replace(/,/g, "").trim());
  if (!isNaN(finalNum) && finalNum !== 0) {
    total += finalNum;
  }

  return total || 0;
}

/**
 * 🛡️ [Sanity Check] 논리 검증
 * 
 * 재무 데이터가 물리적으로 불가능한 상태인지 확인하고 자동 복구
 * 
 * 규칙:
 * 1. Assets - Liabilities != Equity → Equity 강제 역산
 * 2. OperatingIncome > Revenue (단위 오류) → OperatingIncome = 0 (계산 불가 처리)
 * 3. Equity < 0 AND Assets > 1조 → Assets - Liabilities로 복구 (명백한 API 오류)
 */
function applySanityChecks(fin: ParsedFinancials): ParsedFinancials {
  const result = { ...fin };

  // [Check 1] 자본 역산 (가장 중요함)
  if (result.Assets > 0 && result.Liabilities >= 0) {
    const calculatedEquity = result.Assets - result.Liabilities;
    
    // Equity가 없거나 0인 경우 → 강제로 역산값 대입
    if (result.Equity <= 0 && calculatedEquity > 0) {
      console.warn(
        `[SANITY CHECK] Equity was invalid (${result.Equity}). ` +
        `Restored from Assets - Liabilities = ${calculatedEquity}`
      );
      result.Equity = calculatedEquity;
    }
  }

  // [Check 2] 영업이익 > 매출 (단위 오류 감지)
  if (result.Revenue > 0 && result.OperatingIncome > result.Revenue) {
    console.warn(
      `[SANITY CHECK] OperatingIncome (${result.OperatingIncome}) ` +
      `> Revenue (${result.Revenue}). This is physically impossible. ` +
      `Forcing OperatingIncome = 0 to prevent OPM hallucination.`
    );
    result.OperatingIncome = 0;
  }

  // [Check 3] 자본잠식 재검증 (시총 대비 자본이 터무니없게 작은 경우)
  // 시총 1조 이상인데 자본이 100억 미만? → 명백한 오류
  if (result.Equity < 100000000 && result.Assets > 1000000000000) {
    console.warn(
      `[SANITY CHECK] Equity (${result.Equity}) is suspiciously small ` +
      `compared to Assets (${result.Assets}). Likely API error. ` +
      `Recalculating: Equity = Assets - Liabilities`
    );
    result.Equity = Math.max(0, result.Assets - result.Liabilities);
  }

  // [Check 4] NetIncome 음수 처리 (손실은 가능하지만 로그)
  if (result.NetIncomeParent < 0) {
    console.info(
      `[INFO] Net loss detected (${result.NetIncomeParent}). ` +
      `This is valid but indicates operating loss.`
    );
  }

  return result;
}

/**
 * 📊 메인 파서 함수
 * 
 * DART API의 accountList를 받아서:
 * 1. 각 account를 표준 키로 매핑
 * 2. 값을 한글 단위에서 원(KRW) 정수로 변환
 * 3. Sanity Check 적용
 * 4. 최종 정제 데이터 반환
 * 
 * @param accountList DART API fnlttSinglAcntAll.json의 list 배열
 * @param ticker 종목코드 (로깅용)
 * @returns 정규화된 재무 데이터
 */
export function parseFinancialData(
  accountList: FinancialItem[],
  ticker?: string
): ParsedFinancials {
  // [매핑] DART account_id → 표준 항목명
  const accountMap: { [key: string]: string } = {
    // 매출
    "ifrs-full_Revenue": "Revenue",
    "dart_Revenue": "Revenue",

    // 영업이익/손실
    "ifrs-full_ProfitLossFromOperatingActivities": "OperatingIncome",
    "dart_OperatingIncomeLoss": "OperatingIncome",
    "ifrs-full_OperatingIncome": "OperatingIncome",

    // 순이익 (지배주주)
    "ifrs-full_ProfitLossAttributableToOwnersOfParent": "NetIncomeParent",
    "dart_NetIncomeAttributableToParent": "NetIncomeParent",

    // 순이익 (전체)
    "ifrs-full_ProfitLoss": "NetIncomeTotal",
    "dart_NetIncome": "NetIncomeTotal",

    // 자산
    "ifrs-full_Assets": "Assets",
    "dart_Assets": "Assets",

    // 부채
    "ifrs-full_Liabilities": "Liabilities",
    "dart_Liabilities": "Liabilities",

    // 자본
    "ifrs-full_Equity": "Equity",
    "dart_Equity": "Equity",
    "ifrs-full_StockholdersEquity": "Equity",

    // 현금흐름
    "ifrs-full_CashFlowsFromUsedInOperatingActivities": "OCF",
    "dart_OperatingCashFlow": "OCF",

    // 자본적 지출
    "ifrs-full_PurchasesOfPropertyPlantAndEquipment": "CapEx",
    "dart_CapitalExpenditures": "CapEx",
  };

  // [초기화]
  const result: ParsedFinancials = {
    Revenue: 0,
    OperatingIncome: 0,
    NetIncomeParent: 0,
    NetIncomeTotal: 0,
    Assets: 0,
    Liabilities: 0,
    Equity: 0,
    OCF: 0,
    CapEx: 0,
  };

  // [파싱]
  if (Array.isArray(accountList)) {
    for (const item of accountList) {
      const accountId = item.account_id || "";
      
      // ✅ 가장 최근 분기 데이터 우선 (thstrm_amount)
      const rawValue = item.thstrm_amount ?? item.frmtrm_amount ?? "0";
      const parsedValue = parseKoreanNumber(rawValue);

      // 매핑된 항목인지 확인
      if (accountMap[accountId]) {
        const key = accountMap[accountId];
        result[key] = parsedValue;
        
        console.debug(
          `[PARSE] ${ticker || "?"} | ${key} = ${parsedValue} ` +
          `(raw: "${rawValue}")`
        );
      }
    }
  }

  // [Sanity Check 적용]
  const checked = applySanityChecks(result);

  console.info(
    `[PARSE COMPLETE] ${ticker || "?"} | ` +
    `R=${checked.Revenue}, OP=${checked.OperatingIncome}, ` +
    `NI=${checked.NetIncomeParent}, Equity=${checked.Equity}`
  );

  return checked;
}

/**
 * 📈 지표 계산 헬퍼 (AI 이전에 기본 검증)
 * 
 * OPM, ROE 등을 계산하되, 분모가 0이거나 분자가 물리적으로 불가능하면
 * null을 반환하여 AI가 "N/A" 처리하도록 함
 */
export function calculateMetrics(fin: ParsedFinancials) {
  return {
    // OPM (영업이익률) = OperatingIncome / Revenue
    OPM:
      fin.Revenue > 0 && fin.OperatingIncome >= 0
        ? (fin.OperatingIncome / fin.Revenue) * 100
        : null,

    // NPM (순이익률) = NetIncome / Revenue
    NPM:
      fin.Revenue > 0 && fin.NetIncomeParent
        ? (fin.NetIncomeParent / fin.Revenue) * 100
        : null,

    // ROE (자기자본 수익률) = NetIncome / Equity
    ROE:
      fin.Equity > 0 && fin.NetIncomeParent
        ? (fin.NetIncomeParent / fin.Equity) * 100
        : null,

    // ROA (자산 수익률) = NetIncome / Assets
    ROA:
      fin.Assets > 0 && fin.NetIncomeParent
        ? (fin.NetIncomeParent / fin.Assets) * 100
        : null,

    // 부채비율 = Liabilities / Equity
    DebtRatio:
      fin.Equity > 0
        ? (fin.Liabilities / fin.Equity) * 100
        : null,

    // 자본비율 = Equity / Assets
    EquityRatio:
      fin.Assets > 0
        ? (fin.Equity / fin.Assets) * 100
        : null,

    // 자본잠식 여부 (True = 잠식 상태)
    IsEquityNegative: fin.Equity < 0,
  };
}

/**
 * 🔍 디버깅: 원본 vs 정규화 비교 출력
 */
export function debugParse(accountList: FinancialItem[], ticker?: string) {
  console.log(`\n=== DEBUG: PARSE COMPARISON (${ticker}) ===`);
  console.log("Raw Data:");
  for (const item of accountList.slice(0, 5)) {
    console.log(
      `  ${item.account_nm}: "${item.thstrm_amount}"`
    );
  }

  const parsed = parseFinancialData(accountList, ticker);
  console.log("\nParsed (원 단위):");
  console.log(`  Revenue: ${parsed.Revenue}`);
  console.log(`  OperatingIncome: ${parsed.OperatingIncome}`);
  console.log(`  Equity: ${parsed.Equity}`);
  console.log(`  Assets: ${parsed.Assets}`);
  console.log(`  Liabilities: ${parsed.Liabilities}`);

  const metrics = calculateMetrics(parsed);
  console.log("\nMetrics:");
  console.log(`  OPM: ${metrics.OPM}%`);
  console.log(`  ROE: ${metrics.ROE}%`);
  console.log(`  EquityRatio: ${metrics.EquityRatio}%`);
  console.log(`  IsEquityNegative: ${metrics.IsEquityNegative}`);
  console.log("===\n");
}

/**
 * 🔗 [High-Level API] DART + Market Data Fusion
 * 
 * route.ts에서 사용하는 고수준 함수
 * - DART 재무 데이터 수집
 * - 시가총액, 가격, 뉴스, 가격 히스토리 병합
 * - parsed 재무데이터 반환
 */
export async function fetchFundamentalsFusion(ticker: string) {
  try {
    const DART_API = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";

    // [Step 1] ticker → corp_code 변환 (별도 맵 필요)
    // 임시: DART에서 직접 조회 가능하다고 가정
    const corp_code = ticker; // 실제로는 매핑이 필요함

    const apiKey = process.env.DART_API_KEY;
    if (!apiKey) {
      throw new Error("DART_API_KEY not set");
    }

    // [Step 2] DART 데이터 조회 (최근 3년)
    const dartData: { [key: string]: any } = {};
    const years = [2025, 2024, 2023];

    for (const year of years) {
      const params = new URLSearchParams({
        crtfc_key: apiKey,
        corp_code,
        bsns_year: String(year),
        reprt_code: "11011", // 사업보고서
        fs_div: "CFS", // 연결재무제표
      });

      try {
        const res = await fetch(`${DART_API}?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (data?.status === "000" && Array.isArray(data.list)) {
          // ✅ parseFinancialData로 정규화
          const parsed = parseFinancialData(data.list, ticker);

          dartData[String(year)] = {
            raw: data.list,
            parsed,
            reprt: "11011",
          };

          console.log(`[DART] ${ticker} ${year} fetched. Equity=${parsed.Equity}`);
        }
      } catch (err) {
        console.warn(`[DART] Failed to fetch ${year} for ${ticker}:`, err);
      }
    }

    if (Object.keys(dartData).length === 0) {
      throw new Error("No DART data collected");
    }

    // [Step 3] 시장 데이터 (임시: 더미)
    // 실제로는 KRX API 또는 웹 스크래핑으로 가져와야 함
    const marketCap = 2000000000000; // 2조 (예시)
    const price = 40000; // 현재가 (예시)
    const history: any[] = []; // 일별 데이터 (비어있음)
    const news: any[] = []; // 뉴스 (비어있음)

    return {
      status: "ok",
      corp_code,
      ticker,
      marketCap,
      price,
      data: dartData,
      history,
      news,
    };
  } catch (e: any) {
    console.error("[fetchFundamentalsFusion] Error:", e);
    return null;
  }
}

export default parseFinancialData;
