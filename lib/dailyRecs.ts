import { sb, sbConfigured } from "@/lib/sb";
import type { ViralReel } from "@/lib/viralTypes";

// Supabase `daily_recs` 표: 매일 아침 자동으로 고른 피드 상위 10편(한 줄 = 그날 추천한 릴스 한 편).
// 서버에서만 읽는다(서버 키). 칸 설명은 supabase/migrations/005_daily_recs.sql.
type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const opt = (v: unknown) => (v == null ? undefined : Number(v));
const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** 가장 최근 추천일(rec_date)의 노션 10줄(in_top10) 가운데 rank 순 상위 limit편. 표가 비었으면 빈 배열. */
export async function readLatestDailyRecs(limit = 5): Promise<ViralReel[]> {
  if (!sbConfigured()) throw new Error("supabase_not_configured");
  const [latest] = await sb<{ rec_date: string }[]>("daily_recs", {
    params: { select: "rec_date", order: "rec_date.desc", limit: "1" },
  });
  if (!latest) return [];
  const rows = await sb<Row[]>("daily_recs", {
    params: {
      select: "rec_date,rank,shortcode,url,username,caption,posted_at,plays,likes,comments,shares,duration_sec,followers,multiple,category,hook_3s,reason,ad_status,ai_made,music_title,caution",
      rec_date: `eq.${latest.rec_date}`,
      in_top10: "eq.true",
      order: "rank.asc",
      limit: String(limit),
    },
  });
  return rows
    .filter((r) => r.url && r.shortcode)
    .map((r) => ({
      id: String(r.shortcode),
      url: String(r.url),
      user: String(r.username ?? ""),
      caption: clip(r.caption, 300),
      plays: num(r.plays),
      likes: num(r.likes),
      comments: num(r.comments),
      shares: num(r.shares),
      at: String(r.posted_at ?? latest.rec_date),
      sec: Math.round(num(r.duration_sec)),
      music: clip(r.music_title, 60),
      kw: clip(r.category, 30),
      followers: opt(r.followers),
      reason: clip(r.reason, 200),
      paid: r.ad_status === "광고" ? true : r.ad_status === "광고 아님" ? false : null,
      rank: num(r.rank),
      recDate: String(r.rec_date),
      multiple: r.multiple == null ? null : Number(r.multiple),
      caution: r.caution == null ? null : clip(r.caution, 200),
      aiMade: (["예", "아니오", "모름"] as const).find((v) => v === r.ai_made) ?? null,
      hook: clip(r.hook_3s, 120),
    }));
}
