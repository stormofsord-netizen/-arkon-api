import { NextResponse } from "next/server";

export async function GET() {
  const schema = {
    openapi: "3.1.0",
    info: {
      title: "arkon-api",
      version: "0.1.0",
      description:
        "ARKON-JANUS automation API. Provides DART fundamentals via Next.js route handlers.",
    },
    servers: [
      { url: "https://arkon-api.vercel.app" },
      { url: "http://localhost:3000" },
    ],
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
                "Report code (e.g., 11011 annual, 11012 half, 11013 Q3, 11014 Q1)",
            },
            {
              name: "fs_div",
              in: "query",
              required: false,
              schema: { type: "string", example: "CFS" },
              description: "Financial statement type (CFS/..)",
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
      // GPTs에서 읽기 편하게 JSON 고정
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}