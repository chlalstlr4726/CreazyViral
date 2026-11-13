// 서버 전용: Supabase `cards` 테이블에서 카드를 읽는다 (승원 카드 API가 저장한 카드).
// SUPABASE_SECRET_KEY는 서버 환경변수로만 쓰고 브라우저로 내려보내지 않는다.
import type { Card } from "./types";

export const CARD_ID = /^\d{4}-\d{2}-\d{2}-(dummy|service)-\d+$/;

export const supabaseConfigured = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;

function table() {
  const key = process.env.SUPABASE_SECRET_KEY!;
  const url = new URL("/rest/v1/cards", process.env.SUPABASE_URL);
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL must be https");
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return { url, headers };
}

async function query(params: Record<string, string>) {
  const t = table();
  for (const [k, v] of Object.entries(params)) t.url.searchParams.set(k, v);
  const res = await fetch(t.url, { headers: t.headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`supabase_http_${res.status}`);
  return (await res.json()) as Record<string, unknown>[];
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** DB 행 → 대시보드 Card. 비어 있거나 null인 칸은 안전한 기본값으로 채운다. */
export function normalizeCard(row: Record<string, unknown>): Card {
  const audio = (row.audio ?? {}) as { name?: unknown; commercial_ok?: unknown };
  const d = Number(row.difficulty);
  return {
    card_id: String(row.card_id),
    date: String(row.date),
    type: row.type === "service" ? "service" : "dummy",
    title: String(row.title ?? ""),
    format: String(row.format ?? ""),
    rationale: String(row.rationale ?? ""),
    difficulty: (d === 1 || d === 2 || d === 3 ? d : 2) as 1 | 2 | 3,
    audio: { name: String(audio.name ?? "미정"), commercial_ok: !!audio.commercial_ok },
    storyboard: arr(row.storyboard),
    references: arr(row.references),
    caption_draft: String(row.caption_draft ?? ""),
    hashtags: arr<string>(row.hashtags),
    prompt: String(row.prompt ?? ""),
    asset_ids: arr<string>(row.asset_ids),
  };
}

const regenIndex = (id: string) => Number(id.slice(id.lastIndexOf("-") + 1));

/** 해당 날짜(KST)의 유형별 최신 카드(재생성 회차가 가장 큰 것) 최대 2장 */
export async function fetchTodayCards(date: string): Promise<Card[]> {
  const rows = await query({ select: "*", date: `eq.${date}` });
  const best = new Map<string, Card>();
  for (const row of rows) {
    const c = normalizeCard(row);
    const cur = best.get(c.type);
    if (!cur || regenIndex(c.card_id) > regenIndex(cur.card_id)) best.set(c.type, c);
  }
  return (["dummy", "service"] as const).flatMap((t) => (best.has(t) ? [best.get(t)!] : []));
}

export async function fetchCardById(id: string): Promise<Card | null> {
  if (!CARD_ID.test(id)) return null;
  const rows = await query({ select: "*", card_id: `eq.${id}` });
  return rows[0] ? normalizeCard(rows[0]) : null;
}
