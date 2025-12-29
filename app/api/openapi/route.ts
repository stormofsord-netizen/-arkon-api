import { NextResponse } from "next/server";

// 캐시 끄기(스키마는 항상 최신으로)
export const dynamic = "force-dynamic";

export async function GET() {
  const schema = {
    openapi: "3.0.3",
    info: {
      title: "arkon-api",
      version: "0.1.0",
      description:
        "ARKON-JANUS automation API. Provides DART fundamentals via Next.js route handlers.",
    },

    // ✅ GPTs Actions가 가장 잘 먹는 형태: https 1개만
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
              description: "Financial statement type (CFS/OFS)",
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
                    required: ["status"],
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
                      message: { type: "string" },
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
                      message: { type: "string" },
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