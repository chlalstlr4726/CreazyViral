import { NextResponse } from "next/server";
import { readFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

// 씨앗 탭(의미 있는 둠스크롤) 피드: feed_items의 가장 최근 날짜에서 피드에 나오는 편을 순위대로. 예: /api/feed?limit=100
export async function GET(req: Request) {
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 100));
  return NextResponse.json(await readFeed(limit), { headers: { "Cache-Control": "no-store" } });
}
