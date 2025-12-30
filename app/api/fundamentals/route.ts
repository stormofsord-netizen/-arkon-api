// app/api/fundamentals/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCorpCodeByTicker } from "@/app/lib/corpMap";
import { buildReport } from "@/lib/reportBuilder"; // ✅ ← 올바른 위치로 이동

const DART_API = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json";

// ✅ Auto-Filing Detector
function getLatestReportCode(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 11) return "11014"; // 3분기
  if (m >= 8) return "11012";  // 반기
  if (m >= 5) return "11013";  // 1분기
  return "11011";              // 사업
}

// 에러 응답 헬퍼 함수
function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { status: "error", message, ...(extra ?? {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ticker = String(url.searchParams.get("ticker") ?? "").trim();

    if (!ticker) return jsonError(400, "ticker is required");

    const apiKey = String(process.env.DART_API_KEY ?? "").trim();
    if (!apiKey) return jsonError(500, "DART_API_KEY is missing");

    // ① 종목코드 → 고유번호 변환
    let corp_code: string | null = null;
    try {
      corp_code = await getCorpCodeByTicker(ticker);
    } catch (e: any) {
      return jsonError(500, "corp_code resolver crashed", {
        detail: String(e?.message ?? e),
      });
    }
    if (!corp_code)
      return jsonError(400, `corp_code not found for ticker: ${ticker}`);

    // ② 자동 보고서 코드 탐색 및 과거 3개년 설정
    const thisYear = new Date().getFullYear();
    const latest = getLatestReportCode();
    const targets = [
      { y: thisYear, r: latest },
      { y: thisYear - 1, r: latest }, // 전년 동분기
      { y: thisYear - 2, r: "11011" },
      { y: thisYear - 3, r: "11011" },
    ];

    // ③ 병렬 DART 호출
    const results = await Promise.all(
      targets.map(async ({ y, r }) => {
        const dartUrl = new URL(DART_API);
        dartUrl.searchParams.set("crtfc_key", apiKey);
        dartUrl.searchParams.set("corp_code", corp_code!);
        dartUrl.searchParams.set("bsns_year", y.toString());
        dartUrl.searchParams.set("reprt_code", r);
        dartUrl.searchParams.set("fs_div", "CFS");

        const res = await fetch(dartUrl.toString(), { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (json?.status !== "000") return null;

        const list = (json.list ?? []).map((item: any) => ({
          account_nm: item.account_nm || item.account_id,
          amount: item.thstrm_amount || "0",
          prev_amount: item.frmtrm_amount || "0",
          type: item.sj_nm,
          ord: item.ord,
        }));
        return { year: y, reprt: r, data: list };
      })
    );

    // ④ 병합
    const valid = results.filter(Boolean);
    if (valid.length === 0)
      return jsonError(404, "No valid data from DART for any year");

    const fused = Object.fromEntries(
      valid.map((x) => [x.year, { reprt: x.reprt, data: x.data }])
    );

    // ⑤ 분석 기준 정보
    const latestYear = Math.max(...valid.map((v: any) => v.year));
    const latestLabel =
      latest === "11014"
        ? "3분기"
        : latest === "11012"
        ? "반기"
        : latest === "11013"
        ? "1분기"
        : "사업";
    const historicRange = `${thisYear - 3}~${thisYear - 1}`;

    // ⑥ ✅ Phase 4: 리포트 빌드
    // 샘플용 값 (추후 실제 시세 데이터로 교체)
    const priceSeries = []; // 가격 데이터 없으면 빈 배열
    const marketCap = 0; // 시총 (직접 연결 가능)

    const report = await buildReport(fused, priceSeries, marketCap);

    // ⑦ 최종 응답
    return NextResponse.json(
      {
        status: "ok",
        message: "ok",
        ticker,
        corp_code,
        asof: `${latestYear}년 ${latestLabel} 누적 실적 기준`,
        historic_range: historicRange,
        reports: valid.length,
        data: fused,
        report, // ✅ 통합 분석 결과 포함
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    return jsonError(500, "Internal Server Error", {
      detail: String(e?.message ?? e),
    });
  }
}
