import type { Card } from "./types";
import { fetchTodayCards, supabaseConfigured } from "./cardsRepo";
import { kstToday } from "./format";

export { kstToday };

/**
 * 서버(크론)가 쓰는 오늘의 카드.
 * - Supabase 설정됨: `cards` 테이블의 오늘(KST) 카드
 * - 미설정: 빈 목록 (가짜 카드를 팀에 보내지 않는다)
 */
export async function getTodayCards(date = kstToday()) {
  if (supabaseConfigured()) return { source: "supabase" as const, cards: await fetchTodayCards(date) };
  return { source: "unconfigured" as const, cards: [] as Card[] };
}
