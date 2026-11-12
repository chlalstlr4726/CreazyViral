"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { ArrowRight, Check, Clock, Music, RefreshCw, Star, X } from "lucide-react";
import type { Card } from "@/lib/types";
import { PASS_REASONS } from "@/lib/types";
import { Button, Chip, Difficulty, TypeBadge } from "./ui";

export function PassDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-gray-950/40 p-4" onClick={onClose}>
      <div className="pop w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">이 카드를 패스하는 이유</h3>
            <p className="mt-1 text-sm text-gray-500">고른 사유는 다음 카드 추천을 개선하는 데 쓰여요.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {PASS_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={clsx(
                "rounded-md border px-3.5 py-2 text-sm font-medium transition-colors",
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
      </div>
    </div>
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
    <article
      className={clsx(
        "relative flex flex-col rounded-xl border bg-white p-6 shadow-xs transition",
        status === "selected" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-200",
        status === "passed" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
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
        {status === "passed" && <Chip tone="red">패스 · {passReason}</Chip>}
      </div>

      <h3 className="mt-4 text-[22px] font-bold leading-snug tracking-tight">{card.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{card.rationale}</p>

      <div className="mt-5 rounded-lg bg-gray-50 p-4">
        <div className="text-[11px] font-semibold tracking-wide text-gray-400">훅 (0–{hook.end_s}초)</div>
        <p className="mt-1 text-[15px] font-semibold text-gray-900">“{hook.caption}”</p>
        <p className="mt-0.5 text-[13px] text-gray-500">{hook.visual}</p>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-4 text-sm">
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
            {card.storyboard.length}컷 · {total}초
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 flex items-center gap-1 text-xs text-gray-400">
            <Music size={12} /> 오디오
          </dt>
          <dd className="truncate font-medium" title={card.audio.name}>
            {card.audio.commercial_ok ? "✅" : "⚠️"} {card.audio.name}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex gap-2">
        {status === "selected" ? (
          <Link href={`/cards/${card.card_id}`} className="flex-1">
            <Button className="w-full">
              스토리보드 보기 <ArrowRight size={16} />
            </Button>
          </Link>
        ) : (
          <Button className="flex-1" onClick={onSelect} disabled={status === "passed"}>
            이걸로 선택
          </Button>
        )}
        <Link href={`/cards/${card.card_id}`}>
          <Button variant="secondary">상세 보기</Button>
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
