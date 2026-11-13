"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { HISTORY_CARDS, TODAY } from "@/lib/mock";
import { koDate, mult } from "@/lib/format";
import { Chip, Panel, TypeBadge } from "@/components/ui";
import { LinkPost } from "@/components/LinkPost";
import type { Card } from "@/lib/types";

export default function HistoryPage() {
  const s = useStore();
  const [days, setDays] = useState(10);

  const groups = useMemo(() => {
    const map = new Map<string, Card[]>();
    const today = [s.todayCard("dummy"), s.todayCard("service")].filter(Boolean) as Card[];
    map.set(TODAY, today);
    for (const c of HISTORY_CARDS) map.set(c.date, [...(map.get(c.date) ?? []), c]);
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [s]);

  const scoreOf = (cardId: string) => s.posts.find((p) => p.card_id === cardId);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">히스토리</h1>
      <p className="mt-1.5 mb-8 text-gray-500">그동안 받은 카드와 내가 한 선택, 그 결과 성과를 한눈에 볼 수 있어요.</p>

      <Panel className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              <th className="w-36 px-6 py-3 font-medium">유형</th>
              <th className="py-3 font-medium">카드</th>
              <th className="w-40 py-3 font-medium">내 선택</th>
              <th className="w-72 py-3 font-medium">게시물</th>
              <th className="w-24 px-6 py-3 text-right font-medium">성과</th>
            </tr>
          </thead>
          <tbody>
            {groups.slice(0, days).map(([date, cards]) => (
              <Fragment key={date}>
                <tr className="bg-gray-50/70">
                  <td colSpan={5} className="px-6 py-2 text-[13px] font-semibold text-gray-700">
                    {koDate(date)} {date === TODAY && <Chip tone="blue">오늘</Chip>}
                  </td>
                </tr>
                {cards.map((c) => {
                  const st = s.statusOf(c.card_id);
                  const post = scoreOf(c.card_id);
                  return (
                    <tr key={c.card_id} className={clsx("border-b border-gray-50", !st && "text-gray-400")}>
                      <td className="px-6 py-3.5">
                        <TypeBadge type={c.type} />
                      </td>
                      <td className="py-3.5 pr-4">
                        <Link href={`/cards/${c.card_id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {c.title}
                        </Link>
                        <div className="text-xs text-gray-400">{c.format}</div>
                      </td>
                      <td className="py-3.5">
                        {st === "selected" ? (
                          <Chip tone="blue">선택</Chip>
                        ) : st === "passed" ? (
                          <Chip tone="red">패스 · {s.passReasonOf(c.card_id)}</Chip>
                        ) : (
                          <span className="text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4">{st === "selected" ? <LinkPost cardId={c.card_id} compact /> : <span className="text-xs">—</span>}</td>
                      <td className="px-6 py-3.5 text-right">
                        {post ? (
                          <span
                            className={clsx(
                              "num inline-block rounded-md px-2 py-0.5 text-xs font-bold",
                              post.multiple >= 1.5 ? "bg-blue-500 text-white" : post.multiple >= 1 ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500",
                            )}
                          >
                            {mult(post.multiple)}
                          </span>
                        ) : (
                          <span className="text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
        {days < groups.length && (
          <button onClick={() => setDays((d) => d + 10)} className="w-full border-t border-gray-100 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50">
            더 보기
          </button>
        )}
      </Panel>
    </div>
  );
}
