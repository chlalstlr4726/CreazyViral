"use client";

import { ReadableText } from "./ReadableText";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";
import { ArrowRight, Check, ChevronDown, Clock, Music, RefreshCw, Star, X } from "lucide-react";
import type { Card } from "@/lib/types";
import { PASS_REASONS } from "@/lib/types";
import { Button, buttonClass, Chip, Difficulty, TypeBadge } from "./ui";

/**
 * 패스 이유 창. 부르는 쪽이 <AnimatePresence>로 감싸면 닫힐 때도 들어온 길(아래 → 위)로 돌아간다.
 * 집중이 필요한 일이라 뒤를 어둡게 가린다. Esc로 닫는다.
 */
export function PassDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-gray-950/30 p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={spring}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pass-dialog-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)] outline-none"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={spring}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 id="pass-dialog-title" className="text-lg font-bold">이 카드를 패스하는 이유</h3>
            <p className="mt-1 text-sm text-gray-500">고른 사유는 다음 카드 추천을 개선하는 데 쓰여요.</p>
          </div>
          <button onClick={onClose} className="press rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {PASS_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={clsx(
                "press rounded-md border px-3.5 py-2 text-sm font-medium",
                reason === r ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-700 hover:bg-gray-50",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button disabled={!reason} onClick={() => reason && onConfirm(reason)}>
            패스하기
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CardTile({
  card,
  status,
  passReason,
  recommended,
  onSelect,
  onPass,
  onRegenerate,
}: {
  card: Card;
  status: "selected" | "passed" | null;
  passReason?: string;
  recommended?: boolean;
  onSelect: () => void;
  onPass: () => void;
  onRegenerate: () => void;
}) {
  const hook = card.storyboard[0];
  const total = card.storyboard[card.storyboard.length - 1]?.end_s ?? 0;

  return (
    <article data-type={card.type}
      className={clsx(
        "relative flex flex-col rounded-xl border bg-white p-6 shadow-xs transition",
        status === "selected" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-200",
        status === "passed" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={card.type} />
        <Chip>{card.format}</Chip>
        {recommended && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <Star size={12} fill="currentColor" /> 오늘 추천
          </span>
        )}
        {status === "selected" && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">
            <Check size={12} /> 선택함
          </span>
        )}
        {status === "passed" && <Chip tone="red">패스: {passReason}</Chip>}
      </div>

      <h3 className="mt-4 text-[1.375rem] font-bold leading-snug tracking-tight">{card.title}</h3>

      {hook && (
        <div className="card-hook mt-5 rounded-lg bg-gray-50 p-4">
          <div className="text-xs font-semibold text-gray-600">첫 장면</div>
          <p className="mt-1 text-[0.9375rem] font-semibold text-gray-900">“{hook.caption}”</p>
        </div>
      )}

      <details className="group mt-4">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-4">
          추천 이유와 제작 정보 <ChevronDown size={15} aria-hidden="true" className="group-open:rotate-180" />
        </summary>
        {card.rationale && <p className="mt-3 text-sm text-gray-600"><ReadableText text={card.rationale} /></p>}
        {hook && <p className="mt-3 text-sm text-gray-600">첫 장면 (0–{hook.end_s}초) · {hook.visual}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="mb-1.5 flex items-center gap-1 text-xs text-gray-400">제작 난이도</dt>
            <dd>
              <Difficulty level={card.difficulty} />
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 flex items-center gap-1 text-xs text-gray-400">
              <Clock size={12} /> 분량
            </dt>
            <dd className="num font-medium">
              {card.storyboard.length}컷, {total}초
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 flex items-center gap-1 text-xs text-gray-400">
              <Music size={12} /> 오디오
            </dt>
            <dd className="font-medium">
              {card.audio.commercial_ok ? "✅" : "⚠️"} {card.audio.name}
            </dd>
          </div>
        </dl>
      </details>

      <div className="mt-6 flex gap-2">
        {status === "selected" ? (
          <Link href={`/cards/${card.card_id}`} className={buttonClass({}, "flex-1")}>
            스토리보드 보기 <ArrowRight size={16} />
          </Link>
        ) : (
          <Button className="flex-1" onClick={onSelect} disabled={status === "passed"}>
            이걸로 선택
          </Button>
        )}
        <Link href={`/cards/${card.card_id}`} className={buttonClass({ variant: "secondary" })}>
          상세 보기
        </Link>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          <RefreshCw size={14} /> 다른 소재로 재생성
        </Button>
        {status !== "passed" && status !== "selected" && (
          <Button variant="ghost" size="sm" onClick={onPass}>
            패스
          </Button>
        )}
      </div>
    </article>
  );
}
