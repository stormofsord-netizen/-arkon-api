// app/lib/corpMap.ts
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

type CorpRow = {
  corp_code?: string;
  corp_name?: string;
  stock_code?: string;
  modify_date?: string;
};

function normalizeTicker(input: string): string {
  const t = (input ?? "").trim();
  // "660" -> "000660" 같은 케이스 방어
  if (/^\d{1,6}$/.test(t)) return t.padStart(6, "0");
  return t; // 혹시 이미 6자리 이상 들어오면 그대로
}

// Vercel/Node에서 재사용되는 전역 캐시
declare global {
  // eslint-disable-next-line no-var
  var __ARKON_CORP_MAP__: Map<string, string> | undefined;
}

/**
 * DART corpCode.xml(Zip)에서 stock_code(티커) -> corp_code 매핑을 자동 생성/캐시
 */
async function loadCorpMapFromDart(): Promise<Map<string, string>> {
  if (globalThis.__ARKON_CORP_MAP__) return globalThis.__ARKON_CORP_MAP__;

  const apiKey =
    process.env.DART_API_KEY ||
    process.env.DART_APIKEY ||
    process.env.DART_CRTFC_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "DART_API_KEY 환경변수가 없습니다. (Vercel/로컬 .env.local 확인)"
    );
  }

  // DART: corpCode.xml 은 ZIP으로 내려옴
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`DART corpCode.xml 다운로드 실패: ${res.status}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buf);

  // ZIP 내부 파일명이 CORPCODE.xml 인 경우가 일반적이라 둘 다 탐색
  const entry =
    zip.getEntry("CORPCODE.xml") ||
    zip.getEntry("corpCode.xml") ||
    zip
      .getEntries()
      .find((e) => e.entryName.toLowerCase().endsWith(".xml"));

  if (!entry) {
    throw new Error("corpCode ZIP 안에서 XML 파일을 찾지 못했습니다.");
  }

  const xml = entry.getData().toString("utf-8");

  const parser = new XMLParser({
    ignoreAttributes: true,
    // 값이 하나여도 array로 맞춰서 처리 편하게
    isArray: (name) => name === "list",
  });

  const parsed = parser.parse(xml) as any;

  // 구조: <result><list>...</list></result>
  const rows: CorpRow[] =
    parsed?.result?.list ??
    parsed?.result?.["list"] ??
    parsed?.["result"]?.list ??
    [];

  const map = new Map<string, string>();
  for (const r of rows) {
    const stock = (r.stock_code ?? "").trim();
    const corp = (r.corp_code ?? "").trim();

    // stock_code 없는 법인도 많아서 걸러야 함
    if (!stock || stock.length !== 6) continue;
    if (!corp || corp.length !== 8) continue;

    map.set(stock, corp);
  }

  globalThis.__ARKON_CORP_MAP__ = map;
  return map;
}

export async function getCorpCodeByTicker(
  ticker: string
): Promise<string | null> {
  const t = normalizeTicker(ticker);

  const map = await loadCorpMapFromDart();
  return map.get(t) ?? null;
}