// app/lib/corpMap.ts
// DART corpCode.xml(zip) 내려받아 stock_code(티커) -> corp_code 매핑을 만든다.
// - corp_code가 number/object로 들어와도 문자열로 안전 변환
// - corp_code는 8자리 0패딩 유지 (예: 164779 -> 00164779)
// - 캐시(TTL)로 매 요청마다 다운로드/파싱하지 않게 함

import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

type CorpRow = {
  corp_code?: unknown;
  stock_code?: unknown;
  corp_name?: unknown;
  modify_date?: unknown;
};

type CorpCache = {
  builtAt: number;
  byStock: Map<string, string>; // 6자리 ticker -> 8자리 corp_code
};

declare global {
  // eslint-disable-next-line no-var
  var __ARKON_CORP_CACHE__: CorpCache | undefined;
}

const CORP_CODE_ZIP_URL = "https://opendart.fss.or.kr/api/corpCode.xml";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12시간

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return String(v);
  // object/array 등은 안전하게 빈 문자열 처리(크래시 방지)
  return "";
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function normalizeTicker(input: unknown): string | null {
  const raw = digitsOnly(toStr(input));
  if (!raw) return null;
  // 6자리로 맞추되, 너무 길면 뒤 6자리 사용
  return raw.padStart(6, "0").slice(-6);
}

function normalizeCorpCode(input: unknown): string | null {
  const raw = digitsOnly(toStr(input));
  if (!raw) return null;
  // DART corp_code는 8자리 문자열이 정답
  return raw.padStart(8, "0").slice(-8);
}

function cacheFresh(cache: CorpCache | undefined): cache is CorpCache {
  return !!cache && cache.byStock.size > 0 && Date.now() - cache.builtAt < CACHE_TTL_MS;
}

async function fetchCorpZipBuffer(): Promise<Buffer> {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY env var is not set");

  const url = `${CORP_CODE_ZIP_URL}?crtfc_key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`DART corpCode.xml download failed: ${res.status} ${res.statusText} ${txt}`.slice(0, 300));
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function extractXmlFromZip(buf: Buffer): string {
  const zip = new AdmZip(buf);

  // 파일명이 대문자/소문자 섞일 수 있어서 다 찾아봄
  const entries = zip.getEntries();
  const target =
    zip.getEntry("CORPCODE.xml") ||
    zip.getEntry("corpCode.xml") ||
    zip.getEntry("CORPCODE.XML") ||
    entries.find((e) => e.entryName.toLowerCase().endsWith(".xml"));

  if (!target) throw new Error("corpCode zip does not contain xml entry");

  return target.getData().toString("utf-8");
}

function parseRows(xml: string): CorpRow[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    // 값이 숫자로 자동 변환되는 걸 최대한 막기 위해 태그값은 string으로 유지
    parseTagValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(xml) as any;

  // 보통은 parsed.result.list 가 배열
  const list = parsed?.result?.list;

  if (Array.isArray(list)) return list as CorpRow[];
  if (list && typeof list === "object") return [list as CorpRow];

  return [];
}

async function buildCorpCache(): Promise<CorpCache> {
  const buf = await fetchCorpZipBuffer();
  const xml = extractXmlFromZip(buf);
  const rows = parseRows(xml);

  const byStock = new Map<string, string>();

  for (const r of rows) {
    const ticker = normalizeTicker(r.stock_code);
    if (!ticker) continue;

    const corp = normalizeCorpCode(r.corp_code);
    if (!corp) continue;

    byStock.set(ticker, corp);
  }

  return { builtAt: Date.now(), byStock };
}

/**
 * ticker(6자리) -> corp_code(8자리) 반환
 * - 없으면 null
 * - 내부에서 캐시/리빌드 자동 처리
 */
export async function getCorpCodeByTicker(ticker: string): Promise<string | null> {
  const t = normalizeTicker(ticker);
  if (!t) return null;

  if (!cacheFresh(globalThis.__ARKON_CORP_CACHE__)) {
    globalThis.__ARKON_CORP_CACHE__ = await buildCorpCache();
  }

  return globalThis.__ARKON_CORP_CACHE__!.byStock.get(t) ?? null;
}

/**
 * 강제로 캐시 갱신하고 싶을 때 사용(디버그/운영용)
 */
export async function refreshCorpCache(): Promise<{ size: number }> {
  globalThis.__ARKON_CORP_CACHE__ = await buildCorpCache();
  return { size: globalThis.__ARKON_CORP_CACHE__.byStock.size };
}

/**
 * 상태 확인용
 */
export function getCorpCacheMeta(): { cached: boolean; ageMs: number; size: number } {
  const c = globalThis.__ARKON_CORP_CACHE__;
  if (!c) return { cached: false, ageMs: -1, size: 0 };
  return { cached: true, ageMs: Date.now() - c.builtAt, size: c.byStock.size };
}