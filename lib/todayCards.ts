import type { Card, CardType } from "./types";
import { makeCard, tplsOf } from "./mock";

/** 한국 시간(KST) 기준 오늘 날짜 YYYY-MM-DD. 서버는 UTC로 돌기 때문에 직접 계산한다. */
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 서버(크론)가 쓰는 '오늘의 카드 2장'.
 * ⚠️ 임시: 샘플 템플릿을 날짜로 돌려가며 고른다. 승원 카드 API / Supabase `cards` 연결 후
 * 이 함수 하나를 DB 조회(date = 오늘)로 교체하면 크론·슬랙 전송은 그대로 동작한다.
 */
export function getTodayCards(date = kstToday()): Card[] {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400_000);
  const pick = (type: CardType): Card => {
    const tpls = tplsOf(type);
    return makeCard(tpls[day % tpls.length], date, 0);
  };
  return [pick("dummy"), pick("service")];
}
