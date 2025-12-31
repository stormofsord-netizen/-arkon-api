// app/api/report/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchFundamentalsFusion } from "@/lib/dartHandler";
import { fuseFinancials } from "@/lib/financialFusion";
import { analyzeValuation } from "@/lib/financialAnalyzer";
import { analyzeRisk } from "@/lib/riskAnalyzer";
import { analyzeQuant } from "@/lib/quantAnalyzer";
import { buildFullReport } from "@/lib/reportBuilder";

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

    // 1) 펀더멘털 + 시장 데이터 + 뉴스 수집
    const dartDataset = await fetchFundamentalsFusion(ticker);
    if (!dartDataset || !dartDataset.data) {
      return jsonError(404, "No DART data found (fetch failed)");
    }

    // 2) reports 표준화(원본 row 리스트)
    const reports = Object.entries(dartDataset.data).map(([year, v]: any) => {
      const rawList: any[] = Array.isArray(v?.raw) ? v.raw : [];

      const normalized = rawList.map((row) => ({
        account_nm: row.account_nm ?? "",
        amount: row.thstrm_amount ?? row.amount ?? "0",
        ord: row.ord,
        type: row.sj_div ?? row.sj_nm,
      }));

      return {
        year: Number(year),
        reprt: v?.reprt ?? "11011",
        data: normalized,
      };
    });

    // ✅ 최신연도 parsed(정답값) 꺼내기
    const years = Object.keys(dartDataset.data).map((y) => Number(y)).filter(Number.isFinite);
    const latestYear = years.length ? Math.max(...years) : null;
    const latestParsed = latestYear !== null ? (dartDataset.data as any)?.[String(latestYear)]?.parsed : null;

    if (latestYear !== null) {
      console.log(`[API] latestYear=${latestYear} | parsed=${latestParsed ? "YES" : "NO"}`);
    }

    // 3) 병합 (재무제표 융합)
    const fused = fuseFinancials(reports);

    // 4) 밸류에이션 분석 (✅ parsed 우선 사용)
    const valuation = analyzeValuation(fused, dartDataset.marketCap, latestParsed);

    // 5) 리스크 분석 (뉴스 반영)
    const risk = await analyzeRisk(fused, dartDataset.news || []);

    // 6) 퀀트 분석 (가격 시계열 기반)
    const quant = await analyzeQuant(dartDataset.history || []);

    // 7) 리포트 생성
    const reportText = buildFullReport(valuation, risk, quant, {
      valuation_score: (valuation as any)?.score ?? "N/A",
      risk_level: (risk as any)?.alert ?? "Unknown",
      signal: (quant as any)?.price_signal ?? "N/A",
    });

    return NextResponse.json(
      {
        status: "ok",
        system: "ARKON-JANUS v3.6.3",
        asof: "2025년 기준",
        generated_at: new Date().toISOString(),
        corp_code: dartDataset.corp_code,
        marketCap: dartDataset.marketCap,
        price: dartDataset.price,

        dart: dartDataset.data,

        fundamental: valuation,
        risk,
        quant,
        summary: {
          valuation_score: (valuation as any)?.score ?? "N/A",
          risk_level: (risk as any)?.alert ?? "Unknown",
          signal: (quant as any)?.price_signal ?? "N/A",
        },
        report_text: reportText,
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
