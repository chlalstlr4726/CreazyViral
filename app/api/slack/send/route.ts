import { NextResponse } from "next/server";
import type { Card } from "@/lib/types";
import { buildCardBlocks, postToSlack } from "@/lib/slack";

// 화면에서 보고 있는 오늘의 카드를 받아 Slack으로 보낸다.
// (카드는 요청 본문으로 받는다. 화면은 카드 DB에서 읽은 실제 카드만 보낸다. 승원 API 연결 후에는 서버가 직접 조회)
// 주의: 로그인/권한이 아직 없는 내부용 엔드포인트라 배포 전에 접근 제한을 붙여야 해요.
export async function POST(req: Request) {
  let body: { cards?: Card[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const cards = body.cards;
  const valid =
    Array.isArray(cards) &&
    cards.length >= 1 &&
    cards.length <= 6 &&
    cards.every(
      (c) =>
        typeof c?.card_id === "string" &&
        typeof c.title === "string" &&
        typeof c.format === "string" &&
        typeof c.rationale === "string" &&
        (c.type === "dummy" || c.type === "service") &&
        [1, 2, 3].includes(c.difficulty) &&
        Array.isArray(c.storyboard),
    );
  if (!valid) return NextResponse.json({ ok: false, error: "bad_cards" }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
  const result = await postToSlack(buildCardBlocks(cards!, baseUrl), `오늘 만들 콘텐츠 ${cards!.length}가지가 도착했어요`);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
