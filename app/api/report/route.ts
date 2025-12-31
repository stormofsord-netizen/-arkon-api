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

    // 1️⃣ 펀더멘털 + 시장 데이터(주가, 차트) + 뉴스 수집
    const dartDataset = await fetchFundamentalsFusion(ticker);
    if (!dartDataset || !dartDataset.data) {
      return jsonError(404, "No DART data found (fetch failed)");
    }

    /**
     * 2️⃣ 데이터 구조 통일 (연도별 재무제표)
     * dartHandler.ts 반환 형태:
     * data: {
     *   [year]: { reprt, raw: [...], parsed: {...} }
     * }
     *
     * ✅ financialFusion.ts는 item.amount를 읽으므로,
     * DART 원본(thstrm_amount)을 amount로 변환해서 넘겨야 함.
     */
    const reports = Object.entries(dartDataset.data).map(([year, v]: any) => {
      const rawList: any[] = Array.isArray(v?.raw) ? v.raw : [];

      // ✅ DART 원본을 financialFusion이 먹을 수 있게 표준화
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

    // 3️⃣ 병합 (재무제표 융합)
    const fused = fuseFinancials(reports);

    // 4️⃣ 밸류에이션 분석 (실시간 시총 반영)
    const valuation = analyzeValuation(fused, dartDataset.marketCap);

    // 5️⃣ 리스크 분석 (뉴스 데이터 반영)
    const risk = await analyzeRisk(fused, dartDataset.news || []);

    // 6️⃣ 퀀트 분석 (가격 시계열 기반)
    const quant = await analyzeQuant(dartDataset.history || []);

    // 7️⃣ 리포트 생성 (텍스트 리포트)
    const reportText = buildFullReport(valuation, risk, quant, {
      valuation_score: (valuation as any)?.score ?? "N/A",
      risk_level: (risk as any)?.alert ?? "Unknown",
      signal: (quant as any)?.price_signal ?? "N/A",
    });

    // 8️⃣ 최종 JSON 응답
    return NextResponse.json(
      {
        status: "ok",
        system: "ARKON-JANUS v3.6.3",
        asof: "2025년 기준",
        generated_at: new Date().toISOString(),
        corp_code: dartDataset.corp_code,
        marketCap: dartDataset.marketCap,
        price: dartDataset.price,

        // ✅ 원본 + 파싱도 같이 내려주면 디버깅이 쉬움
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
