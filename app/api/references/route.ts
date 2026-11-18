import { NextResponse } from "next/server";
import { readCompetitorReels, summarizeCompetitors } from "@/lib/competitorRepo";
import { sbConfigured } from "@/lib/sb";

export const dynamic = "force-dynamic";

// 바이럴 레퍼런스 목록. 응답 형태는 docs/REFERENCE_API.md 참고.
export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 7);
  if (![3, 7, 14].includes(days)) return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  try {
    // Supabase가 없으면 지어낸 예시 대신 빈 목록(화면은 '조건에 맞는 영상이 없어요').
    const items = sbConfigured() ? await readCompetitorReels(days) : [];
    return NextResponse.json({ sample: false, days, items, summary: summarizeCompetitors(items) });
  } catch {
    return NextResponse.json({ error: "references_unavailable" }, { status: 502 });
  }
}
