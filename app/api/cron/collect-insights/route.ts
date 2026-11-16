import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { collectAll } from "@/lib/instagram";
import { sbConfigured } from "@/lib/sb";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Vercel Cron이 호출: 계정 3개의 릴스와 성과(조회수, 도달, 좋아요, 댓글, 공유, 저장)를 읽어 DB에 쌓는다.
// 직접 시험: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect-insights
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!sbConfigured()) return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  const results = await collectAll();
  return NextResponse.json({ ok: results.some((r) => r.ok), results });
}
