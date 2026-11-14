"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Card, CardEvent, CardType, Post, PostWithScore } from "./types";
import { HISTORY_CARDS, POSTS, SEED_EVENTS, TODAY, todayPool } from "./mock";
import { scorePosts } from "./analytics";
import { ACCOUNT_PROFILES, type AccountId } from "./accounts";

const KEY = "viral-dashboard:events:v1";

export const shortcode = (url: string) => url.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;

/** 오늘의 카드가 어디서 왔는지: supabase = 실제 카드 DB, sample = 샘플, error = DB 연결 실패(샘플로 대체) */
export type CardSource = "loading" | "supabase" | "sample" | "error";

interface Store {
  ready: boolean;
  cardSource: CardSource;
  events: CardEvent[];
  cardById: (id: string) => Card | undefined;
  addCard: (card: Card) => void;
  todayCard: (type: CardType, account: AccountId) => Card | undefined;
  /** 3개 계정의 오늘 카드 전부 (히스토리/개발자 제언용) */
  allTodayCards: () => Card[];
  statusOf: (id: string) => "selected" | "passed" | null;
  passReasonOf: (id: string) => string | undefined;
  linkedUrlOf: (id: string) => string | undefined;
  select: (id: string) => void;
  pass: (id: string, reason: string) => void;
  regenerate: (type: CardType, account: AccountId) => void;
  linkPost: (id: string, url: string) => "matched" | "pending";
  posts: PostWithScore[];
  toast: string | null;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider missing");
  return v;
};

const pools = Object.fromEntries(
  ACCOUNT_PROFILES.map((a) => [a.id, { dummy: todayPool("dummy", a.id), service: todayPool("service", a.id) }]),
) as Record<AccountId, Record<CardType, Card[]>>;
const cardIndex = new Map<string, Card>();
[...HISTORY_CARDS, ...Object.values(pools).flatMap((p) => [...p.dummy, ...p.service])].forEach((c) => cardIndex.set(c.card_id, c));

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [local, setLocal] = useState<CardEvent[]>([]);
  const [localReady, setLocalReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ source: CardSource; cards: Card[] }>({ source: "loading", cards: [] });
  const [extra, setExtra] = useState<Card[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLocal(JSON.parse(raw));
    } catch {}
    setLocalReady(true);
  }, []);

  // 오늘의 카드: 서버가 Supabase `cards`에서 읽어 준다. 설정이 없으면 샘플 카드로 동작.
  useEffect(() => {
    fetch("/api/cards/today", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { source?: string; cards?: Card[] }) =>
        setRemote(d.source === "supabase" ? { source: "supabase", cards: d.cards ?? [] } : { source: d.source === "error" ? "error" : "sample", cards: [] }),
      )
      .catch(() => setRemote({ source: "error", cards: [] }));
  }, []);

  const push = useCallback((e: Omit<CardEvent, "id" | "at">) => {
    setLocal((prev) => {
      const next = [...prev, { ...e, id: `l${Date.now()}${prev.length}`, at: new Date().toISOString() }];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const events = useMemo(() => [...SEED_EVENTS, ...local], [local]);

  // DB에서 받은 카드가 같은 id의 샘플 카드보다 우선
  const cardById = useCallback(
    (id: string) => remote.cards.find((c) => c.card_id === id) ?? extra.find((c) => c.card_id === id) ?? cardIndex.get(id),
    [remote.cards, extra],
  );

  const addCard = useCallback((card: Card) => setExtra((prev) => (prev.some((c) => c.card_id === card.card_id) ? prev : [...prev, card])), []);

  const regenCount = useCallback(
    (type: CardType, account: AccountId) =>
      events.filter((e) => e.action === "regenerated" && e.card_id.startsWith(`${TODAY}-${type}-${account}-`)).length,
    [events],
  );

  const todayCard = useCallback(
    (type: CardType, account: AccountId): Card | undefined =>
      remote.source === "supabase"
        ? remote.cards.find((c) => c.type === type && c.account_id === account)
        : pools[account][type][regenCount(type, account) % pools[account][type].length],
    [remote, regenCount],
  );

  const allTodayCards = useCallback(
    () => ACCOUNT_PROFILES.flatMap((a) => (["dummy", "service"] as const).map((t) => todayCard(t, a.id)).filter(Boolean) as Card[]),
    [todayCard],
  );

  const latest = useCallback(
    (id: string, action: CardEvent["action"]) => [...events].reverse().find((e) => e.card_id === id && e.action === action),
    [events],
  );

  const statusOf = useCallback(
    (id: string) => {
      const s = latest(id, "selected");
      const p = latest(id, "passed");
      if (s && (!p || s.at >= p.at)) return "selected" as const;
      if (p) return "passed" as const;
      return null;
    },
    [latest],
  );

  const posts = useMemo(() => {
    const linkEvents = events.filter((e) => e.action === "linked" && e.post_url);
    const merged: Post[] = POSTS.map((p) => {
      const code = shortcode(p.url);
      const ev = [...linkEvents].reverse().find((e) => shortcode(e.post_url!) === code);
      const card = ev ? cardById(ev.card_id) : undefined;
      return card ? { ...p, card_id: card.card_id, format: card.format, type: card.type } : p;
    });
    return scorePosts(merged);
  }, [events, cardById]);

  const value: Store = {
    ready: localReady && remote.source !== "loading",
    cardSource: remote.source,
    events,
    cardById,
    addCard,
    todayCard,
    allTodayCards,
    statusOf,
    passReasonOf: (id) => latest(id, "passed")?.reason,
    linkedUrlOf: (id) => latest(id, "linked")?.post_url,
    select: (id) => {
      push({ card_id: id, action: "selected" });
      flash("카드를 선택했어요. 스토리보드를 확인하세요");
    },
    pass: (id, reason) => {
      push({ card_id: id, action: "passed", reason });
      flash(`패스 사유를 기록했어요: ${reason}`);
    },
    regenerate: (type, account) => {
      if (remote.source === "supabase") {
        flash("재생성은 카드 API의 재생성 기능이 연결되면 사용할 수 있어요");
        return;
      }
      const cur = todayCard(type, account);
      if (!cur) return;
      push({ card_id: cur.card_id, action: "regenerated" });
      flash("다른 소재로 다시 만들었어요");
    },
    linkPost: (id, url) => {
      push({ card_id: id, action: "linked", post_url: url });
      const code = shortcode(url);
      const hit = POSTS.some((p) => shortcode(p.url) === code);
      flash(hit ? "게시물을 연결했어요. 성과가 바로 반영돼요" : "URL을 등록했어요. 성과 수집을 기다리는 중이에요");
      return hit ? "matched" : "pending";
    },
    posts,
    toast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
