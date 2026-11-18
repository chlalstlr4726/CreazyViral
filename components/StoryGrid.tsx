"use client";

// AI 스토리보드 36칸 표(훅 방식 4줄 × 전개 9칸)와 뽑힌 4장의 카드.
// 움직임: 칸이 만들어지는 대로 회색 → 색으로 켜짐 → 36칸이 차면 고르는 동안 빛줄이 표를 훑음
// → 32칸은 물러나고 고른 4칸이 떠오름 → 아래 카드 4장으로 펼쳐짐.
// 움직임은 Motion 스프링(lib/motion.ts, 튕김 없음)으로: 도중에 새 상태가 와도 지금 위치에서 이어 간다.
// 시간에 따라 도는 것(기다림 깜박임, 빛줄, 단계 점)만 CSS로 둔다. '움직임 줄이기'면 위치·크기 움직임 없이 결과만 보인다.

import { useEffect, useRef, useState } from "react";
import { Gowun_Dodum } from "next/font/google";
import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { spring, springGentle, springSnappy } from "@/lib/motion";
import { Check, ChevronDown, PencilLine, Sparkles, X } from "lucide-react";
import type { StoryResult, StoryUsed } from "@/lib/chat";
import type { GridPick, HookRow, VariantCol } from "@/lib/storyGrid";
import { Chip } from "./ui";

export type CellState = { status: "wait" } | { status: "ok"; story: StoryResult } | { status: "fail"; error: string };

export interface GridData {
  rows: HookRow[];
  cols: VariantCol[];
  cells: CellState[]; // 36칸, 순서 = 줄 × 9 + 칸
  phase: "connecting" | "filling" | "picking" | "done" | "error";
  picks: GridPick[];
  mode?: "ai" | "rule";
  note?: string;
  used?: StoryUsed;
  models?: { make: string; pick: string };
  startedAt: number;
  ms?: number;
  costUsd?: number;
  error?: string;
}

// 칸 안 글씨: 사이트 글꼴(Pretendard)과 다른, 부드러운 손글씨 결의 고운돋움. 한글 조각은 쓰는 만큼만 받는다.
const cellFont = Gowun_Dodum({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });

// 훅 방식 4줄의 파스텔 색. 채도를 낮춘 oklch로 바탕·글씨·테두리·진한 점을 한 색상(hue)에서 뽑는다.
const tone = (hue: number) => ({
  bg: `oklch(0.95 0.032 ${hue})`,
  bgPicked: `oklch(0.91 0.055 ${hue})`,
  ink: `oklch(0.37 0.06 ${hue})`,
  edge: `oklch(0.86 0.045 ${hue})`,
  deep: `oklch(0.66 0.085 ${hue})`,
  shadow: `oklch(0.45 0.07 ${hue} / 0.35)`,
});
const TONES = [tone(235), tone(160), tone(15), tone(75)]; // 질문 하늘 · 결과 먼저 민트 · 반전 장미 · POV 살구
/**
 * 칸·말풍선에 보일 제목: 앞에 붙은 시리즈 이름("신입 직원 1편: ", "신입 직원 시리즈 3편, ")과 소재 이름을 뗀다.
 * 36칸이 모두 같은 시리즈 이름으로 시작해 칸끼리 구분이 안 되던 문제(도하 결정 11-18). 카드에는 전체 제목을 그대로 둔다.
 */
export function cellTitle(story: StoryResult) {
  let t = story.title.trim();
  const mat = story.material.replace(/\s*\(.*$/, "").trim();
  if (mat && t.startsWith(mat)) t = t.slice(mat.length).replace(/^\s*[:：,·\-—]\s*/, "");
  t = t.replace(/^[^:：,]{0,24}?\d+\s*편\s*[:：,·\-—]\s*/, "");
  return t || story.title;
}

const SHORT: Record<string, string> = { question: "질문", result: "결과", twist: "반전", pov: "POV" };
const MODEL_NAME: Record<string, string> = { "claude-haiku-5-5": "Haiku 5.5", "claude-sonnet-5-5": "Sonnet 5.5" };
const BEAM_S = 1.8; // 빛줄이 표를 한 번 훑는 시간(초)

const CSS = `
@keyframes sg-wait { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes sg-beam { from { left: -24% } to { left: 104% } }
@keyframes sg-scan { 0%,100% { filter: saturate(1); translate: 0 0 } 7% { filter: saturate(2.4) brightness(.98); translate: 0 -2px } 16% { filter: saturate(1); translate: 0 0 } }
@keyframes sg-dot { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.6); opacity: .5 } }
@media (prefers-reduced-motion: reduce) { .sg-anim { animation: none !important; transition: none !important } }
`;

function useElapsed(startedAt: number, running: boolean, finalMs?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);
  return finalMs != null ? finalMs : Math.max(0, now - startedAt);
}

export function StoryGrid({ data, editingId, onEdit }: { data: GridData; editingId?: string; onEdit: (id: string, story: StoryResult, rank: number) => void }) {
  const reduce = !!useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<{ left: number; top: number; origin: number } | null>(null);
  const [cardHover, setCardHover] = useState<string | null>(null);

  const running = data.phase === "connecting" || data.phase === "filling" || data.phase === "picking";
  const elapsed = useElapsed(data.startedAt, running, data.ms);
  const filled = data.cells.filter((c) => c.status === "ok").length;
  const failed = data.cells.filter((c) => c.status === "fail").length;
  const pickRank = new Map(data.picks.map((p) => [p.id, p.rank]));
  const revealed = data.phase === "done" && data.picks.length > 0;

  // 다른 계정 탭이나 메뉴에 다녀와 이 표가 다시 그려질 때: 이미 끝난 결과면 빛줄·떠오름·펼침을 다시 틀지 않고
  // 끝난 모습을 바로 보인다. 진행 중이면 이어서 움직이고, 그때 이미 찬 칸은 다시 튀어나오지 않는다.
  const [settledOnMount] = useState(() => data.phase === "done");
  const [okOnMount] = useState(() => new Set(data.cells.flatMap((c, k) => (c.status === "ok" ? [k] : []))));
  const [stage, setStage] = useState(() => (settledOnMount && revealed ? 2 : 0)); // 0 = 아직, 1 = 4칸 떠오름, 2 = 카드 펼침

  useEffect(() => {
    if (!revealed) return setStage(0);
    if (settledOnMount) return setStage(2);
    setStage(1);
    const t = setTimeout(() => setStage(2), reduce ? 0 : 1000);
    return () => clearTimeout(t);
  }, [revealed, reduce, settledOnMount]);

  // 카드가 펼쳐지면 화면 안으로 데려온다(아래로 펼쳐져 화면 밖에서 끝나는 일을 막기). 끝난 결과로 돌아온 때는 움직이지 않는다.
  useEffect(() => {
    if (stage !== 2 || settledOnMount) return;
    const t = setTimeout(() => cardsRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }), reduce ? 0 : 260);
    return () => clearTimeout(t);
  }, [stage, reduce, settledOnMount]);

  // 휴대폰처럼 초점이 안 생기는 화면에서 칸을 눌러 연 말풍선은, 표 밖을 누르면 닫는다
  useEffect(() => {
    if (hover == null) return;
    const onDown = (e: PointerEvent) => {
      if (!gridRef.current?.contains(e.target as Node)) {
        setHover(null);
        setTip(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [hover]);

  function showTip(k: number, el: HTMLElement) {
    const box = gridRef.current;
    if (!box) return;
    const w = Math.min(272, box.clientWidth);
    const center = el.offsetLeft + el.offsetWidth / 2;
    setHover(k);
    const left = Math.max(0, Math.min(center - w / 2, box.clientWidth - w));
    // 말풍선은 그 칸에서 자라나듯 열린다(변형 기준점 = 칸의 가운데)
    setTip({ left, top: el.offsetTop, origin: center - left });
  }

  const step = data.phase === "picking" ? 2 : data.phase === "done" ? 3 : 1;
  const hoverCell = hover != null ? data.cells[hover] : null;
  const make = MODEL_NAME[data.models?.make ?? ""] ?? "Haiku 5.5";
  const pick = MODEL_NAME[data.models?.pick ?? ""] ?? "Sonnet 5.5";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <style>{CSS}</style>

      {/* 단계와 진행 */}
      <div className="mb-3 flex items-center gap-x-2 sm:gap-x-3">
        <Sparkles size={15} className="hidden shrink-0 text-blue-500 sm:block" />
        <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[0.75rem] sm:gap-x-1.5 sm:text-[0.78125rem]">
          {[["36개 만들기", make], ["4개 고르기", pick], ["카드 4장", ""]].map(([label, model], i) => {
            const on = step === i + 1 && running;
            const past = step > i + 1 || (data.phase === "done" && step === i + 1);
            return (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-300">→</span>}
                <span className={clsx("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold sm:gap-1.5 sm:px-2", on ? "bg-blue-50 text-blue-700" : past ? "text-gray-500" : "text-gray-300")}>
                  {past ? <Check size={12} /> : <span className={clsx("sg-anim h-1.5 w-1.5 rounded-full", on ? "bg-blue-500 animate-[sg-dot_1.1s_ease-in-out_infinite]" : "bg-gray-300")} />}
                  {label}
                  {model && <span className="hidden font-medium opacity-70 sm:inline">· {model}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <span className="num ml-auto shrink-0 text-[0.78125rem] font-semibold text-gray-500">{(elapsed / 1000).toFixed(1)}초</span>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.75rem] text-gray-500">
          <span className="shrink-0">
            <b className="num text-[0.8125rem] text-gray-900">{filled}</b>/36 완성{failed > 0 && <span className="text-gray-500"> · 실패 {failed}</span>}
          </span>
          <span className="min-w-0 truncate" aria-live="polite">
            {data.phase === "connecting" && "준비 중…"}
            {data.phase === "filling" && "칸마다 따로 쓰는 중"}
            {data.phase === "picking" && `${filled}개 가운데 4개 고르는 중`}
            {data.phase === "done" && (data.mode === "ai" ? (data.note ? <span className="text-amber-700">{`${pick}와 규칙으로 4개를 골랐어요`}</span> : `${pick}가 4개를 골랐어요`) : <span className="text-amber-700">규칙으로 4개를 골랐어요</span>)}
            {data.phase === "error" && <span className="text-red-500">멈췄어요</span>}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-gray-100">
          <motion.div className="h-full origin-left rounded-full bg-blue-500" initial={false} animate={{ scaleX: filled / 36 }} transition={spring} />
        </div>
      </div>

      {/* 9 × 4 표 */}
      <div className="flex gap-1.5 sm:gap-2">
        <div className="flex shrink-0 flex-col gap-1 pt-5">
          {data.rows.map((r, i) => (
            <div key={r.key} title={r.desc} className="flex h-7 items-center gap-1.5 sm:h-14">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONES[i].deep }} />
              <span className="text-[0.6875rem] font-semibold text-gray-700 sm:hidden">{SHORT[r.key] ?? r.label}</span>
              <span className="hidden w-[5.5rem] text-[0.75rem] font-semibold leading-tight text-gray-700 sm:block">{r.label}</span>
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 grid h-4 grid-cols-9 gap-1">
            {data.cols.map((c, j) => (
              <div key={j} title={`${c.desc}\n소재: ${c.material}`} className="truncate text-center text-[0.6875rem] leading-4 text-gray-500">
                <span className="sm:hidden">{j + 1}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </div>
            ))}
          </div>
          <div ref={gridRef} className="relative grid grid-cols-9 gap-1" onMouseLeave={() => { setHover(null); setTip(null); }}>
            {data.rows.length === 0
              ? Array.from({ length: 36 }, (_, k) => <div key={k} className={clsx("sg-anim h-7 rounded-md bg-gray-100 sm:h-14", running && "animate-[sg-wait_1.4s_ease-in-out_infinite]")} style={{ animationDelay: `${(k % 9) * 60}ms` }} />)
              : data.cells.map((c, k) => {
                  const row = Math.floor(k / 9);
                  const col = k % 9;
                  const id = `r${row}c${col}`;
                  const rank = pickRank.get(id);
                  const picked = stage >= 1 && rank != null;
                  const dim = stage >= 1 && rank == null;
                  const lit = cardHover === id;
                  const t = TONES[row];
                  const ok = c.status === "ok";
                  const shadow = picked
                    ? `0 14px 26px -14px ${t.shadow}, 0 0 0 ${lit ? 3 : 1.5}px ${t.deep}`
                    : lit
                      ? `0 0 0 2px ${t.deep}`
                      : `inset 0 0 0 1px ${t.edge}`;
                  return (
                    <motion.button
                      key={id}
                      type="button"
                      aria-label={`${data.rows[row]?.label} · ${data.cols[col]?.label}${c.status === "ok" ? `: ${c.story.title}` : c.status === "fail" ? ": 만들지 못함" : ": 만드는 중"}${rank ? ` (${rank}위)` : ""}`}
                      onMouseEnter={(e) => showTip(k, e.currentTarget)}
                      onFocus={(e) => showTip(k, e.currentTarget)}
                      // 휴대폰처럼 마우스를 올릴 수 없는 화면: 누르면 말풍선이 뜬다
                      onClick={(e) => showTip(k, e.currentTarget)}
                      onBlur={() => { setHover(null); setTip(null); }}
                      initial={false}
                      // 고른 칸은 순위 차례로 떠오르고, 나머지는 물러난다(스프링, 튕김 없음)
                      animate={{ scale: picked ? 1.07 : dim ? 0.96 : 1, opacity: dim ? 0.6 : 1, filter: dim ? "saturate(0.25)" : "saturate(1)" }}
                      transition={{ ...spring, delay: picked ? (rank - 1) * 0.14 : 0 }}
                      whileTap={{ scale: picked ? 1.03 : 0.95 }}
                      className={clsx(
                        "relative h-7 rounded-[5px] text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-14 sm:rounded-md",
                        "transition-[box-shadow,background-color] duration-300",
                        picked && "z-10",
                        c.status === "fail" ? "border border-dashed border-gray-200 bg-gray-50" : "bg-gray-100",
                        c.status === "wait" && running && "sg-anim animate-[sg-wait_1.4s_ease-in-out_infinite]",
                      )}
                      style={{
                        animationDelay: c.status === "wait" ? `${(row + col) * 70}ms` : undefined,
                        ...(ok ? { boxShadow: shadow } : {}),
                      }}
                    >
                      {ok && (
                        // 회색 칸 안에서 파스텔 칸이 자라 나온다(스프링). 고르는 동안에는 빛줄에 맞춰 반짝인다(CSS, 위치 대신 translate 속성만 써서 스프링과 겹치지 않음)
                        <motion.span
                          initial={okOnMount.has(k) ? false : { opacity: 0, scale: 0.82 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={springSnappy}
                          className={clsx("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", data.phase === "picking" && "sg-anim animate-[sg-scan_1.8s_ease-in-out_infinite]")}
                          style={{ background: picked ? t.bgPicked : t.bg, color: t.ink, animationDelay: data.phase === "picking" ? `${0.14 + col * 0.154}s` : undefined }}
                        >
                          <span className={clsx(cellFont.className, "mx-1.5 my-1 hidden overflow-hidden text-[0.71875rem] leading-[1.32] sm:line-clamp-3")}>{cellTitle(c.story)}</span>
                        </motion.span>
                      )}
                      {c.status === "fail" && <X size={12} className="absolute inset-0 m-auto text-gray-300" />}
                    </motion.button>
                  );
                })}

            {data.phase === "picking" && !reduce && (
              <div aria-hidden className="pointer-events-none absolute -inset-y-1.5 inset-x-0 overflow-hidden rounded-md">
                <div className="sg-anim absolute inset-y-0 w-[20%] animate-[sg-beam_1.8s_linear_infinite]" style={{ animationDuration: `${BEAM_S}s` }}>
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/75 to-transparent" />
                  <div className="absolute inset-y-1 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-blue-400 shadow-[0_0_14px_3px_rgba(59,130,246,.55)]" />
                </div>
              </div>
            )}

            <AnimatePresence>
            {hover != null && tip && hoverCell && (
              <motion.div
                key="tip"
                role="tooltip"
                initial={{ opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={springSnappy}
                className="pointer-events-none absolute z-30 w-[272px] max-w-full -translate-y-[calc(100%+8px)] rounded-xl border border-gray-200 bg-white p-3 text-left shadow-[0_12px_32px_-12px_rgba(15,23,42,0.3)]"
                style={{ left: tip.left, top: tip.top, transformOrigin: `${tip.origin}px 100%` }}
              >
                <p className="text-[0.6875rem] font-semibold text-gray-500">
                  {data.rows[Math.floor(hover / 9)]?.label} · {data.cols[hover % 9]?.label} · 소재 {data.cols[hover % 9]?.material}
                </p>
                {hoverCell.status === "ok" ? (
                  <>
                    <p className={clsx(cellFont.className, "mt-1 text-[0.875rem] leading-snug text-gray-900")}>{cellTitle(hoverCell.story)}</p>
                    {hoverCell.story.cuts[0] && (
                      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-gray-600">
                        <span className="font-semibold text-gray-800">첫 컷 </span>
                        {hoverCell.story.cuts[0].visual}
                        <span className="mt-0.5 block font-medium text-gray-900">“{hoverCell.story.cuts[0].caption}”</span>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-[0.75rem] text-gray-500">{hoverCell.status === "fail" ? (hoverCell.error === "time_cutoff" || hoverCell.error === "aborted" ? "시간 안에 만들지 못한 칸이에요." : "이 칸은 만들지 못했어요.") : "만드는 중이에요."}</p>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {data.used && data.used.viral.length > 0 && (
        <details className="mt-3 text-[0.78125rem] text-gray-500">
          <summary className="press w-fit cursor-pointer rounded-md font-semibold">참고한 {data.used.basis} (분석 칸까지 AI에 보냈어요)</summary>
          <ol className="mt-1.5 space-y-1">
            {data.used.viral.map((v, i) => (
              <li key={v.id}>
                {i + 1}.{" "}
                <a href={v.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">@{v.user}</a>
                {v.hookFormula ? ` · 훅 공식 ${v.hookFormula.replace(/^새 후보:\s*/, "")}` : ""}
                {v.storyStructure ? ` · 구조 ${v.storyStructure.replace(/^새 후보:\s*/, "")}` : ""}
              </li>
            ))}
          </ol>
        </details>
      )}

      {data.phase === "error" && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[0.8125rem] text-red-600">{data.error ?? "스토리보드를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요."}</p>}

      {/* 뽑힌 4장 */}
      {stage >= 2 && (
        <div className="mt-4">
          <p className="mb-2 text-[0.78125rem] text-gray-500">
            36칸 중 {filled}칸 완성{data.note ? <span className="text-amber-700"> · {data.note}</span> : null}
          </p>
          <div ref={cardsRef} className="grid scroll-mt-4 items-start gap-3 sm:grid-cols-2">
            {data.picks.map((p, i) => {
              const k = Number(p.id.slice(1, p.id.indexOf("c"))) * 9 + Number(p.id.slice(p.id.indexOf("c") + 1));
              const cell = data.cells[k];
              if (cell?.status !== "ok") return null;
              return (
                <PickCard
                  key={p.id}
                  pick={p}
                  story={cell.story}
                  row={Math.floor(k / 9)}
                  hook={data.rows[Math.floor(k / 9)]?.label ?? ""}
                  col={data.cols[k % 9]}
                  delay={i * 0.09}
                  animate={!settledOnMount}
                  editing={editingId === p.id}
                  onHover={(on) => setCardHover(on ? p.id : null)}
                  onEdit={() => onEdit(p.id, cell.story, p.rank)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PickCard({ pick, story, row, hook, col, delay, animate, editing, onHover, onEdit }: { pick: GridPick; story: StoryResult; row: number; hook: string; col?: VariantCol; delay: number; animate: boolean; editing: boolean; onHover: (on: boolean) => void; onEdit: () => void }) {
  const tone = TONES[row] ?? TONES[0];
  return (
    <motion.article
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      // 표에서 떨어져 나오듯 위에서 아래로 펼쳐진다(스프링, 튕김 없음). 끝난 결과로 돌아온 때는 펼침을 다시 틀지 않는다.
      initial={animate ? { opacity: 0, y: -14, clipPath: "inset(0% 0% 100% 0% round 12px)" } : false}
      animate={{ opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0% round 12px)" }}
      transition={{ ...springGentle, delay }}
      className={clsx("min-w-0 rounded-xl border bg-white p-3.5 shadow-xs sm:p-4", editing ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200")}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.8125rem] font-bold" style={{ background: tone.bgPicked, color: tone.ink, boxShadow: `inset 0 0 0 1px ${tone.edge}` }}>
          {pick.rank}
        </span>
        <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: tone.bg, color: tone.ink }}>{hook}</span>
        {col && <span className="truncate text-xs text-gray-500">{col.label}</span>}
        {pick.score != null && (
          <span className="num ml-auto text-[0.9375rem] font-bold text-gray-900">
            {pick.score}
            <span className="text-[0.6875rem] font-medium text-gray-500">점</span>
          </span>
        )}
      </div>
      <h4 className="mt-2 text-[0.9375rem] font-bold leading-snug">{story.title}</h4>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-gray-600">
        <span className="font-semibold text-gray-800">고른 이유 </span>
        {pick.reason}
      </p>
      {story.cuts[0] && (
        <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-[0.8125rem] leading-relaxed">
          <span className="text-gray-500">첫 컷 </span>“{story.cuts[0].caption}”
        </p>
      )}
      <details className="group mt-2">
        <summary className="press flex w-fit cursor-pointer list-none items-center gap-1 rounded-md text-[0.78125rem] font-semibold text-gray-500 hover:text-gray-900">
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          <span className="group-open:hidden">컷·자막·캡션 펼치기</span>
          <span className="hidden group-open:inline">접기</span>
        </summary>
        <ol className="mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
          {story.cuts.map((c, i) => (
            <li key={i} className="text-[0.8125rem] leading-relaxed">
              <span className="num mr-1.5 text-[0.71875rem] text-gray-500">{c.start_s}–{c.end_s}초</span>
              <span className="text-gray-700">{c.visual}</span>
              <span className="block font-medium text-gray-900">“{c.caption}”</span>
            </li>
          ))}
        </ol>
        {story.caption && <p className="mt-2 whitespace-pre-line text-[0.8125rem]"><span className="font-semibold">캡션 </span>{story.caption}</p>}
        {story.hashtags.length > 0 && <p className="mt-1 break-words text-[0.78125rem] text-blue-600">{story.hashtags.map((h) => `#${h}`).join(" ")}</p>}
        {story.why && <p className="mt-2 text-[0.78125rem] leading-relaxed text-gray-500"><span className="font-semibold text-gray-600">빌린 구조 </span>{story.why}</p>}
        {story.cautions.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[0.78125rem] text-amber-700">
            {story.cautions.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        )}
      </details>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className={clsx("press inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[0.8125rem] font-semibold", editing ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50")}
        >
          <PencilLine size={13} /> {editing ? "이 안을 고치는 중" : "이 안 고치기"}
        </button>
        {story.material && <Chip>소재: {story.material}</Chip>}
      </div>
    </motion.article>
  );
}
