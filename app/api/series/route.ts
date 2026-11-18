import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { readCompetitorReels } from "@/lib/competitorRepo";
import { sb, sbConfigured } from "@/lib/sb";
import { generateSeries } from "@/lib/seriesGeneration";
import type { SeriesRun } from "@/lib/seriesTypes";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const table = "series_recommendation_runs";

export async function GET() {
  // 실행 기록이 없으면 지어낸 예시 대신 빈 상태만 보낸다(화면은 상태 글만 보인다).
  if (!sbConfigured()) return NextResponse.json({ run: null, state: "unconfigured" });
  try {
    const [row] = await sb<{ result: SeriesRun }[]>(table, { params: { select: "result", order: "created_at.desc", limit: "1" } });
    if (row) return NextResponse.json({ run: row.result, state: "ready" });
    return NextResponse.json({ run: null, state: "empty" });
  } catch (error) {
    if (error instanceof Error && error.message === "supabase_http_404") {
      return NextResponse.json({ run: null, state: "unavailable" });
    }
    return NextResponse.json({ error: "series_read_failed" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const token = process.env.SERIES_GENERATION_TOKEN;
  const authorization = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token ?? ""}`);
  if (!token || authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!sbConfigured() || !process.env.OPENAI_API_KEY || !process.env.SERIES_DRAFT_MODEL || !process.env.SERIES_JUDGE_MODEL) {
    return NextResponse.json({ error: "series_not_configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    (body.feedback !== undefined && (typeof body.feedback !== "string" || body.feedback.length > 2000))) {
    return NextResponse.json({ error: "invalid_feedback" }, { status: 400 });
  }
  try {
    await sb(table, { params: { select: "id", limit: "1" } });
    const run = await generateSeries(await readCompetitorReels(90), body.feedback?.trim() ?? "");
    await sb(table, { method: "POST", body: { result: run }, prefer: "return=minimal" });
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.error("Series generation:", reason);
    const insufficient = reason === "insufficient_evidence";
    return NextResponse.json({ error: insufficient ? reason : "series_generation_failed" }, { status: insufficient ? 422 : 502 });
  }
}
