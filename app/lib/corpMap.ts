// app/lib/corpMap.ts
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

type CorpItem = {
  corp_code?: unknown;
  stock_code?: unknown;
};

declare global {
  // eslint-disable-next-line no-var
  var __ARKON_CORP_MAP__: Map<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __ARKON_CORP_MAP_LOADING__: Promise<Map<string, string>> | undefined;
}

function normalizeTicker(ticker: string) {
  const t = String(ticker ?? "").trim();
  if (!t) return "";
  // 숫자만 남기고 6자리 패딩
  const digits = t.replace(/\D/g, "");
  return digits.padStart(6, "0").slice(-6);
}

function asArray<T>(v: any): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

async function loadCorpMapFromDart(apiKey: string): Promise<Map<string, string>> {
  // 이미 로드된 캐시가 있으면 바로 반환
  if (globalThis.__ARKON_CORP_MAP__) return globalThis.__ARKON_CORP_MAP__!;
  if (globalThis.__ARKON_CORP_MAP_LOADING__) return globalThis.__ARKON_CORP_MAP_LOADING__!;

  globalThis.__ARKON_CORP_MAP_LOADING__ = (async () => {
    const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(
      apiKey
    )}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`DART corpCode.xml fetch failed: ${res.status} ${res.statusText}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const zip = new AdmZip(buf);

    // zip 안에 CORPCODE.xml 파일이 들어있음
    const entry =
      zip.getEntry("CORPCODE.xml") ||
      zip
        .getEntries()
        .find((e) => e.entryName.toLowerCase().endsWith("corpcode.xml"));

    if (!entry) throw new Error("CORPCODE.xml not found inside zip");

    const xml = entry.getData().toString("utf-8");

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      textNodeName: "text",
      parseTagValue: true,
      trimValues: true,
    });

    const parsed = parser.parse(xml);

    // 구조가 환경마다 살짝 달라질 수 있어서 여러 경로 방어
    const listCandidate =
      parsed?.result?.list ??
      parsed?.result?.list?.list ??
      parsed?.list ??
      parsed?.corpCode?.list;

    const list = asArray<CorpItem>(listCandidate);

    const map = new Map<string, string>();
    for (const it of list) {
      const stock = normalizeTicker(String((it as any)?.stock_code ?? ""));
      if (!stock) continue;

      // ✅ 여기서 trim 에러 안 나게 무조건 문자열로 캐스팅
      const corp = String((it as any)?.corp_code ?? "").trim();
      if (!corp) continue;

      map.set(stock, corp);
    }

    globalThis.__ARKON_CORP_MAP__ = map;
    return map;
  })();

  return globalThis.__ARKON_CORP_MAP_LOADING__;
}

/**
 * ✅ fundamentals 라우트에서 쓰는 함수
 * - ticker(6자리)를 넣으면 corp_code를 찾아줌
 */
export async function getCorpCodeByTicker(ticker: string): Promise<string | null> {
  const apiKey = String(process.env.DART_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("DART_API_KEY is missing");

  const t = normalizeTicker(ticker);
  if (!t) return null;

  const map = await loadCorpMapFromDart(apiKey);
  return map.get(t) ?? null;
}