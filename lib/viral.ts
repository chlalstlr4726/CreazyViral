import { VIRAL_SEED, type ViralReel } from "./viralSeed";

export type { ViralReel };

/** 수집된 바이럴 릴스. 매일 수집이 DB에 연결되면 이 함수만 DB 조회로 바꾸면 됩니다. */
export async function loadViral(): Promise<ViralReel[]> {
  return VIRAL_SEED;
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
