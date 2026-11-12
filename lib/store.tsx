"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Card, CardEvent, CardType, Post, PostWithScore } from "./types";
import { HISTORY_CARDS, POSTS, SEED_EVENTS, TODAY, todayPool } from "./mock";
import { scorePosts } from "./analytics";

const KEY = "viral-dashboard:events:v1";

export const shortcode = (url: string) => url.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;

interface Store {
  ready: boolean;
  events: CardEvent[];
  cardById: (id: string) => Card | undefined;
  todayCard: (type: CardType) => Card;
  statusOf: (id: string) => "selected" | "passed" | null;
  passReasonOf: (id: string) => string | undefined;
  linkedUrlOf: (id: string) => string | undefined;
  select: (id: string) => void;
  pass: (id: string, reason: string) => void;
  regenerate: (type: CardType) => void;
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

const pools: Record<CardType, Card[]> = { dummy: todayPool("dummy"), service: todayPool("service") };
const cardIndex = new Map<string, Card>();
[...HISTORY_CARDS, ...pools.dummy, ...pools.service].forEach((c) => cardIndex.set(c.card_id, c));

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [local, setLocal] = useState<CardEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLocal(JSON.parse(raw));
    } catch {}
    setReady(true);
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

  const regenCount = useCallback(
    (type: CardType) =>
      events.filter((e) => e.action === "regenerated" && e.card_id.startsWith(`${TODAY}-${type}-`)).length,
    [events],
  );

  const todayCard = useCallback(
    (type: CardType) => pools[type][regenCount(type) % pools[type].length],
    [regenCount],
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
      const card = ev ? cardIndex.get(ev.card_id) : undefined;
      return card ? { ...p, card_id: card.card_id, format: card.format, type: card.type } : p;
    });
    return scorePosts(merged);
  }, [events]);

  const value: Store = {
    ready,
    events,
    cardById: (id) => cardIndex.get(id),
    todayCard,
    statusOf,
    passReasonOf: (id) => latest(id, "passed")?.reason,
    linkedUrlOf: (id) => latest(id, "linked")?.post_url,
    select: (id) => {
      push({ card_id: id, action: "selected" });
      flash("카드를 선택했어요. 스토리보드를 확인하세요");
    },
    pass: (id, reason) => {
      push({ card_id: id, action: "passed", reason });
      flash(`패스 사유를 기록했어요 · ${reason}`);
    },
    regenerate: (type) => {
      const cur = todayCard(type);
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
