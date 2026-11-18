import { NextResponse } from "next/server";
import { fetchTodayCards, supabaseConfigured } from "@/lib/cardsRepo";
import { kstToday } from "@/lib/todayCards";

export const dynamic = "force-dynamic";

// 대시보드 화면이 부르는 '오늘의 카드'. Supabase가 없으면 source=unconfigured → 화면은 '아직 데이터 없음'.
export async function GET() {
  const date = kstToday();
  if (!supabaseConfigured()) return NextResponse.json({ source: "unconfigured", date, cards: [] });
  try {
    return NextResponse.json({ source: "supabase", date, cards: await fetchTodayCards(date) });
  } catch {
    return NextResponse.json({ source: "error", date, cards: [] }, { status: 502 });
  }
}
