"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Copy, ExternalLink, Music, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { koDate } from "@/lib/format";
import { TODAY } from "@/lib/mock";
import type { AccountId } from "@/lib/accounts";
import { Button, Chip, Difficulty, Panel, TypeBadge } from "@/components/ui";
import { PassDialog } from "@/components/CardTile";
import { LinkPost } from "@/components/LinkPost";

const ROLE: Record<string, string> = { hook: "훅 참고", structure: "구성 참고", edit: "편집 참고" };

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const s = useStore();
  const [passOpen, setPassOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [missing, setMissing] = useState(false);
  const decoded = decodeURIComponent(id);
  const card = s.cardById(decoded);

  // 오늘 카드가 아닌 지난 카드(예: 슬랙에 남은 어제 링크)는 DB에서 따로 불러온다
  useEffect(() => {
    if (card) return;
    fetch(`/api/cards/${encodeURIComponent(decoded)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.card ? s.addCard(d.card) : setMissing(true)))
      .catch(() => setMissing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, decoded]);

  if (!card && !missing) return <div className="h-96" />;

  if (!card) {
    return (
      <div className="py-24 text-center">
        <p className="text-gray-500">카드를 찾을 수 없어요.</p>
        <Link href="/" className="mt-3 inline-block text-blue-600">
          홈으로
        </Link>
      </div>
    );
  }

  const status = s.statusOf(card.card_id);
  const isToday = card.date === TODAY;
  const isCurrent = isToday && !!card.account_id && s.todayCard(card.type, card.account_id as AccountId)?.card_id === card.card_id;
  const total = card.storyboard.at(-1)?.end_s ?? 0;

  return (
    <div>
      <Link href="/" className="mb-5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={15} /> 홈
      </Link>

      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <TypeBadge type={card.type} />
            <Chip>{card.format}</Chip>
            <span className="text-sm text-gray-400">{koDate(card.date)}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{card.title}</h1>
          <p className="mt-2 text-gray-500">{card.rationale}</p>
        </div>
        {status === "selected" && (
          <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white">
            <Check size={15} /> 선택한 카드
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="font-bold">스토리보드</h2>
              <span className="num text-sm text-gray-400">
                {card.storyboard.length}컷 · {total}초
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                  <th className="w-16 px-6 py-2.5 font-medium">컷</th>
                  <th className="w-24 py-2.5 font-medium">시간</th>
                  <th className="py-2.5 font-medium">화면 · 촬영</th>
                  <th className="py-2.5 pr-6 font-medium">자막 · 멘트</th>
                </tr>
              </thead>
              <tbody>
                {card.storyboard.map((c) => (
                  <tr key={c.cut} className="border-b border-gray-50 align-top last:border-0">
                    <td className="px-6 py-4">
                      <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-50 text-[13px] font-bold text-blue-600">{c.cut}</span>
                    </td>
                    <td className="num py-4 text-gray-500">
                      {c.start_s}–{c.end_s}s
                    </td>
                    <td className="py-4 pr-4">
                      {c.visual}
                      {c.note && <div className="mt-1 text-xs text-amber-600">💡 {c.note}</div>}
                    </td>
                    <td className="py-4 pr-6 font-semibold">{c.caption}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">구체적 프롬프트</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(card.prompt).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "복사됨" : "복사"}
              </Button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg bg-gray-50 p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-gray-700">{card.prompt}</pre>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel className="p-6">
            <h2 className="mb-4 font-bold">진행</h2>
            {status === "selected" ? (
              <div>
                <p className="mb-3 text-sm text-gray-500">게시를 마쳤다면 인스타 URL을 붙여넣어 주세요. 성과가 이 카드와 연결돼요.</p>
                <LinkPost cardId={card.card_id} />
              </div>
            ) : status === "passed" ? (
              <p className="text-sm text-gray-500">패스한 카드예요 · {s.passReasonOf(card.card_id)}</p>
            ) : (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => s.select(card.card_id)}>
                  이걸로 선택
                </Button>
                <div className="flex gap-2">
                  {isCurrent && (
                    <Button variant="secondary" className="flex-1" onClick={() => card.account_id && s.regenerate(card.type, card.account_id as AccountId)}>
                      <RefreshCw size={14} /> 재생성
                    </Button>
                  )}
                  <Button variant="secondary" className="flex-1" onClick={() => setPassOpen(true)}>
                    패스
                  </Button>
                </div>
              </div>
            )}
          </Panel>

          <Panel className="p-6">
            <h2 className="mb-4 font-bold">제작 정보</h2>
            <dl className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">난이도</dt>
                <dd>
                  <Difficulty level={card.difficulty} />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="flex items-center gap-1 text-gray-500">
                  <Music size={13} /> 오디오
                </dt>
                <dd className="text-right font-medium">
                  {card.audio.name}
                  <div className={card.audio.commercial_ok ? "text-xs text-emerald-600" : "text-xs text-amber-600"}>
                    {card.audio.commercial_ok ? "상업용 사용 가능" : "비즈니스 계정 사용 불가할 수 있음"}
                  </div>
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel className="p-6">
            <h2 className="mb-3 font-bold">캡션 초안</h2>
            <p className="text-sm leading-relaxed text-gray-700">{card.caption_draft}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.hashtags.map((h) => (
                <Chip key={h} tone="blue">
                  #{h}
                </Chip>
              ))}
            </div>
          </Panel>

          <Panel className="p-6">
            <h2 className="mb-3 font-bold">레퍼런스</h2>
            <ul className="space-y-2">
              {card.references.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                    {ROLE[r.role]}
                    <ExternalLink size={14} className="text-gray-400" />
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {passOpen && (
        <PassDialog
          onClose={() => setPassOpen(false)}
          onConfirm={(r) => {
            s.pass(card.card_id, r);
            setPassOpen(false);
          }}
        />
      )}
    </div>
  );
}
