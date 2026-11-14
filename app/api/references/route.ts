import { NextResponse } from "next/server";
import { loadReferences } from "@/lib/references";

export const dynamic = "force-dynamic";

// 바이럴 레퍼런스 목록. 응답 형태는 docs/REFERENCE_API.md 참고.
export async function GET(req: Request) {
  const days = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 7));
  const { items, sample } = await loadReferences();
  const cutoff = Date.now() - days * 86400_000;
  return NextResponse.json({ sample, days, items: items.filter((r) => +new Date(r.posted_at) >= cutoff) });
}
