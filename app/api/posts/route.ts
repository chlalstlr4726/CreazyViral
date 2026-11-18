import { NextResponse } from "next/server";
import { ACCOUNT_PROFILES } from "@/lib/accounts";
import { sb, sbConfigured } from "@/lib/sb";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0) || 0;

// 대시보드가 읽는 게시물 성과. Supabase가 없으면 source "unconfigured"(화면은 데이터 없음으로 보인다).
// 계정이 연결되지 않았거나 아직 수집 전이면 accounts[id].connected 가 false.
export async function GET() {
  if (!sbConfigured()) return NextResponse.json({ source: "unconfigured" });
  try {
    const since = new Date(Date.now() - 120 * 86400_000).toISOString();
    const [accts, scored] = await Promise.all([
      sb<Row[]>("ig_accounts", { params: { select: "id,handle,followers,status,token_expires_at" } }),
      sb<Row[]>("v_post_scored", {
        params: { select: "id,account_id,url,caption,posted_at,card_id,card_type,card_format,views,reach,likes,comments,shares,saves", posted_at: `gte.${since}`, order: "posted_at.desc", limit: "400" },
      }),
    ]);
    const cps = scored.length
      ? await sb<Row[]>("post_metric_snapshots", { params: { select: "post_id,checkpoint,views,captured_at", checkpoint: "in.(24h,72h,7d)", limit: "2000" } })
      : [];
    const last = await sb<Row[]>("post_metric_snapshots", { params: { select: "captured_at", order: "captured_at.desc", limit: "1" } });

    const slugByUuid = new Map<string, string>();
    const accounts: Record<string, { connected: boolean; followers: number | null; token_expires_at: string | null }> = {};
    for (const p of ACCOUNT_PROFILES) {
      const row = accts.find((a) => a.handle === p.handle);
      if (row) slugByUuid.set(String(row.id), p.id);
      accounts[p.id] = { connected: row?.status === "connected", followers: row?.followers == null ? null : n(row.followers), token_expires_at: (row?.token_expires_at as string) ?? null };
    }
    const posts = scored
      .filter((r) => slugByUuid.has(String(r.account_id)))
      .map((r) => {
        const checkpoints: Record<string, number> = {};
        for (const c of cps) if (c.post_id === r.id && c.checkpoint) checkpoints[String(c.checkpoint)] = n(c.views);
        return {
          id: String(r.id),
          account_id: slugByUuid.get(String(r.account_id))!,
          url: String(r.url),
          caption: String(r.caption ?? ""),
          posted_at: String(r.posted_at),
          card_id: r.card_id ? String(r.card_id) : null,
          format: r.card_format ? String(r.card_format) : null,
          type: r.card_type === "service" ? "service" : r.card_type === "dummy" ? "dummy" : null,
          metrics: { views: n(r.views), reach: n(r.reach), likes: n(r.likes), comments: n(r.comments), shares: n(r.shares), saves: n(r.saves) },
          checkpoints,
        };
      });
    return NextResponse.json({ source: "instagram", accounts, posts, last_captured_at: (last[0]?.captured_at as string) ?? null });
  } catch {
    return NextResponse.json({ source: "error" });
  }
}
