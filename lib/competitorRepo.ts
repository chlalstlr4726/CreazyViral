import { sb, sbConfigured } from "@/lib/sb";
import { multipleOf, type ViralReference } from "@/lib/references";

export async function readCompetitorReels(days: number): Promise<ViralReference[]> {
  if (!sbConfigured()) throw new Error("supabase_not_configured");
  const now = new Date();
  const cutoff = new Date(+now - days * 86_400_000);
  const result: ViralReference[] = [];
  const limit = 250;
  for (let offset = 0; ; offset += limit) {
    const rows = await sb<ViralReference[]>("competitor_reels", {
      params: {
        select: "id,url,username,posted_at,plays,usual_plays,multiple,followers,category,region,hook_3s,duration_s,flow,cta,is_ad,reason,format_key",
        posted_at: `gte.${cutoff.toISOString()}`,
        and: `(posted_at.lte.${now.toISOString()})`,
        order: "posted_at.desc,id.asc",
        limit: String(limit),
        offset: String(offset),
      },
    });
    result.push(...rows);
    if (rows.length < limit) return result;
  }
}

export function summarizeCompetitors(items: ViralReference[]) {
  const accounts = new Map<string, { username: string; reels: number; peak: number | null }>();
  const formats = new Map<string, { format: string; accounts: Set<string>; reels: number }>();
  const qualifying = items.filter((item) => (multipleOf(item) ?? 0) >= 3);
  for (const item of qualifying) {
    const username = item.username.trim().replace(/^@/, "").toLowerCase();
    if (!username) continue;
    const account = accounts.get(username) ?? { username, reels: 0, peak: null };
    account.reels++;
    account.peak = Math.max(account.peak ?? 0, multipleOf(item) ?? 0);
    accounts.set(username, account);
    const format = item.format_key?.trim();
    if (!format) continue;
    const group = formats.get(format) ?? { format, accounts: new Set<string>(), reels: 0 };
    group.accounts.add(username);
    group.reels++;
    formats.set(format, group);
  }
  return {
    viralReels: qualifying.length,
    accounts: [...accounts.values()].sort((a, b) => (b.peak ?? 0) - (a.peak ?? 0)),
    formats: [...formats.values()]
      .filter((group) => group.accounts.size >= 2)
      .map((group) => ({ format: group.format, accounts: group.accounts.size, reels: group.reels }))
      .sort((a, b) => b.accounts - a.accounts || b.reels - a.reels),
  };
}
