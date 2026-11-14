"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb } from "lucide-react";
import type { CardType } from "@/lib/types";
import { ACCOUNT_BY_ID, type AccountId } from "@/lib/accounts";
import { useStore } from "@/lib/store";
import { buildDirection } from "@/lib/recommend";
import { koDate } from "@/lib/format";
import { TODAY } from "@/lib/mock";
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

  return (
    <div>
      <SectionTitle
        title="오늘 만들 콘텐츠"
        desc={`${koDate(TODAY)}. 최근 반응이 컸던 포맷을 @${account.handle} 컨셉에 맞게 바꿔 놓았어요. 하나를 골라 바로 찍어보세요.`}
        right={
          <div className="flex items-center gap-3">
            {sendMsg && <span className="text-sm text-gray-500">{sendMsg}</span>}
            <Button variant="secondary" size="sm" onClick={sendToSlack} disabled={sending}>
              {sending ? "보내는 중…" : "슬랙으로 테스트 전송"}
            </Button>
          </div>
        }
      />

      <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-br from-[#171b45] to-[#2b3282] p-6 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-200">
          <Lightbulb size={16} /> 오늘의 방향성 제언
          <span className="ml-auto flex items-center gap-2">
            <Chip tone={direction.confidence === "높음" ? "green" : direction.confidence === "보통" ? "amber" : "gray"}>
              근거 신뢰도 {direction.confidence}
            </Chip>
          </span>
        </div>
        <p className="mt-3 text-xl font-bold leading-snug">{direction.headline}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-blue-100/90">
          {direction.evidence.map((e) => (
            <li key={e} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-300" />
              {e}
            </li>
          ))}
        </ul>
        {direction.caveat && <p className="mt-3 text-xs text-blue-200/70">※ {direction.caveat}</p>}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {types.map((t) => {
          const card = s.todayCard(t, accountId);
          if (!card) return <EmptyCard key={t} type={t} />;
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

function EmptyCard({ type }: { type: CardType }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <TypeBadge type={type} />
      <p className="mt-4 text-lg font-bold">오늘의 카드가 아직 없어요</p>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-500">매일 아침 카드 API가 이 계정의 카드를 만들어 저장하면 여기에 나타나요.</p>
    </div>
  );
}
