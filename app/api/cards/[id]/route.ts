import { NextResponse } from "next/server";
import { CARD_ID, fetchCardById, supabaseConfigured } from "@/lib/cardsRepo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!CARD_ID.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "unconfigured" }, { status: 404 });
  try {
    const card = await fetchCardById(id);
    return card ? NextResponse.json({ card }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
