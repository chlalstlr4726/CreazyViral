"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion";
import { PencilLine, Send, Sparkles, X } from "lucide-react";
import { type AccountId } from "@/lib/accounts";
import type { StoryResult, StoryUsed } from "@/lib/chat";
import type { GridEvent } from "@/lib/storyGrid";
import { useProfiles } from "@/lib/profiles";
import { StoryGrid, type CellState, type GridData } from "./StoryGrid";
import { Button, Chip, Panel, SectionTitle } from "./ui";

type Turn =
  | { key: number; role: "user"; text: string }
  | { key: number; role: "assistant"; kind: "grid"; grid: GridData }
  | { key: number; role: "assistant"; kind: "story"; story: StoryResult; used?: StoryUsed; label?: string }
  | { key: number; role: "assistant"; kind: "error"; text: string };

/** 고칠 대상: 카드에서 고른 안(grid) 또는 이미 고친 안(story) */
interface Target { turnKey: number; id: string; story: StoryResult; label: string }

const DEFAULT_MSG = "우리 소재로, 위 바이럴 Top 5 구조에 맞는 스토리보드를 짜줘";


export function ChatPanel({ accountId, days }: { accountId: AccountId; days: 3 | 7 | 14 }) {
  const { profile } = useProfiles();
  const { concept, materials } = profile(accountId);
  const [materialId, setMaterialId] = useState("");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [basis, setBasis] = useState<string | null>(null);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 고칠 안을 고르면 입력 칸으로 데려가 바로 쓸 수 있게 한다 */
  function pickTarget(next: Target | null) {
    setTarget(next);
    if (!next) return;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
      el.focus({ preventScroll: true });
    });
  }

  const usable = materials.filter((m) => m.status !== "보관");
  const nextKey = () => ++seq.current;
  const patchGrid = (key: number, f: (g: GridData) => GridData) =>
    setTurns((ts) => ts.map((t) => (t.key === key && t.role === "assistant" && t.kind === "grid" ? { ...t, grid: f(t.grid) } : t)));
  const replaceTurn = (key: number, next: Turn) => setTurns((ts) => ts.map((t) => (t.key === key ? next : t)));

  async function send(text?: string, forced?: Target) {
    if (busy) return;
    const editing = forced ?? target;
    const message = (text ?? input).trim() || (editing ? "" : DEFAULT_MSG);
    if (!message) return;
    setInput("");
    setBusy(true);
    const userKey = nextKey();
    const outKey = nextKey();
    const base = { accountId, message, materialId: materialId || undefined, days, concept, materials };

    if (editing) {
      setTurns((t) => [...t, { key: userKey, role: "user", text: `${editing.label} 고치기: ${message}` }, { key: outKey, role: "assistant", kind: "error", text: "" }]);
      try {
        const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, edit: { story: editing.story } }) });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error || "failed");
        const label = `${editing.label} 고친 안`;
        replaceTurn(outKey, { key: outKey, role: "assistant", kind: "story", story: d.story, used: d.used, label });
        setTarget({ turnKey: outKey, id: "story", story: d.story, label });
      } catch {
        replaceTurn(outKey, { key: outKey, role: "assistant", kind: "error", text: "고치지 못했어요. 잠시 뒤 다시 시도해 주세요." });
      } finally {
        setBusy(false);
      }
      return;
    }

    const empty: GridData = { rows: [], cols: [], cells: [], phase: "connecting", picks: [], startedAt: Date.now() };
    setTurns((t) => [...t, { key: userKey, role: "user", text: message }, { key: outKey, role: "assistant", kind: "grid", grid: empty }]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) });
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("ndjson") || !res.body) {
        // AI 열쇠가 없을 때의 규칙 기반 초안(표 없음) 또는 오류
        const d = await res.json();
        if (!d.ok) throw new Error(d.error || "failed");
        if (d.used?.basis) setBasis(d.used.basis);
        replaceTurn(outKey, { key: outKey, role: "assistant", kind: "story", story: d.story, used: d.used });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let ended = false;
      const apply = (e: GridEvent) => {
        if (e.type === "start") {
          setBasis(e.used.basis);
          patchGrid(outKey, (g) => ({ ...g, rows: e.rows, cols: e.cols, cells: Array.from({ length: 36 }, (): CellState => ({ status: "wait" })), used: e.used, models: e.models, phase: "filling" }));
        } else if (e.type === "cell" || e.type === "cell_fail") {
          const k = e.row * 9 + e.col;
          const cell: CellState = e.type === "cell" ? { status: "ok", story: e.story } : { status: "fail", error: e.error };
          patchGrid(outKey, (g) => ({ ...g, cells: g.cells.map((c, i) => (i === k ? cell : c)) }));
        } else if (e.type === "pick_start") {
          patchGrid(outKey, (g) => ({ ...g, phase: "picking" }));
        } else if (e.type === "picks") {
          patchGrid(outKey, (g) => ({ ...g, picks: e.picks, mode: e.mode, note: e.note }));
        } else if (e.type === "done") {
          ended = true;
          patchGrid(outKey, (g) => ({ ...g, phase: "done", ms: e.ms, costUsd: e.costUsd }));
        } else if (e.type === "error") {
          ended = true;
          patchGrid(outKey, (g) => ({ ...g, phase: "error", error: e.error === "no_cells" ? "스토리보드를 한 칸도 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." : undefined }));
        }
      };
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
      if (!ended) patchGrid(outKey, (g) => ({ ...g, phase: "error", error: "연결이 끊겼어요. 다시 시도해 주세요." }));
    } catch {
      replaceTurn(outKey, { key: outKey, role: "assistant", kind: "error", text: "스토리보드를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  const placeholder = target
    ? `${target.label} 수정 요청 (예: 컷을 4개로 줄여줘, 훅을 더 세게)`
    : turns.length
      ? "새 요청을 적으면 36개를 다시 만들어요. 카드의 '이 안 고치기'를 누르면 그 안을 고쳐요"
      : DEFAULT_MSG;

  return (
    <Panel className="mb-6 p-4 sm:p-5">
      <SectionTitle
        title="AI 스토리보드"
        desc="우리 소재로 Haiku가 스토리보드 36개(훅 방식 4가지 × 전개 9가지)를 만들고, Sonnet이 위 바이럴 Top 5의 분석에 가장 잘 맞는 4개를 골라요."
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex w-full min-w-0 items-center gap-2 text-[0.8125rem] text-gray-600 sm:w-auto">
          <span className="shrink-0">소재</span>
          <select className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-[0.8125rem] sm:max-w-[16rem] sm:flex-none" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">자동 (최근 소재 3개를 돌려 쓰기)</option>
            {usable.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </label>
        <span className="text-[0.8125rem] text-gray-500">기준: {basis ?? "위의 바이럴 Top 5"} (훅 공식·이야기 구조·전개 같은 분석 칸 포함)</span>
      </div>

      <div className="space-y-4">
        {turns.map((t) =>
          t.role === "user" ? (
            <motion.div
              key={t.key}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={spring}
              className="ml-auto w-fit max-w-[85%] origin-bottom-right rounded-2xl bg-blue-600 px-4 py-2.5 text-sm text-white"
            >
              {t.text}
            </motion.div>
          ) : t.kind === "grid" ? (
            <StoryGrid
              key={t.key}
              data={t.grid}
              editingId={target?.turnKey === t.key ? target.id : undefined}
              onEdit={(id, story, rank) => pickTarget(target?.turnKey === t.key && target.id === id ? null : { turnKey: t.key, id, story, label: `${rank}번 안` })}
            />
          ) : t.kind === "story" ? (
            <Story
              key={t.key}
              story={t.story}
              used={t.used}
              label={t.label}
              editing={target?.turnKey === t.key}
              onFollow={(q) => {
                const me = { turnKey: t.key, id: "story", story: t.story, label: t.label ?? "이 안" };
                setTarget(me);
                send(q, me);
              }}
            />
          ) : t.text ? (
            <p key={t.key} className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{t.text}</p>
          ) : (
            <p key={t.key} className="text-sm text-gray-500">고치는 중…</p>
          ),
        )}
      </div>

      <AnimatePresence initial={false}>
      {target && (
        <motion.div
          key="edit-target"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={spring}
          className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[0.8125rem] text-blue-800"
        >
          <PencilLine size={14} className="shrink-0" />
          <span className="min-w-0 truncate">
            <b>{target.label}</b> 고치는 중: {target.story.title}
          </span>
          <button type="button" aria-label="고치기 그만두기" onClick={() => setTarget(null)} className="press ml-auto shrink-0 rounded p-1 hover:bg-blue-100">
            <X size={14} />
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          className="h-10 min-w-0 rounded-md sm:flex-1 border border-gray-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          // 빈 칸에서 Enter만 누르면 돈이 드는 36개 만들기가 다시 돌지 않게, 처음 한 번만 기본 요청으로 보낸다
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && (input.trim() || !turns.length) && send()}
        />
        <Button onClick={() => send()} disabled={busy || (!!target && !input.trim())} className="shrink-0">
          <Send size={14} /> {target ? "고치기" : turns.length ? "36개 다시 만들기" : "36개 만들기"}
        </Button>
      </div>
    </Panel>
  );
}

function Story({ story, used, label, editing, onFollow }: { story: StoryResult; used?: StoryUsed; label?: string; editing: boolean; onFollow: (t: string) => void }) {
  const ai = story.mode === "ai";
  return (
    <div className={`rounded-xl border bg-gray-50/50 p-4 ${editing ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Sparkles size={15} className="text-blue-500" />
        <h4 className="text-[0.9375rem] font-bold">{story.title}</h4>
        <Chip tone={ai ? "blue" : "amber"}>{ai ? (label ?? "AI 작성") : "기본 틀(AI 키 없음)"}</Chip>
        {story.material && <Chip>소재: {story.material}</Chip>}
      </div>
      <p className="text-[0.8125rem] leading-relaxed text-gray-600">{story.why}</p>

      {used && used.viral.length > 0 && !ai && (
        <details className="mt-2 text-[0.8125rem] text-gray-500">
          <summary className="cursor-pointer font-semibold">참고한 {used.basis}</summary>
          <ol className="mt-1.5 space-y-1">
            {used.viral.map((v, i) => (
              <li key={v.id}>
                {i + 1}. <a href={v.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">@{v.user}</a>, {v.sec}초: {v.caption.slice(0, 40)}
              </li>
            ))}
          </ol>
        </details>
      )}

      <ol className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        {story.cuts.map((c, i) => (
          <li key={i} className="text-[0.8125rem] leading-relaxed">
            <span className="num mr-1.5 text-[0.71875rem] text-gray-500">{c.start_s}–{c.end_s}초</span>
            <span className="text-gray-700">{c.visual}</span>
            <span className="block font-medium text-gray-900">“{c.caption}”</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 whitespace-pre-line text-sm"><span className="font-semibold">캡션 </span>{story.caption}</p>
      <p className="mt-1 break-words text-[0.8125rem] text-blue-600">{story.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
      {story.cautions.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-[0.8125rem] text-amber-700">
          {story.cautions.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
      {ai && (
        <div className="mt-3 flex flex-wrap gap-2">
          {["컷을 4개로 줄여줘", "훅을 더 센 문장으로 바꿔줘", "다른 소재로 바꿔줘"].map((q) => (
            <Button
              key={q}
              variant="secondary"
              size="sm"
              onClick={() => onFollow(q)}
            >
              {q}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
