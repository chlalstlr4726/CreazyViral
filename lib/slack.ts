import type { Card } from "./types";

// Slack mrkdwn에서 의미가 있는 문자만 이스케이프
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TYPE_LABEL = { dummy: "Dummy 바이럴", service: "서비스 소개" } as const;
const LEVEL = ["", "쉬움", "보통", "어려움"];

/** 오늘의 카드(1~2장)를 Slack Block Kit 메시지로 만든다. 버튼은 대시보드 카드 상세로 연결. */
export function buildCardBlocks(cards: Card[], baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: "오늘 만들 콘텐츠 2가지", emoji: true } },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "카드를 열어 스토리보드를 보고, 하나를 선택해 주세요." }],
    },
  ];

  for (const c of cards) {
    const hook = c.storyboard[0];
    const total = c.storyboard[c.storyboard.length - 1]?.end_s ?? 0;
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*[${TYPE_LABEL[c.type]}] ${esc(c.title)}*\n` +
            `포맷 ${esc(c.format)} · 난이도 ${LEVEL[c.difficulty]} · ${c.storyboard.length}컷 ${total}초\n` +
            (hook ? `> 훅: “${esc(hook.caption)}”\n` : "") +
            `_${esc(c.rationale)}_`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "스토리보드 보고 선택하기", emoji: true },
            style: "primary",
            url: `${base}/cards/${encodeURIComponent(c.card_id)}`,
            action_id: `open_card_${c.type}`,
          },
        ],
      },
    );
  }
  return blocks;
}

export async function postToSlack(blocks: unknown[], text: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL;
  if (!token || !channel) return { ok: false as const, error: "env_missing" };

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, text, blocks, unfurl_links: false }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  return data.ok ? { ok: true as const } : { ok: false as const, error: data.error ?? "unknown" };
}
