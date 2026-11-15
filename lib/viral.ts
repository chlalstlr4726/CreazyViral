import { VIRAL_SEED, type ViralReel } from "./viralSeed";
import { sb, sbConfigured } from "./sb";
import { readLatestDailyRecs } from "./dailyRecs";

export type { ViralReel };
export type ViralSource = "daily_recs" | "supabase" | "sample";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * 수집/분석된 바이럴 릴스. Supabase `reels`(수집 파이프라인이 분석해 올린 표) 중 verdict가 '터짐'인 최근 30일 영상.
 * 설정이 없거나 조회에 실패하면 코드에 들어 있는 수집 샘플로 대신한다.
 */
export async function loadViral(): Promise<{ rows: ViralReel[]; source: ViralSource }> {
  if (!sbConfigured()) return { rows: VIRAL_SEED, source: "sample" };
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const data = await sb<Row[]>("reels", {
      params: {
        select: "shortcode,url,username,caption,plays,likes,comments,shares,posted_at,duration_sec,music_title,keyword,followers,reach_x,verdict_reason,paid_partnership",
        verdict: "eq.터짐",
        posted_at: `gte.${since}`,
        order: "plays.desc",
        limit: "300",
      },
    });
    const rows: ViralReel[] = data
      .filter((r) => r.posted_at && r.url)
      .map((r) => ({
        id: String(r.shortcode),
        url: String(r.url),
        user: String(r.username ?? ""),
        caption: clip(r.caption, 300),
        plays: num(r.plays),
        likes: num(r.likes),
        comments: num(r.comments),
        shares: num(r.shares),
        at: String(r.posted_at),
        sec: Math.round(num(r.duration_sec)),
        music: clip(r.music_title, 60),
        kw: clip(r.keyword, 30),
        followers: r.followers == null ? undefined : num(r.followers),
        reach_x: r.reach_x == null ? undefined : num(r.reach_x),
        reason: clip(r.verdict_reason, 120),
        paid: typeof r.paid_partnership === "boolean" ? r.paid_partnership : null,
      }));
    return rows.length ? { rows, source: "supabase" } : { rows: VIRAL_SEED, source: "sample" };
  } catch {
    return { rows: VIRAL_SEED, source: "sample" };
  }
}

/** 수집된 데이터의 가장 최근 날짜를 '오늘'로 보고, 최근 N일 중 조회수 상위 N개 */
export function topViral(rows: ViralReel[], days: number, limit = 5): ViralReel[] {
  if (!rows.length) return [];
  const latest = Math.max(...rows.map((r) => +new Date(r.at)));
  const cutoff = latest - days * 86400_000;
  return rows
    .filter((r) => +new Date(r.at) >= cutoff)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
}

/**
 * 홈 Top 5와 AI 스토리보드가 쓰는 목록.
 * 1순위: `daily_recs`(도하가 매일 승인한 추천)의 가장 최근 추천일 상위 limit편(rank 순). 이때 days는 쓰지 않는다.
 * 2순위: 표가 비었거나 읽기에 실패하면 예전처럼 `reels` '터짐' 최근 days일 조회수 순(없으면 샘플).
 */
export async function loadHomeTop(days: number, limit = 5): Promise<{ items: ViralReel[]; source: ViralSource; recDate?: string }> {
  if (sbConfigured()) {
    try {
      const recs = await readLatestDailyRecs(limit);
      if (recs.length) return { items: recs, source: "daily_recs", recDate: recs[0].recDate };
    } catch {
      // daily_recs가 없거나 읽기 실패 → 아래 예전 방식으로
    }
  }
  const { rows, source } = await loadViral();
  return { items: topViral(rows, days, limit), source };
}
