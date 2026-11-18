"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useStore } from "@/lib/store";
import { buildDevMessages, toPlainText, PART_LABEL, type DevMessage } from "@/lib/devInsights";
import { Button, Chip, Panel } from "@/components/ui";
import { kstToday, koDate } from "@/lib/format";
import type { Card } from "@/lib/types";

export default function InsightsPage() {
  const s = useStore();
  const [copied, setCopied] = useState<string | null>(null);

  const [history, setHistory] = useState<{ source: "loading" | "supabase" | "unconfigured" | "error"; cards: Card[] }>({
    source: "loading",
    cards: [],
  });

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/cards/recent", { cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("cards_fetch_failed");
        const data: { source: "supabase" | "unconfigured"; cards: Card[] } = await response.json();
        setHistory(data);
      })
      .catch(() => {
        if (!abort.signal.aborted) setHistory({ source: "error", cards: [] });
      });
    return () => abort.abort();
  }, []);

  const feedback = useMemo(() => {
    const ids = new Set(history.cards.map((card) => card.card_id));
    return s.events.filter((event) => ids.has(event.card_id));
  }, [history.cards, s.events]);

  const msgs = useMemo(() => {
    if (history.source !== "supabase" || !s.ready) return [];
    const messages = buildDevMessages({ cards: history.cards, events: feedback, posts: s.posts });
    const today = kstToday();
    if (!history.cards.some((card) => card.date === today)) {
      const latest = history.cards[0];
      messages.unshift({
        to: "승원",
        priority: "높음",
        title: "오늘 카드 생성 및 저장 상태 확인",
        suggestion: "오늘(KST) 카드 생성 작업의 실행 결과를 확인해 주세요. 생성된 카드는 계정 ID와 날짜를 포함해 대시보드가 읽는 Supabase cards 테이블에 저장해 주세요.",
        evidence: [
          `${koDate(today)} 카드 0장`,
          latest ? `최근 30일 마지막 카드 날짜 ${koDate(latest.date)}` : "최근 30일 저장된 카드 0장",
        ],
      });
    }
    return messages;
  }, [history, feedback, s.posts, s.ready]);

  const emptyMessage = history.source === "error"
    ? "카드 DB에서 이력을 불러오지 못했어요."
    : history.source === "unconfigured"
      ? "카드 DB 연결 설정이 필요해요."
      : history.source === "loading" || !s.ready
        ? "카드와 피드백을 불러오는 중이에요."
        : `최근 30일 카드 ${history.cards.length}장 · 이 브라우저의 관련 피드백 ${feedback.length}건 · 수집된 게시물 ${s.posts.length}편`;

  const owners: DevMessage["to"][] = ["도하", "승원"];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">(개발자용) 최적화 제언</h1>
      <p className="mt-1.5 mb-8 text-gray-500">
        팀이 고른 카드, 패스 사유, 실제 성과를 바탕으로 점수 로직과 카드 생성 프롬프트를 어떻게 고치면 좋을지 자동으로 정리해요. 표본이 충분할 때만 제안이 나와요.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                <div className="py-10 text-center">
                  {history.source === "supabase" && s.ready && <p className="font-bold text-gray-700">제안할 만큼 표본이 쌓이면 여기에 표시돼요</p>}
                  <p className="mt-1 text-sm text-gray-500">{emptyMessage}</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {list.map((m) => (
                    <li key={m.title} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start gap-2">
                        <Chip tone={m.priority === "높음" ? "red" : "gray"}>{m.priority}</Chip>
                        <h3 className="font-semibold leading-snug">{m.title}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">{m.suggestion}</p>
                      <ul className="mt-3 space-y-1 rounded-md bg-gray-50 p-3 text-[0.8125rem] text-gray-500">
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
