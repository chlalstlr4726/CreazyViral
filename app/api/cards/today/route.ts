import { NextResponse } from "next/server";
import { fetchTodayCards, supabaseConfigured } from "@/lib/cardsRepo";
import { kstToday } from "@/lib/todayCards";

export const dynamic = "force-dynamic";

// 대시보드 화면이 부르는 '오늘의 카드'. Supabase가 없으면 source=sample → 화면이 샘플 카드를 쓴다.
export async function GET() {
  const date = kstToday();
  if (!supabaseConfigured()) return NextResponse.json({ source: "sample", date, cards: [] });
  try {
    return NextResponse.json({ source: "supabase", date, cards: await fetchTodayCards(date) });
  } catch {
    return NextResponse.json({ source: "error", date, cards: [] }, { status: 502 });
  }
}
