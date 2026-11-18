"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Card, CardEvent, CardType, Post, PostWithScore } from "./types";
import { scorePosts } from "./analytics";
import { ACCOUNT_PROFILES, type AccountId } from "./accounts";

const KEY = "viral-dashboard:events:v1";

export const shortcode = (url: string) => url.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;

/** 오늘의 카드가 어디서 왔는지: supabase = 실제 카드 DB, unconfigured = DB 설정 없음(카드 없음), error = DB 연결 실패(카드 없음) */
export type CardSource = "loading" | "supabase" | "unconfigured" | "error";

/** 화면 아래 알림. action이 있으면 알림 안에 단추(예: 되돌리기)를 보인다. */
export interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

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
  /** 계정별 성과 데이터 출처: instagram = 공식 API로 수집한 실제 값, none = 아직 연결 전(데이터 없음) */
  postSource: (account: AccountId) => "instagram" | "none";
  lastCaptured: string | null;
  toast: ToastMsg | null;
  dismissToast: () => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider missing");
  return v;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [local, setLocal] = useState<CardEvent[]>([]);
  const [localReady, setLocalReady] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [remote, setRemote] = useState<{ source: CardSource; cards: Card[] }>({ source: "loading", cards: [] });
  const [extra, setExtra] = useState<Card[]>([]);
  const [live, setLive] = useState<{ accounts: Record<string, { connected: boolean }>; posts: Post[]; last: string | null }>({ accounts: {}, posts: [], last: null });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLocal(JSON.parse(raw));
    } catch {}
    setLocalReady(true);
  }, []);

  // 오늘의 카드: 서버가 Supabase `cards`에서 읽어 준다. 설정이 없거나 실패하면 카드 없음(가짜 카드로 채우지 않는다).
  useEffect(() => {
    fetch("/api/cards/today", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { source?: string; cards?: Card[] }) =>
        setRemote(d.source === "supabase" ? { source: "supabase", cards: d.cards ?? [] } : { source: d.source === "error" ? "error" : "unconfigured", cards: [] }),
      )
      .catch(() => setRemote({ source: "error", cards: [] }));
  }, []);

  // 게시물 성과: 인스타 공식 API로 수집된 값(Supabase). 연결 전이거나 설정이 없으면 게시물 없음.
  useEffect(() => {
    fetch("/api/posts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { source?: string; accounts?: Record<string, { connected: boolean }>; posts?: Post[]; last_captured_at?: string | null }) => {
        if (d.source === "instagram") setLive({ accounts: d.accounts ?? {}, posts: d.posts ?? [], last: d.last_captured_at ?? null });
      })
      .catch(() => {});
  }, []);

  const push = useCallback((e: Omit<CardEvent, "id" | "at">) => {
    const id = `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    setLocal((prev) => {
      const next = [...prev, { ...e, id, at: new Date().toISOString() }];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    return id;
  }, []);

  // 되돌리기: 방금 남긴 기록 하나를 지운다(선택·패스 기록은 이 브라우저에만 있다)
  const removeEvent = useCallback((id: string) => {
    setLocal((prev) => {
      const next = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // 알림은 하나씩. 새 알림이 오면 이전 타이머를 지워, 두 번째 알림이 일찍 사라지지 않게 한다.
  const flash = useCallback((text: string, action?: ToastMsg["action"]) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, action });
    toastTimer.current = setTimeout(() => setToast(null), action ? 5000 : 2400);
  }, []);
  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const events = local;

  const cardById = useCallback(
    (id: string) => remote.cards.find((c) => c.card_id === id) ?? extra.find((c) => c.card_id === id),
    [remote.cards, extra],
  );

  const addCard = useCallback((card: Card) => setExtra((prev) => (prev.some((c) => c.card_id === card.card_id) ? prev : [...prev, card])), []);

  const todayCard = useCallback(
    (type: CardType, account: AccountId): Card | undefined => remote.cards.find((c) => c.type === type && c.account_id === account),
    [remote],
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
    const base: Post[] = ACCOUNT_PROFILES.flatMap((a) => (live.accounts[a.id]?.connected ? live.posts.filter((p) => p.account_id === a.id) : []));
    const merged: Post[] = base.map((p) => {
      const code = shortcode(p.url);
      const ev = [...linkEvents].reverse().find((e) => shortcode(e.post_url!) === code);
      const card = ev ? cardById(ev.card_id) : undefined;
      return card ? { ...p, card_id: card.card_id, format: card.format, type: card.type } : p;
    });
    return scorePosts(merged);
  }, [events, cardById, live]);

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
      const eid = push({ card_id: id, action: "selected" });
      flash("카드를 선택했어요. 스토리보드를 확인하세요", {
        label: "되돌리기",
        run: () => {
          removeEvent(eid);
          flash("선택을 되돌렸어요");
        },
      });
    },
    pass: (id, reason) => {
      const eid = push({ card_id: id, action: "passed", reason });
      flash(`패스 사유를 기록했어요: ${reason}`, {
        label: "되돌리기",
        run: () => {
          removeEvent(eid);
          flash("패스를 되돌렸어요");
        },
      });
    },
    regenerate: () => {
      flash("재생성은 카드 API의 재생성 기능이 연결되면 사용할 수 있어요");
    },
    linkPost: (id, url) => {
      push({ card_id: id, action: "linked", post_url: url });
      const code = shortcode(url);
      const hit = live.posts.some((p) => shortcode(p.url) === code);
      flash(hit ? "게시물을 연결했어요. 성과가 바로 반영돼요" : "URL을 등록했어요. 성과 수집을 기다리는 중이에요");
      return hit ? "matched" : "pending";
    },
    posts,
    postSource: (account) => (live.accounts[account]?.connected ? "instagram" : "none"),
    lastCaptured: live.last,
    toast,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
