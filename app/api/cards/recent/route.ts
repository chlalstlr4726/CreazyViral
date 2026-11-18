import { NextResponse } from "next/server";
import { fetchCardsSince, supabaseConfigured } from "@/lib/cardsRepo";
import { kstToday } from "@/lib/todayCards";

export const dynamic = "force-dynamic";

// 히스토리 화면이 부르는 최근 30일 카드(Supabase `cards`). 설정이 없거나 실패하면 빈 목록 → 화면은 '아직 데이터 없음'.
export async function GET() {
  const today = kstToday();
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86400_000).toISOString().slice(0, 10);
  if (!supabaseConfigured()) return NextResponse.json({ source: "unconfigured", cards: [] });
  try {
    return NextResponse.json({ source: "supabase", cards: await fetchCardsSince(from) });
  } catch {
    return NextResponse.json({ source: "error", cards: [] }, { status: 502 });
  }
}
