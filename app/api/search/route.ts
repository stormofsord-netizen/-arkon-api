export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { findTickerByName } from "@lib/corpMap";

/**
 * 🔍 Search API
 * - 회사명으로 티커 검색 (corpMap 기반)
 * - 예: /api/search?query=에이피알
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = String(url.searchParams.get("query") ?? "").trim();

    // ✅ 필수 파라미터 확인
    if (!query) {
      return NextResponse.json(
        { status: "error", message: "query parameter is required" },
        { status: 400 }
      );
    }

    // ✅ corpMap 기반 티커 검색
    const result = await findTickerByName(query);

    if (!result) {
      return NextResponse.json(
        {
          status: "error",
          message: `No matching ticker found for: ${query}`,
        },
        { status: 404 }
      );
    }

    // ✅ 성공 응답
    return NextResponse.json(
      {
        status: "ok",
        message: "ok",
        query,
        data: result,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    // ✅ 예외 처리
    return NextResponse.json(
      {
        status: "error",
        message: "Internal Server Error",
        detail: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
