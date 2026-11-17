"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Lightbulb } from "lucide-react";
import type { Card, CardType } from "@/lib/types";
import { ACCOUNT_BY_ID, type AccountId } from "@/lib/accounts";
import { useStore } from "@/lib/store";
import { buildDirection } from "@/lib/recommend";
import { kstToday, koDate } from "@/lib/format";
import { CardTile, PassDialog } from "./CardTile";
import { Button, Chip, SectionTitle, TypeBadge } from "./ui";

export function TodaySection({ accountId }: { accountId: AccountId }) {
  const account = ACCOUNT_BY_ID[accountId];
  const router = useRouter();
  const s = useStore();
  const [passFor, setPassFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  async function sendToSlack() {
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/slack/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: [s.todayCard("dummy", accountId), s.todayCard("service", accountId)].filter(Boolean) }),
      });
      const data = await res.json();
      setSendMsg(data.ok ? "슬랙으로 보냈어요" : data.error === "env_missing" ? ".env.local의 슬랙 설정을 확인해 주세요" : `전송 실패: ${data.error}`);
    } catch {
      setSendMsg("전송 실패: 서버에 연결할 수 없어요");
    } finally {
      setSending(false);
    }
  }

  const direction = useMemo(() => buildDirection(s.posts.filter((p) => p.card_id && p.account_id === accountId)), [s.posts, accountId]);
  const types: CardType[] = ["dummy", "service"];
  const hasCards = types.some((t) => s.todayCard(t, accountId));
  const hasMissingCards = types.some((t) => !s.todayCard(t, accountId));
  const [recent, setRecent] = useState<Card[]>([]);

  useEffect(() => {
    if (s.cardSource !== "supabase" || !hasMissingCards) return;
    const abort = new AbortController();
    fetch("/api/cards/recent", { cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data: { cards: Card[] } = await response.json();
        setRecent(data.cards);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [s.cardSource, hasMissingCards]);

  return (
    <div>
      <SectionTitle
        title="오늘 만들 콘텐츠"
        desc={`${koDate(kstToday())} · @${account.handle} 맞춤 추천`}
        right={
          <div className="flex items-center gap-3">
            {sendMsg && <span className="text-sm text-gray-500">{sendMsg}</span>}
            <Button variant="secondary" size="sm" onClick={sendToSlack} disabled={sending || !hasCards} title={hasCards ? undefined : "보낼 카드가 아직 없어요"}>
              {sending ? "보내는 중…" : "슬랙으로 테스트 전송"}
            </Button>
          </div>
        }
      />

      <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-br from-[#171b45] to-[#2b3282] p-6 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-200">
          <Lightbulb size={16} /> 오늘의 방향성 제언
        </div>
        <p className="mt-3 text-xl font-bold leading-snug">{direction.headline}</p>
        <details className="group mt-3">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded text-sm font-medium text-blue-100 focus-visible:outline-2 focus-visible:outline-offset-4">
            추천 근거 <ChevronDown size={15} aria-hidden="true" className="group-open:rotate-180" />
          </summary>
          <div className="mt-4">
            <Chip tone={direction.confidence === "높음" ? "green" : direction.confidence === "보통" ? "amber" : "gray"}>
              근거 신뢰도 {direction.confidence}
            </Chip>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-blue-100/90">
            {direction.evidence.map((e) => (
              <li key={e} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-300" />
                {e}
              </li>
            ))}
          </ul>
          {direction.caveat && <p className="mt-3 text-xs text-blue-200/70">※ {direction.caveat}</p>}
        </details>
      </div>

      <div className="today-cards">
        {types.map((t) => {
          const card = s.todayCard(t, accountId);
          if (!card) {
            const previous = recent.find((c) => c.type === t && c.date < kstToday() && c.account_id === accountId)
              ?? recent.find((c) => c.type === t && c.date < kstToday() && !c.account_id);
            return <EmptyCard key={t} type={t} source={s.cardSource} previous={previous} />;
          }
          return (
            <CardTile
              key={card.card_id}
              card={card}
              status={s.statusOf(card.card_id)}
              passReason={s.passReasonOf(card.card_id)}
              recommended={direction.lean === t}
              onSelect={() => {
                s.select(card.card_id);
                router.push(`/cards/${card.card_id}`);
              }}
              onPass={() => setPassFor(card.card_id)}
              onRegenerate={() => s.regenerate(t, accountId)}
            />
          );
        })}
      </div>

      {passFor && (
        <PassDialog
          onClose={() => setPassFor(null)}
          onConfirm={(reason) => {
            s.pass(passFor, reason);
            setPassFor(null);
          }}
        />
      )}
    </div>
  );
}

function EmptyCard({ type, source, previous }: { type: CardType; source: ReturnType<typeof useStore>["cardSource"]; previous?: Card }) {
  const status = {
    loading: "오늘 카드를 불러오는 중이에요",
    error: "카드 DB에서 오늘 카드를 불러오지 못했어요",
    unconfigured: "카드 DB 연결 설정이 필요해요",
    supabase: "오늘 카드가 아직 저장되지 않았어요",
  }[source];
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <TypeBadge type={type} />
      <p className="mt-4 text-lg font-bold">{status}</p>
      {source === "supabase" && previous && (
        <div className="mt-3 text-sm text-gray-500">
          <p>최근 카드 · {koDate(previous.date)}{!previous.account_id && " · 계정 미지정"}</p>
          <Link href={`/cards/${encodeURIComponent(previous.card_id)}`} className="mt-1 inline-block font-semibold text-blue-700">
            {previous.title}
          </Link>
        </div>
      )}
    </div>
  );
}
