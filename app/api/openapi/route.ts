import { NextResponse } from "next/server";

// 캐시/정적화로 꼬이는 것 방지
export const dynamic = "force-dynamic";

export async function GET() {
  // ⚠️ 중요: GPTs Actions가 "servers"를 엄격하게 봄.
  // - localhost 제거
  // - https 도메인 1개만
  // - openapi 버전 3.1.0 권장
  const schema = {
    openapi: "3.1.0",
    info: {
      title: "arkon-api",
      version: "0.1.0",
      description:
        "ARKON-JANUS automation API. Provides DART fundamentals via Next.js route handlers.",
    },
    servers: [{ url: "https://arkon-api.vercel.app" }],
    paths: {
      "/api/fundamentals": {
        get: {
          operationId: "getFundamentals",
          summary: "Fetch DART fundamentals (fnlttSinglAcnt) by ticker",
          parameters: [
            {
              name: "ticker",
              in: "query",
              required: true,
              schema: { type: "string", example: "005930" },
              description: "KRX stock code (6 digits). e.g. 005930",
            },
            {
              name: "bsns_year",
              in: "query",
              required: false,
              schema: { type: "string", example: "2024" },
              description: "Business year (YYYY)",
            },
            {
              name: "reprt_code",
              in: "query",
              required: false,
              schema: { type: "string", example: "11011" },
              description:
                "Report code (11011 annual, 11012 half, 11013 Q3, 11014 Q1)",
            },
            {
              name: "fs_div",
              in: "query",
              required: false,
              schema: { type: "string", example: "CFS" },
              description: "Financial statement type (CFS/OFS etc.)",
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      message: { type: "string" },
                      ticker: { type: "string", example: "005930" },
                      corp_code: { type: "string", example: "00126380" },
                      source: { type: "string", example: "dart" },
                      data: { type: "object", description: "Raw DART payload" },
                    },
                    required: ["status", "ticker", "source"],
                  },
                },
              },
            },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "error" },
                      message: { type: "string", example: "ticker is required" },
                    },
                    required: ["status", "message"],
                  },
                },
              },
            },
            "500": {
              description: "Server Error",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "error" },
                      message: { type: "string", example: "internal error" },
                    },
                    required: ["status", "message"],
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(schema, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}