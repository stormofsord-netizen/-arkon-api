// app/lib/corpMap.ts

/**
 * DART 기업 코드
 * - ticker(종목코드 6자리) -> corp_code(8자리)
 */
export async function getCorpCodeByTicker(ticker: string) {
  const map: Record<string, string> = {
    "278470": "01190568", // 에이피알
  };
  return map[ticker] ?? null;
}

/**
 * KRX용 ISIN 코드
 * - 필요 시 KRX API 호출 등에 사용
 */
export function getISINByTicker(ticker: string) {
  const map: Record<string, string> = {
    "278470": "KR7278470009", // ✅ 에이피알 (정식 KRX ISIN)
  };

  // 기본 fallback (임시 규칙)
  return map[ticker] || `KR7${ticker}00001`;
}

/**
 * 🔍 회사명으로 티커 찾기 (Search API용)
 * - 지금은 최소 구현: corpMap에 등록된 회사만 검색 가능
 * - 예: /api/search?query=에이피알
 */
export async function findTickerByName(query: string) {
  const nameToTicker: Record<string, { ticker: string; name: string }> = {
    "에이피알": { ticker: "278470", name: "에이피알" },
    "APR": { ticker: "278470", name: "에이피알" },
  };

  const q = String(query || "").trim();
  if (!q) return null;

  // 1) 완전일치
  if (nameToTicker[q]) return nameToTicker[q];

  // 2) 부분일치(간단)
  const found = Object.values(nameToTicker).find((v) => v.name.includes(q));
  return found ?? null;
}
