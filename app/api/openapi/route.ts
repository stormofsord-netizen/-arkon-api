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
      {
        url: "https://arkon-api.vercel.app",
        description: "Production (Vercel)",
      },
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
              description: "KRX stock code (6 digits)",
            },
            {
              name: "bsns_year",
              in: "query",
              required: false,
              schema: { type: "string", example: "2024" },
            },
            {
              name: "reprt_code",
              in: "query",
              required: false,
              schema: { type: "string", example: "11011" },
            },
            {
              name: "fs_div",
              in: "query",
              required: false,
              schema: { type: "string", example: "CFS" },
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
                      ticker: { type: "string", example: "005930" },
                      corp_code: { type: "string", example: "00126380" },
                      source: { type: "string", example: "dart" },
                      data: { type: "object" },
                    },
                    required: ["status"],
                  },
                },
              },
            },
            "400": {
              description: "Bad Request",
            },
            "500": {
              description: "Server Error",
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