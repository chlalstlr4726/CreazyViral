import type { Post, PostWithScore } from "./types";
import { mean, median } from "./format";

/**
 * 성과 점수 = 조회수 ÷ 같은 계정의 직전 게시물(최대 20개) 조회수 중앙값
 * - 계정 규모가 달라도 비교 가능 (1.0x = 평소 수준)
 * - 직전 게시물이 3개 미만이면 해당 계정 전체 중앙값(자기 자신 제외)을 사용
 */
export function scorePosts(posts: Post[]): PostWithScore[] {
  const byAccount = new Map<string, Post[]>();
  for (const p of [...posts].sort((a, b) => +new Date(a.posted_at) - +new Date(b.posted_at))) {
    byAccount.set(p.account_id, [...(byAccount.get(p.account_id) ?? []), p]);
  }
  const out: PostWithScore[] = [];
  for (const list of byAccount.values()) {
    list.forEach((p, idx) => {
      const prev = list.slice(Math.max(0, idx - 20), idx).map((x) => x.metrics.views);
      const baseline =
        prev.length >= 3
          ? median(prev)
          : median(list.filter((x) => x.id !== p.id).map((x) => x.metrics.views));
      out.push({ ...p, baseline, multiple: baseline > 0 ? p.metrics.views / baseline : 1 });
    });
  }
  return out.sort((a, b) => +new Date(b.posted_at) - +new Date(a.posted_at));
}

export const MIN_N_FOR_FORMAT = 3;

export interface FormatStat {
  format: string;
  n: number;
  medianMultiple: number;
  avgViews: number;
  lowN: boolean;
}

/** 포맷별 성과: 카드와 연결된 게시물만 대상. 표본 3개 미만은 '참고용'으로 표시 */
export function formatStats(posts: PostWithScore[]): FormatStat[] {
  const g = new Map<string, PostWithScore[]>();
  for (const p of posts) {
    if (!p.format) continue;
    g.set(p.format, [...(g.get(p.format) ?? []), p]);
  }
  return [...g.entries()]
    .map(([format, list]) => ({
      format,
      n: list.length,
      medianMultiple: median(list.map((p) => p.multiple)),
      avgViews: mean(list.map((p) => p.metrics.views)),
      lowN: list.length < MIN_N_FOR_FORMAT,
    }))
    .sort((a, b) => b.medianMultiple - a.medianMultiple);
}

export interface Kpi {
  label: string;
  value: number;
  prev: number;
  kind: "count" | "multiple";
}

export function kpis(cur: PostWithScore[], prev: PostWithScore[]): Kpi[] {
  const sum = (l: PostWithScore[], f: (p: PostWithScore) => number) => l.reduce((a, p) => a + f(p), 0);
  return [
    { label: "총 조회수", value: sum(cur, (p) => p.metrics.views), prev: sum(prev, (p) => p.metrics.views), kind: "count" },
    { label: "게시물 수", value: cur.length, prev: prev.length, kind: "count" },
    {
      label: "좋아요 · 댓글",
      value: sum(cur, (p) => p.metrics.likes + p.metrics.comments),
      prev: sum(prev, (p) => p.metrics.likes + p.metrics.comments),
      kind: "count",
    },
    {
      label: "공유 · 저장",
      value: sum(cur, (p) => p.metrics.shares + p.metrics.saves),
      prev: sum(prev, (p) => p.metrics.shares + p.metrics.saves),
      kind: "count",
    },
    {
      label: "평균 성과 (계정 평균 대비)",
      value: median(cur.map((p) => p.multiple)),
      prev: median(prev.map((p) => p.multiple)),
      kind: "multiple",
    },
  ];
}

export function dailySeries(posts: PostWithScore[], dates: string[]) {
  const m = new Map<string, number>(dates.map((d) => [d, 0]));
  for (const p of posts) {
    const d = new Date(p.posted_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (m.has(key)) m.set(key, (m.get(key) ?? 0) + p.metrics.views);
  }
  return dates.map((date) => ({ date, views: m.get(date) ?? 0 }));
}
