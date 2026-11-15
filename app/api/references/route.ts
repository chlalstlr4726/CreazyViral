import { NextResponse } from "next/server";
import { loadReferences } from "@/lib/references";
import { readCompetitorReels, summarizeCompetitors } from "@/lib/competitorRepo";
import { sbConfigured } from "@/lib/sb";

export const dynamic = "force-dynamic";

// 바이럴 레퍼런스 목록. 응답 형태는 docs/REFERENCE_API.md 참고.
export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 7);
  if (![3, 7, 14].includes(days)) return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  try {
    const sample = !sbConfigured();
    const items = sample
      ? (await loadReferences()).items.filter((r) => +new Date(r.posted_at) >= Date.now() - days * 86_400_000)
      : await readCompetitorReels(days);
    return NextResponse.json({ sample, days, items, summary: summarizeCompetitors(items) });
  } catch {
    return NextResponse.json({ error: "references_unavailable" }, { status: 502 });
  }
}
