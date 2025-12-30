export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
// ✅ 경로가 올바른지 확인 (@/lib)
import { fetchFundamentalsFusion } from "@/lib/dartHandler";
import { fuseFinancials } from "@/lib/financialFusion";
import { analyzeValuation } from "@/lib/financialAnalyzer";
import { analyzeRisk } from "@/lib/riskAnalyzer";
import { analyzeQuant } from "@/lib/quantAnalyzer";
import { buildReport } from "@/lib/reportBuilder";

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

    console.log(`[API] Starting Full Report for ${ticker}`);

    // 1️⃣ 펀더멘털 + 시장 데이터(주가, 차트) 수집
    // (dartHandler가 내부적으로 priceFetcher를 호출해서 history까지 가져옵니다)
    const dartDataset = await fetchFundamentalsFusion(ticker);
    
    if (!dartDataset || !dartDataset.data) {
        return jsonError(404, "No DART data found (fetch failed)");
    }

    // 2️⃣ 데이터 구조 통일 (연도별 재무제표)
    const reports = Object.entries(dartDataset.data).map(([year, v]: any) => ({
      year: Number(year),
      reprt: v.reprt ?? "11011",
      data: v.data ?? [],
    }));

    // 3️⃣ 병합 (재무제표 융합)
    const fused = fuseFinancials(reports);

    // 4️⃣ 밸류에이션 분석 (실시간 시총 반영)
    const valuation = analyzeValuation(fused, dartDataset.marketCap);

    // 5️⃣ 리스크 분석 (뉴스 데이터는 추후 연동, 현재는 빈 배열)
    const risk = await analyzeRisk(fused, []);

    // ✅ 6️⃣ 퀀트 분석 (네이버에서 가져온 1년치 일봉 데이터 입력)
    // dartDataset.history가 없으면 빈 배열로 처리하여 에러 방지
    const quant = await analyzeQuant(dartDataset.history || []);

    // 7️⃣ 리포트 통합 (텍스트 생성)
    const rawReport = await buildReport(fused, [], dartDataset.marketCap);
    
    // 타입 에러 방지용 (any 처리)
    const report = rawReport as any;

    // 8️⃣ 요약 정보 생성
    const summary = {
      valuation_score: valuation?.score ?? 0,
      risk_level: risk?.alert ?? "Unknown",
      signal: quant?.price_signal ?? "N/A", // 퀀트 분석 결과 반영
    };

    // ✅ 최종 응답 (GPT가 읽을 JSON)
    return NextResponse.json(
      {
        status: "ok",
        system: "ARKON-JANUS v3.6.3",
        asof: new Date().toISOString().split('T')[0], // 오늘 날짜
        generated_at: new Date().toISOString(),
        corp_code: dartDataset.corp_code,
        marketCap: dartDataset.marketCap, // 실시간 시가총액
        price: dartDataset.price,         // 실시간 주가
        fundamental: report?.fundamental ?? null,
        risk,
        quant, // 지지/저항, ATR 등 포함됨
        summary,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    console.error("FullReport Error:", e);
    return jsonError(500, "Internal Server Error", {
      detail: String(e?.message ?? e),
    });
  }
}