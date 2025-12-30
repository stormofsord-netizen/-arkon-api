import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

type CorpRow = {
  corp_code?: unknown;
  stock_code?: unknown;
  corp_name?: unknown;
};

type CorpData = { code: string; name: string }; // corp_code, corp_name

type CorpCache = {
  builtAt: number;
  byStock: Map<string, CorpData>; // ticker -> { code, name }
};

declare global {
  // eslint-disable-next-line no-var
  var __ARKON_CORP_CACHE__: CorpCache | undefined;
}

const CORP_CODE_ZIP_URL = "https://opendart.fss.or.kr/api/corpCode.xml";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

async function fetchCorpZipBuffer(): Promise<Buffer> {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY missing");
  const res = await fetch(`${CORP_CODE_ZIP_URL}?crtfc_key=${key}`);
  if (!res.ok) throw new Error("Failed to fetch corpCode.xml");
  return Buffer.from(await res.arrayBuffer());
}

async function buildCorpCache(): Promise<CorpCache> {
  const buf = await fetchCorpZipBuffer();
  const zip = new AdmZip(buf);
  const entry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith(".xml"));
  if (!entry) throw new Error("No XML found in zip");
  
  const xml = entry.getData().toString("utf-8");
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
  const parsed = parser.parse(xml);
  const list = parsed?.result?.list || [];
  const rows: CorpRow[] = Array.isArray(list) ? list : [list];

  const byStock = new Map<string, CorpData>();

  for (const r of rows) {
    const ticker = digitsOnly(toStr(r.stock_code)).padStart(6, "0").slice(-6);
    const corpCode = digitsOnly(toStr(r.corp_code)).padStart(8, "0").slice(-8);
    const name = toStr(r.corp_name);

    if (ticker && ticker.length === 6) {
      byStock.set(ticker, { code: corpCode, name: name });
    }
  }
  return { builtAt: Date.now(), byStock };
}

export async function getCorpCodeByTicker(ticker: string): Promise<string | null> {
  const t = digitsOnly(ticker).padStart(6, "0");
  if (!globalThis.__ARKON_CORP_CACHE__ || Date.now() - globalThis.__ARKON_CORP_CACHE__.builtAt > CACHE_TTL_MS) {
    globalThis.__ARKON_CORP_CACHE__ = await buildCorpCache();
  }
  return globalThis.__ARKON_CORP_CACHE__!.byStock.get(t)?.code ?? null;
}

// ✅ [추가된 기능] 이름으로 티커 찾기
export async function findTickerByName(query: string): Promise<{ ticker: string; name: string; code: string } | null> {
  if (!globalThis.__ARKON_CORP_CACHE__ || Date.now() - globalThis.__ARKON_CORP_CACHE__.builtAt > CACHE_TTL_MS) {
    globalThis.__ARKON_CORP_CACHE__ = await buildCorpCache();
  }

  const cache = globalThis.__ARKON_CORP_CACHE__!;
  const q = query.replace(/\s+/g, "").toLowerCase();

  // 1. 정확 일치 우선
  for (const [ticker, data] of cache.byStock) {
    if (data.name.replace(/\s+/g, "").toLowerCase() === q) {
      return { ticker, name: data.name, code: data.code };
    }
  }
  // 2. 포함 여부 (앞부분 일치)
  for (const [ticker, data] of cache.byStock) {
    if (data.name.replace(/\s+/g, "").toLowerCase().startsWith(q)) {
      return { ticker, name: data.name, code: data.code };
    }
  }
  
  return null;
}