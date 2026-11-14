import { NextResponse } from "next/server";
import { loadViral, topViral } from "@/lib/viral";

export const dynamic = "force-dynamic";

// 최근 며칠 간 조회수 상위 바이럴 릴스. 예: /api/viral/top?days=3&limit=5
export async function GET(req: Request) {
  const u = new URL(req.url);
  const days = Math.min(30, Math.max(1, Number(u.searchParams.get("days")) || 3));
  const limit = Math.min(20, Math.max(1, Number(u.searchParams.get("limit")) || 5));
  const rows = await loadViral();
  return NextResponse.json({ days, items: topViral(rows, days, limit) });
}
