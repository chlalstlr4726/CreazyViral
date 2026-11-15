import { NextResponse } from "next/server";
import { loadHomeTop } from "@/lib/viral";

export const dynamic = "force-dynamic";

// 홈 Top 5. daily_recs(매일 승인 추천)가 있으면 가장 최근 추천일 상위 편, 없으면 최근 며칠 간 조회수 상위 바이럴 릴스. 예: /api/viral/top?days=3&limit=5
export async function GET(req: Request) {
  const u = new URL(req.url);
  const days = Math.min(30, Math.max(1, Number(u.searchParams.get("days")) || 3));
  const limit = Math.min(20, Math.max(1, Number(u.searchParams.get("limit")) || 5));
  const { items, source, recDate } = await loadHomeTop(days, limit);
  return NextResponse.json({ days, source, recDate: recDate ?? null, items });
}
