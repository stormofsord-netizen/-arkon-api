// app/api/report/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
// ✅ * as Dart 로 가져와서 함수 이름이 뭐든 대응 가능하게 처리
import * as Dart from "@/lib/dartHandler";
import { analyzeValuation } from "@/lib/financialAnalyzer";
import { analyzeRisk } from "@/lib/riskAnalyzer";
// ✅ * as Quant 로 가져와서 대응
import * as Quant from "@/lib/quantAnalyzer";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json({ error: "Ticker required" }, { status: 400 });
    }

    // 1. DART 데이터 가져오기 (이름 유연하게 찾기)
    // fetchFundamentalsFusion이 없으면 getFundamentalFusion 사용
    const fetchFn = (Dart as any).fetchFundamentalsFusion || (Dart as any).getFundamentalFusion;
    
    if (!fetchFn) {
        throw new Error("Dart Handler function not found");
    }

    const dartDataset = await fetchFn(ticker);

    if (!dartDataset) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    // 2. Fused 데이터 (타입 단언으로 에러 회피)
    const fused = (dartDataset as any).fused || (dartDataset as any).data;

    // 3. Parsed 데이터 추출
    const dataObj = (dartDataset as any).data || {};
    const years = Object.keys(dataObj).map(Number).filter(n => !isNaN(n));
    const latestYear = years.length ? Math.max(...years) : null;
    const latestParsed = latestYear ? dataObj[latestYear]?.parsed : null;

    // 4. Valuation 분석
    const marketCap = (dartDataset as any).marketCap || 0;
    const valuation = analyzeValuation(fused, marketCap, latestParsed);

    // 5. Risk / Quant 분석
    const risk = await analyzeRisk(fused, marketCap);
    
    // Quant 함수 찾기 (getQuantStats 또는 getQuantAnalysis)
    const quantFn = (Quant as any).getQuantStats || (Quant as any).getQuantAnalysis || (async () => ({ price_signal: "UNKNOWN", trend: "N/A" }));
    const quant = await quantFn(ticker);

    // 6. 등급 산정
    const valuationScore = valuation.score >= 70 ? "저평가" : valuation.score >= 50 ? "적정" : "고평가";
    const riskLevel = risk.alert;
    const signal = quant.price_signal || "N/A";

    // 7. 최종 응답
    return NextResponse.json({
      status: "ok",
      system: "ARKON-JANUS v3.6.4-FIXED",
      __DEBUG_VERSION: "CHECK_2026_01_03_VER_FINAL",
      
      asof: "2024년 기준",
      generated_at: new Date().toISOString(),
      corp_code: (dartDataset as any).corp_code,
      marketCap: marketCap,
      
      fundamental: {
        Valuation: valuation,
        Commentary: `PER: ${valuation.PER} | PBR: ${valuation.PBR} | ROE: ${valuation.ROE} | 영업이익률: ${valuation.OPM}`,
      },
      risk,
      quant,
      summary: {
        valuation_score: valuationScore,
        risk_level: riskLevel,
        signal,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    });

  } catch (error) {
    console.error("[API Error]", error);
    return NextResponse.json({ 
        error: "Internal Server Error", 
        msg: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
