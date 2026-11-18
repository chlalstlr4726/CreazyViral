import { NextResponse } from "next/server";
import { ACCOUNT_BY_ID, type AccountId } from "@/lib/accounts";
import { buildSystem, buildUser, parseStory, pickMaterial, sanitizeConcept, sanitizeMaterials, templateStory } from "@/lib/chat";
import { loadHomeTop } from "@/lib/viral";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 계정별 AI 스토리보드. 계정 ID와 (화면에서 편집한) 컨셉/소재를 받아 최근 바이럴 상위 영상 구조로 스토리보드를 만든다.
// ANTHROPIC_API_KEY가 없으면 규칙 기반 초안을 돌려준다.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const account = ACCOUNT_BY_ID[body.accountId as AccountId];
  if (!account) return NextResponse.json({ ok: false, error: "unknown_account" }, { status: 400 });

  const days = [3, 7, 14].includes(Number(body.days)) ? Number(body.days) : 3;
  const message = String(body.message ?? "").trim().slice(0, 1000) || "최근 우리 소재로, 최근 며칠간 탑5 바이럴 구조에 맞는 스토리보드 하나 짜줘";
  const concept = sanitizeConcept(body.concept as never, account.concept);
  const materials = sanitizeMaterials(body.materials, account.materials);
  const focus = pickMaterial(materials, typeof body.materialId === "string" ? body.materialId : undefined);
  const viral = (await loadHomeTop(days, 5)).items;

  const key = process.env.ANTHROPIC_API_KEY;
  const used = { viral, material: focus ? { id: focus.id, title: focus.title } : null, days };
  if (!key) return NextResponse.json({ ok: true, story: templateStory(account, concept, focus, viral), used });

  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-6)
    .map((h) => ({ role: (h as { role?: string })?.role === "assistant" ? "assistant" : "user", content: String((h as { content?: unknown })?.content ?? "").slice(0, 4000) }))
    .filter((h) => h.content);
  while (history[0]?.role === "assistant") history.shift(); // 대화는 사용자 메시지로 시작해야 한다

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 8000,
        system: buildSystem(),
        messages: [
          // 첫 요청에는 계정 정보 전체를, 이어지는 수정 요청에는 이전 결과를 함께 보낸다
          ...history,
          { role: "user", content: buildUser({ account, concept, materials, focus, viral, days, message }) },
        ],
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `ai_http_${res.status}` }, { status: 502 });
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const story = parseStory(text, focus?.title ?? "");
    if (!story) return NextResponse.json({ ok: false, error: "ai_parse_failed" }, { status: 502 });
    return NextResponse.json({ ok: true, story, used });
  } catch {
    return NextResponse.json({ ok: false, error: "ai_unreachable" }, { status: 502 });
  }
}
