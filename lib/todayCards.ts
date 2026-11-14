import type { Card, CardType } from "./types";
import { makeCard, tplsOf } from "./mock";
import { ACCOUNT_PROFILES } from "./accounts";
import { fetchTodayCards, supabaseConfigured } from "./cardsRepo";

/** 한국 시간(KST) 기준 오늘 날짜 YYYY-MM-DD. 서버는 UTC로 돌기 때문에 직접 계산한다. */
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 개발용 샘플 카드 (Supabase가 설정되지 않았을 때만 사용) */
function sampleTodayCards(date: string): Card[] {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400_000);
  const pick = (type: CardType, account: (typeof ACCOUNT_PROFILES)[number]["id"]): Card => {
    const tpls = tplsOf(type, account);
    return makeCard(tpls[day % tpls.length], date, 0);
  };
  return ACCOUNT_PROFILES.flatMap((a) => [pick("dummy", a.id), pick("service", a.id)]);
}

/**
 * 서버(크론)가 쓰는 오늘의 카드.
 * - Supabase 설정됨: `cards` 테이블의 오늘(KST) 카드
 * - 미설정 + 개발 환경: 샘플 카드
 * - 미설정 + 운영 환경: 빈 목록 (샘플 카드를 팀에 보내지 않도록)
 */
export async function getTodayCards(date = kstToday()) {
  if (supabaseConfigured()) return { source: "supabase" as const, cards: await fetchTodayCards(date) };
  if (process.env.NODE_ENV !== "production") return { source: "sample" as const, cards: sampleTodayCards(date) };
  return { source: "unconfigured" as const, cards: [] as Card[] };
}
