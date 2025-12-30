// app/api/fullreport/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  return NextResponse.json({
    status: "ok",
    message: "Fullreport endpoint is working!",
  });
}
