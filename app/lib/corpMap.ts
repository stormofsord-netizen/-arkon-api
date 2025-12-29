// app/lib/corpMap.ts
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

let _cache: Map<string, string> | null = null;
let _cacheAt = 0;

// 서버리스 환경에서 너무 자주 받지 않게 24시간 캐시 (인스턴스 기준)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function asText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  // fast-xml-parser 설정/버전에 따라 object 형태로 올 수도 있어서 방어
  if (typeof v === "object") {
    if (typeof v["#text"] === "string") return v["#text"];
    if (typeof v["text"] === "string") return v["text"];
    if (typeof v["value"] === "string") return v["value"];
    // 마지막 방어
    try {
      return String(v);
    } catch {
      return "";
    }
  }
  return "";
}

function normalizeStockCode(code: string): string {
  const s = (code ?? "").trim();
  if (!s) return "";
  // DART의 stock_code는 보통 6자리지만 혹시 모자라면 0 패딩
  return s.padStart(6, "0");
}

function normalizeCorpCode(code: string): string {
  const s = (code ?? "").trim();
  if (!s) return "";
  // corp_code는 8자리
  return s.padStart(8, "0");
}

async function loadCorpMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL_MS) return _cache;

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("DART_API_KEY is missing");

  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(
    apiKey
  )}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`DART corpCode.xml fetch failed: ${res.status} ${res.statusText}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());

  const zip = new AdmZip(buf);

  // DART zip 내부 파일명은 일반적으로 CORPCODE.xml
  const entry =
    zip.getEntry("CORPCODE.xml") ||
    zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".xml"));

  if (!entry) throw new Error("CORPCODE.xml not found inside zip");

  const xml = entry.getData().toString("utf8");

  // ✅ 핵심: parseTagValue:false 로 숫자/불리언 자동 변환 방지
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
  });

  const parsed: any = parser.parse(xml);

  const listRaw = parsed?.result?.list;
  const list = Array.isArray(listRaw) ? listRaw : listRaw ? [listRaw] : [];

  const map = new Map<string, string>();

  for (const e of list) {
    const stock_code = normalizeStockCode(asText(e?.stock_code));
    const corp_code = normalizeCorpCode(asText(e?.corp_code));

    if (stock_code && corp_code) {
      map.set(stock_code, corp_code);
    }
  }

  _cache = map;
  _cacheAt = now;
  return map;
}

export async function getCorpCodeByTicker(ticker: string): Promise<string | null> {
  const t = (ticker ?? "").trim();
  if (!/^\d{6}$/.test(t)) return null;

  const map = await loadCorpMap();
  return map.get(t) ?? null;
}

export function _debug_clearCorpMapCache() {
  _cache = null;
  _cacheAt = 0;
}