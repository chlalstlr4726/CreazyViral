"use client";

// AI 스토리보드의 진행 상태와 결과를 화면 밖(이 모듈)에 두는 저장소. 계정마다 따로 둔다.
// - 서버와 주고받기(fetch, 사건 줄 읽기)가 여기서 돈다. 계정 탭을 바꾸거나(AccountTabs가 화면을 새로 그림)
//   다른 메뉴로 가도 끊기지 않고 끝까지 받는다. 예전에는 채팅 조각 안에서 돌아, 화면이 바뀌면 결과가 버려졌다.
// - 화면(ChatPanel)은 useSyncExternalStore로 읽기만 한다. 돌아오면 그때까지 찬 칸, 고르는 중, 뽑힌 카드를 이어서 보인다.
// - 받은 결과는 sessionStorage에도 남긴다. 새로고침 뒤에도 끝난 결과는 다시 보인다(진행 중이던 것은 끊겼다고 표시).
// 왜 React context가 아니라 모듈 저장소인가: 앱 전체 틀(레이아웃·메뉴 틀)을 고치지 않고 AI 스토리보드 파일 안에서 끝나고,
// 브라우저 안에서 페이지를 옮겨 다녀도(Next.js 링크 이동) 모듈은 그대로 살아 있기 때문이다.
import { useSyncExternalStore } from "react";
import type { AccountId, Concept, Material } from "./accounts";
import type { StoryResult, StoryUsed } from "./chat";
import type { GridEvent } from "./storyGrid";
import type { CellState, GridData } from "@/components/StoryGrid";

export type Turn =
  | { key: number; role: "user"; text: string }
  | { key: number; role: "assistant"; kind: "grid"; grid: GridData }
  | { key: number; role: "assistant"; kind: "story"; story: StoryResult; used?: StoryUsed; label?: string }
  | { key: number; role: "assistant"; kind: "error"; text: string };

/** 고칠 대상: 카드에서 고른 안(grid) 또는 이미 고친 안(story) */
export interface Target {
  turnKey: number;
  id: string;
  story: StoryResult;
  label: string;
}

export interface ChatState {
  turns: Turn[];
  busy: boolean; // 이 계정에서 만들기·고치기가 도는 중(같은 계정에서 다시 누르지 못하게)
  target: Target | null;
  basis: string | null;
  seq: number;
}

const EMPTY: ChatState = { turns: [], busy: false, target: null, basis: null, seq: 0 };
const KEY = (account: string) => `ai-storyboard:v1:${account}`;
const MAX_TURNS = 8; // 오래된 대화는 버려 sessionStorage가 넘치지 않게

const states = new Map<string, ChatState>();
const listeners = new Map<string, Set<() => void>>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function restore(account: string): ChatState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = sessionStorage.getItem(KEY(account));
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw) as Partial<ChatState>;
    const turns: Turn[] = (Array.isArray(saved.turns) ? saved.turns : []).map((t) => {
      // 새로고침하면 서버와의 연결이 끊긴다. 진행 중이던 표·고치기는 끊겼다고 보인다(찬 칸은 그대로 둔다).
      if (t.role === "assistant" && t.kind === "grid" && (t.grid.phase === "connecting" || t.grid.phase === "filling" || t.grid.phase === "picking")) {
        return { ...t, grid: { ...t.grid, phase: "error", error: "새로고침해서 만들기가 끊겼어요. 다시 만들어 주세요." } };
      }
      if (t.role === "assistant" && t.kind === "error" && !t.text) return { ...t, text: "새로고침해서 고치기가 끊겼어요. 다시 요청해 주세요." };
      return t;
    });
    const seq = turns.reduce((m, t) => Math.max(m, t.key), 0);
    return { turns, busy: false, target: saved.target ?? null, basis: saved.basis ?? null, seq };
  } catch {
    return EMPTY;
  }
}

function get(account: string): ChatState {
  let s = states.get(account);
  if (!s) {
    s = restore(account);
    states.set(account, s);
  }
  return s;
}

function save(account: string, now = false) {
  if (typeof window === "undefined") return;
  clearTimeout(saveTimers.get(account));
  const write = () => {
    const s = get(account);
    try {
      sessionStorage.setItem(KEY(account), JSON.stringify({ turns: s.turns, target: s.target, basis: s.basis }));
    } catch {}
  };
  if (now) write();
  else saveTimers.set(account, setTimeout(write, 400)); // 칸이 줄줄이 들어올 때는 모아서 한 번에 쓴다
}

// 페이지를 떠나는 순간(새로고침·닫기) 모아 둔 저장을 바로 쓴다(마지막 몇 칸이 빠지지 않게)
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const account of saveTimers.keys()) save(account, true);
  });
}

function set(account: string, f: (s: ChatState) => ChatState, saveNow = false) {
  const next = f(get(account));
  if (next.turns.length > MAX_TURNS) next.turns = next.turns.slice(-MAX_TURNS);
  states.set(account, next);
  save(account, saveNow);
  listeners.get(account)?.forEach((l) => l());
}

function subscribe(account: string, cb: () => void) {
  let ls = listeners.get(account);
  if (!ls) listeners.set(account, (ls = new Set()));
  ls.add(cb);
  return () => {
    ls!.delete(cb);
  };
}

/** 화면에서 계정 하나의 AI 스토리보드 상태를 읽는다(바뀌면 다시 그려진다) */
export function useStoryboard(account: AccountId): ChatState {
  return useSyncExternalStore(
    (cb) => subscribe(account, cb),
    () => get(account),
    () => EMPTY,
  );
}

export function setTarget(account: AccountId, target: Target | null) {
  set(account, (s) => ({ ...s, target }), true);
}

const patchGrid = (account: string, key: number, f: (g: GridData) => GridData, saveNow = false) =>
  set(account, (s) => ({ ...s, turns: s.turns.map((t) => (t.key === key && t.role === "assistant" && t.kind === "grid" ? { ...t, grid: f(t.grid) } : t)) }), saveNow);
const replaceTurn = (account: string, key: number, next: Turn) => set(account, (s) => ({ ...s, turns: s.turns.map((t) => (t.key === key ? next : t)) }), true);

export interface SendArgs {
  message: string;
  materialId?: string;
  days: number;
  concept: Concept;
  materials: Material[];
  editing?: Target | null;
}

/**
 * 만들기(36칸) 또는 고치기 요청을 보낸다. 같은 계정에서 이미 돌고 있으면 아무것도 하지 않는다.
 * 화면이 사라져도 이 함수는 끝까지 받아서 저장소에 쌓는다.
 */
export async function send(account: AccountId, args: SendArgs) {
  if (get(account).busy) return;
  const { message, materialId, days, concept, materials, editing } = args;
  const s0 = get(account);
  const userKey = s0.seq + 1;
  const outKey = s0.seq + 2;
  const base = { accountId: account, message, materialId: materialId || undefined, days, concept, materials };

  if (editing) {
    set(
      account,
      (s) => ({
        ...s,
        busy: true,
        seq: outKey,
        turns: [...s.turns, { key: userKey, role: "user", text: `${editing.label} 고치기: ${message}` }, { key: outKey, role: "assistant", kind: "error", text: "" }],
      }),
      true,
    );
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, edit: { story: editing.story } }) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "failed");
      const label = `${editing.label} 고친 안`;
      replaceTurn(account, outKey, { key: outKey, role: "assistant", kind: "story", story: d.story, used: d.used, label });
      set(account, (s) => ({ ...s, target: { turnKey: outKey, id: "story", story: d.story, label } }), true);
    } catch {
      replaceTurn(account, outKey, { key: outKey, role: "assistant", kind: "error", text: "고치지 못했어요. 잠시 뒤 다시 시도해 주세요." });
    } finally {
      set(account, (s) => ({ ...s, busy: false }), true);
    }
    return;
  }

  const empty: GridData = { rows: [], cols: [], cells: [], phase: "connecting", picks: [], startedAt: Date.now() };
  set(
    account,
    (s) => ({ ...s, busy: true, seq: outKey, turns: [...s.turns, { key: userKey, role: "user", text: message }, { key: outKey, role: "assistant", kind: "grid", grid: empty }] }),
    true,
  );
  try {
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) });
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("ndjson") || !res.body) {
      // AI 열쇠가 없을 때의 규칙 기반 초안(표 없음) 또는 오류
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "failed");
      if (d.used?.basis) set(account, (s) => ({ ...s, basis: d.used.basis }));
      replaceTurn(account, outKey, { key: outKey, role: "assistant", kind: "story", story: d.story, used: d.used });
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let ended = false;
    const apply = (e: GridEvent) => {
      if (e.type === "start") {
        set(account, (s) => ({ ...s, basis: e.used.basis }));
        patchGrid(account, outKey, (g) => ({ ...g, rows: e.rows, cols: e.cols, cells: Array.from({ length: 36 }, (): CellState => ({ status: "wait" })), used: e.used, models: e.models, phase: "filling" }));
      } else if (e.type === "cell" || e.type === "cell_fail") {
        const k = e.row * 9 + e.col;
        const cell: CellState = e.type === "cell" ? { status: "ok", story: e.story } : { status: "fail", error: e.error };
        patchGrid(account, outKey, (g) => ({ ...g, cells: g.cells.map((c, i) => (i === k ? cell : c)) }));
      } else if (e.type === "pick_start") {
        patchGrid(account, outKey, (g) => ({ ...g, phase: "picking" }), true);
      } else if (e.type === "picks") {
        patchGrid(account, outKey, (g) => ({ ...g, picks: e.picks, mode: e.mode, note: e.note }));
      } else if (e.type === "done") {
        ended = true;
        patchGrid(account, outKey, (g) => ({ ...g, phase: "done", ms: e.ms, costUsd: e.costUsd }), true);
      } else if (e.type === "error") {
        ended = true;
        patchGrid(account, outKey, (g) => ({ ...g, phase: "error", error: e.error === "no_cells" ? "스토리보드를 한 칸도 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." : undefined }), true);
      }
    };
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) {
            try {
              apply(JSON.parse(line) as GridEvent);
            } catch {}
          }
        }
        if (done) break;
      }
    } catch {
      // 받는 도중 연결이 끊김(와이파이, 잠자기, 서버 시간 한도): 채워 둔 칸은 남기고 표를 '멈춤'으로 둔다.
    }
    if (!ended) patchGrid(account, outKey, (g) => ({ ...g, phase: "error", error: "연결이 끊겼어요. 다시 시도해 주세요." }), true);
  } catch {
    replaceTurn(account, outKey, { key: outKey, role: "assistant", kind: "error", text: "스토리보드를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." });
  } finally {
    set(account, (s) => ({ ...s, busy: false }), true);
  }
}
