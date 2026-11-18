import { NextResponse } from "next/server";
import { ACCOUNT_BY_ID, type AccountId } from "@/lib/accounts";
import { STORY_SCHEMA, basisLabel, buildEditTask, buildShared, buildSystem, parseStory, pickMaterial, sanitizeConcept, sanitizeMaterials, templateStory, type Basis } from "@/lib/chat";
import { callClaude } from "@/lib/claude";
import { SONNET, runGrid, type GridEvent } from "@/lib/storyGrid";
import { loadHomeTop } from "@/lib/viral";

export const dynamic = "force-dynamic";
// 36칸(Haiku, 생각 켬) + 고르기(Sonnet)가 넉넉히 끝나게 300초. Vercel Hobby(Fluid compute)의 최대값이 300초다.
export const maxDuration = 300;

// 계정별 AI 스토리보드.
// - 처음 요청: Haiku가 36칸(훅 방식 4 × 전개 9)을 만들고 Sonnet이 4개를 고른다. 진행을 NDJSON(한 줄에 사건 하나)으로 흘려 보낸다.
// - 수정 요청(body.edit.story가 있을 때): 고른 스토리보드 하나를 Sonnet이 고쳐 JSON으로 한 번에 돌려준다.
// - ANTHROPIC_API_KEY가 없으면 규칙 기반 초안 1개를 JSON으로 돌려준다(표 없음).
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
  const message = String(body.message ?? "").trim().slice(0, 1000) || "우리 소재로, 위 바이럴 Top 5 구조에 맞는 스토리보드를 짜줘";
  const concept = sanitizeConcept(body.concept as never, account.concept);
  const materials = sanitizeMaterials(body.materials, account.materials);
  const materialId = typeof body.materialId === "string" ? body.materialId : undefined;
  const focus = pickMaterial(materials, materialId);
  const top = await loadHomeTop(days, 5);
  const viral = top.items;
  const basis: Basis = { source: top.source, recDate: top.recDate, days };
  const used = { viral, material: focus ? { id: focus.id, title: focus.title } : null, days, basis: basisLabel(basis, viral.length) };

  const key = process.env.ANTHROPIC_API_KEY;
  const edit = body.edit as { story?: unknown } | undefined;

  if (edit?.story) {
    const current = parseStory(JSON.stringify(edit.story), focus?.title ?? "");
    if (!current) return NextResponse.json({ ok: false, error: "bad_story" }, { status: 400 });
    if (!key) return NextResponse.json({ ok: false, error: "edit_needs_ai" }, { status: 400 });
    const r = await callClaude({
      key,
      model: process.env.ANTHROPIC_MODEL || SONNET,
      system: buildSystem(),
      content: [
        { type: "text", text: buildShared({ account, concept, materials, focus, viral, basis, message }) },
        { type: "text", text: buildEditTask(current, message) },
      ],
      maxTokens: 16000,
      effort: "medium",
      schema: STORY_SCHEMA,
      signal: AbortSignal.timeout(240_000),
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: `ai_${r.error}` }, { status: 502 });
    const story = parseStory(r.text, current.material);
    if (!story) return NextResponse.json({ ok: false, error: "ai_parse_failed" }, { status: 502 });
    return NextResponse.json({ ok: true, story, used });
  }

  if (!key) return NextResponse.json({ ok: true, story: templateStory(account, concept, focus, viral), used });

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (e: GridEvent) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await runGrid({
          key,
          account,
          concept,
          materials,
          focus,
          explicitMaterial: !!materialId && materialId !== "auto",
          viral,
          basis,
          message,
          signal: req.signal,
          emit,
        });
      } catch {
        emit({ type: "error", error: "server_error" });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      // no-transform: 개발 서버의 압축이 줄을 모아 두지 않게(만들어지는 대로 화면에 닿게)
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
