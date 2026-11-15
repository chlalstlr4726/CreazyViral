"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useStore } from "@/lib/store";
import { HISTORY_CARDS } from "@/lib/mock";
import { buildDevMessages, toPlainText, PART_LABEL, type DevMessage } from "@/lib/devInsights";
import { Button, Chip, Panel } from "@/components/ui";
import type { Card } from "@/lib/types";

export default function InsightsPage() {
  const s = useStore();
  const [copied, setCopied] = useState<string | null>(null);

  const cards = useMemo(() => [...HISTORY_CARDS, ...s.allTodayCards()], [s]);
  const msgs = useMemo(() => buildDevMessages({ cards, events: s.events, posts: s.posts }), [cards, s.events, s.posts]);

  const owners: DevMessage["to"][] = ["도하", "승원"];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">(개발자용) 최적화 제언</h1>
      <p className="mt-1.5 mb-8 text-gray-500">
        팀이 고른 카드, 패스 사유, 실제 성과를 바탕으로 점수 로직과 카드 생성 프롬프트를 어떻게 고치면 좋을지 자동으로 정리해요. 표본이 충분할 때만 제안이 나와요.
      </p>

      <div className="grid grid-cols-2 gap-6">
        {owners.map((o) => {
          const list = msgs.filter((m) => m.to === o);
          return (
            <Panel key={o} className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{PART_LABEL[o]}</h2>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!list.length}
                  onClick={() => {
                    navigator.clipboard?.writeText(toPlainText(msgs, o)).catch(() => {});
                    setCopied(o);
                    setTimeout(() => setCopied(null), 1600);
                  }}
                >
                  {copied === o ? <Check size={14} /> : <Copy size={14} />} {copied === o ? "복사됨" : "메시지 복사"}
                </Button>
              </div>

              {list.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">아직 제안할 만큼 데이터가 쌓이지 않았어요</p>
              ) : (
                <ul className="space-y-4">
                  {list.map((m) => (
                    <li key={m.title} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start gap-2">
                        <Chip tone={m.priority === "높음" ? "red" : "gray"}>{m.priority}</Chip>
                        <h3 className="font-semibold leading-snug">{m.title}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{m.suggestion}</p>
                      <ul className="mt-3 space-y-1 rounded-md bg-gray-50 p-3 text-[13px] text-gray-500">
                        {m.evidence.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
