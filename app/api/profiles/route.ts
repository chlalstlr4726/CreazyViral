import { NextResponse } from "next/server";
import { ACCOUNT_BY_ID, type AccountId } from "@/lib/accounts";
import { sanitizeConcept, sanitizeMaterials } from "@/lib/chat";
import { fetchProfiles, profilesConfigured, saveProfile } from "@/lib/profilesRepo";

export const dynamic = "force-dynamic";

// 계정별 컨셉·소재 저장소. Supabase(`account_profiles`)가 준비돼 있으면 팀 공용으로 저장하고,
// 아니면 source=local 을 돌려줘서 화면이 이 브라우저에만 저장한다.
export async function GET() {
  if (!profilesConfigured()) return NextResponse.json({ source: "local", profiles: {} });
  try {
    return NextResponse.json({ source: "supabase", profiles: await fetchProfiles() });
  } catch {
    return NextResponse.json({ source: "local", reason: "table_unavailable", profiles: {} });
  }
}

export async function PUT(req: Request) {
  if (!profilesConfigured()) return NextResponse.json({ source: "local" });
  try {
    const b = (await req.json()) as { accountId?: string; concept?: unknown; materials?: unknown };
    const acc = ACCOUNT_BY_ID[b.accountId as AccountId];
    if (!acc) return NextResponse.json({ ok: false, error: "unknown_account" }, { status: 400 });
    await saveProfile(acc.id, sanitizeConcept(b.concept as never, acc.concept), sanitizeMaterials(b.materials, acc.materials));
    return NextResponse.json({ source: "supabase", ok: true });
  } catch {
    return NextResponse.json({ source: "local", reason: "save_failed" });
  }
}
