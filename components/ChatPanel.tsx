"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import clsx from "clsx";
import { ACCOUNT_BY_ID, type AccountId } from "@/lib/accounts";
import type { StoryResult } from "@/lib/chat";
import type { ViralReel } from "@/lib/viral";
import { useProfiles } from "@/lib/profiles";
import { Button, Chip, Panel, SectionTitle } from "./ui";

interface Used { viral: ViralReel[]; material: { id: string; title: string } | null; days: number }
interface Turn { role: "user" | "assistant"; text: string; story?: StoryResult; used?: Used; error?: boolean }

const DEFAULT_MSG = "최근 우리 소재로, 최근 며칠간 탑5 바이럴 구조에 맞는 스토리보드 하나 짜줘";
const fmtN = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : n.toLocaleString());
const sec = (n: number) => `${n}s`;

export function ChatPanel({ accountId }: { accountId: AccountId }) {
  const account = ACCOUNT_BY_ID[accountId];
  const { profile } = useProfiles();
  const { concept, materials } = profile(accountId);
  const [days, setDays] = useState<3 | 7 | 14>(3);
  const [materialId, setMaterialId] = useState("");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  const usable = materials.filter((m) => m.status !== "보관");

  async function send(text?: string) {
    const message = (text ?? input).trim() || DEFAULT_MSG;
    if (busy) return;
    const history = turns.map((t) => ({ role: t.role, content: t.story ? JSON.stringify(t.story) : t.text }));
    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, message, materialId: materialId || undefined, days, concept, materials, history }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "failed");
      setTurns((t) => [...t, { role: "assistant", text: d.story.title, story: d.story, used: d.used }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", error: true, text: "스토리보드를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="mb-6 p-5">
      <SectionTitle title={`AI 스토리보드 · ${account.name}`} desc="우리 소재를 최근 탑5 바이럴 영상의 구조에 맞춰 스토리보드로 짜줘요. 추천 카드 외에 따로 더 만들고 싶을 때 쓰세요." />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-gray-600">
          소재
          <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px]" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">자동으로 고르기 (최근·확인된 소재 우선)</option>
            {usable.map((m) => <option key={m.id} value={m.id}>{m.title}{m.basis === "확인 필요" ? " · 확인 필요" : ""}</option>)}
          </select>
        </label>
        <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
          {([3, 7, 14] as const).map((p) => (
            <button key={p} onClick={() => setDays(p)} className={clsx("rounded px-3 py-1 text-[13px] font-semibold", days === p ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-900")}>
              최근 {p}일
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="ml-auto max-w-[80%] rounded-xl bg-blue-500 px-4 py-2.5 text-sm text-white">{t.text}</div>
          ) : t.error || !t.story ? (
            <p key={i} className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{t.text}</p>
          ) : (
            <Story key={i} story={t.story} used={t.used} onFollow={send} />
          ),
        )}
        {busy && <p className="text-sm text-gray-400">스토리보드 짜는 중…</p>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="h-10 flex-1 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder={turns.length ? "수정 요청 (예: 컷을 4개로 줄여줘, 더 웃기게)" : DEFAULT_MSG}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
        />
        <Button onClick={() => send()} disabled={busy}><Send size={14} /> {turns.length ? "보내기" : "스토리보드 만들기"}</Button>
      </div>
    </Panel>
  );
}

function Story({ story, used, onFollow }: { story: StoryResult; used?: Used; onFollow: (t: string) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Sparkles size={15} className="text-blue-500" />
        <h4 className="text-[15px] font-bold">{story.title}</h4>
        <Chip tone={story.mode === "ai" ? "blue" : "amber"}>{story.mode === "ai" ? "AI 작성" : "기본 틀(AI 키 없음)"}</Chip>
        {used?.material && <Chip>소재: {used.material.title}</Chip>}
      </div>
      <p className="text-[13px] leading-relaxed text-gray-600">{story.why}</p>

      {used && used.viral.length > 0 && (
        <details className="mt-2 text-[13px] text-gray-500">
          <summary className="cursor-pointer font-semibold">참고한 최근 {used.days}일 탑{used.viral.length} 바이럴</summary>
          <ol className="mt-1.5 space-y-1">
            {used.viral.map((v, i) => (
              <li key={v.id}>
                {i + 1}. <a href={v.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">@{v.user}</a> · 조회 {fmtN(v.plays)} · {v.sec}초 — {v.caption.slice(0, 40)}
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[12px] text-gray-500">
            <tr><th className="w-20 px-3 py-2">시간</th><th className="px-3 py-2">화면</th><th className="px-3 py-2">자막</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {story.cuts.map((c, i) => (
              <tr key={i} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{sec(c.start_s)}–{sec(c.end_s)}</td>
                <td className="px-3 py-2">{c.visual}</td>
                <td className="px-3 py-2 font-medium">{c.caption}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm"><span className="font-semibold">캡션 </span>{story.caption}</p>
      <p className="mt-1 text-[13px] text-blue-600">{story.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
      {story.cautions.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-[13px] text-amber-700">
          {story.cautions.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {["컷을 4개로 줄여줘", "훅을 더 센 문장으로 바꿔줘", "다른 소재로 하나 더"].map((q) => (
          <Button key={q} variant="secondary" size="sm" onClick={() => onFollow(q)}>{q}</Button>
        ))}
      </div>
    </div>
  );
}
