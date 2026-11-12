import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { buildCardBlocks, postToSlack } from "@/lib/slack";
import { getTodayCards } from "@/lib/todayCards";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // 비밀키가 없으면 아무도 호출할 수 없게 막는다
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// 매일 오전 9시(KST)에 Vercel Cron이 호출 → 오늘의 카드 2장을 슬랙으로 전송.
// 직접 시험: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-slack
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const cards = getTodayCards();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
  const result = await postToSlack(buildCardBlocks(cards, baseUrl), "오늘 만들 콘텐츠 2가지가 도착했어요");
  return NextResponse.json({ ...result, cards: cards.map((c) => c.card_id) }, { status: result.ok ? 200 : 502 });
}
