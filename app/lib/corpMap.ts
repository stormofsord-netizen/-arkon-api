// app/lib/corpMap.ts
export type CorpCode = string;

/**
 * ticker(6자리) -> DART corp_code
 * 예) 삼성전자 005930 -> 00126380
 *
 * NOTE:
 * - DART API의 대부분 엔드포인트는 ticker가 아니라 corp_code를 요구함.
 * - 그래서 여기서 ticker를 corp_code로 변환해 route.ts에서 사용하게 됨.
 */
const TICKER_TO_CORP_CODE: Record<string, CorpCode> = {
  "005930": "00126380", // 삼성전자
};

export function normalizeTicker(input: string): string {
  const digitsOnly = String(input ?? "").trim().replace(/[^\d]/g, "");
  // "5930" 같은 입력도 6자리로 보정
  return digitsOnly.padStart(6, "0").slice(-6);
}

export function getCorpCodeByTicker(ticker: string): CorpCode | null {
  const key = normalizeTicker(ticker);
  return TICKER_TO_CORP_CODE[key] ?? null;
}

// (선택) 런타임에서 임시로 추가하고 싶을 때 사용
export function registerCorpCode(ticker: string, corpCode: CorpCode) {
  TICKER_TO_CORP_CODE[normalizeTicker(ticker)] = corpCode;
}

// 필요하면 맵 자체를 읽을 수 있게 export
export const corpMap = TICKER_TO_CORP_CODE;