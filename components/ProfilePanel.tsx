"use client";

import { useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2, Check, X } from "lucide-react";
import clsx from "clsx";
import { ACCOUNT_BY_ID, type AccountId, type Concept, type Material, type MaterialStatus } from "@/lib/accounts";
import { useProfiles } from "@/lib/profiles";
import { Button, Chip, Panel, SectionTitle } from "./ui";

const FIELDS: { key: keyof Concept; label: string; rows: number }[] = [
  { key: "summary", label: "계정 한 줄 요약", rows: 2 },
  { key: "audience", label: "누구에게 말하나", rows: 2 },
  { key: "tone", label: "말투/등장 방식", rows: 2 },
  { key: "cta", label: "영상 끝 행동 유도(CTA)", rows: 2 },
  { key: "formats", label: "잘 맞는 포맷/참고 계정", rows: 3 },
  { key: "rules", label: "지킬 표기/금지 사항", rows: 3 },
];
const STATUSES: MaterialStatus[] = ["아이디어", "예정", "게시함", "보관"];
const statusTone = { 아이디어: "gray", 예정: "blue", 게시함: "green", 보관: "amber" } as const;

const blank = (): Material => ({ id: "", title: "", memo: "", status: "아이디어", updated_at: "" });
const field = "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function ProfilePanel({ accountId }: { accountId: AccountId }) {
  const { profile, setConcept, saveMaterial, deleteMaterial, reset, storage, saved } = useProfiles();
  const { concept, materials } = profile(accountId);
  const account = ACCOUNT_BY_ID[accountId];
  const [editing, setEditing] = useState<Material | null>(null);
  const [filter, setFilter] = useState<"전체" | MaterialStatus>("전체");

  const shown = materials.filter((m) => filter === "전체" || m.status === filter);

  function submit() {
    if (!editing || !editing.title.trim()) return;
    const id = editing.id || `${accountId}-${Date.now().toString(36)}`;
    saveMaterial(accountId, { ...editing, id, title: editing.title.trim() });
    setEditing(null);
  }

  return (
    <Panel className="mb-6 p-5">
      <SectionTitle
        title="계정 컨셉 및 소재"
        desc={`@${account.handle}, ${account.owner} 담당. 노션 '인스타그램/스레드' 페이지를 기준으로 채운 초안이에요. 바로 고쳐 쓰세요.`}
        right={
          <div className="flex items-center gap-3 text-[13px] text-gray-500">
            <span>
              {storage === "loading" ? "저장소 확인 중…" : storage === "supabase" ? (saved === "saving" ? "저장 중…" : saved === "failed" ? "저장 실패 / 이 브라우저에 보관" : "팀 공유 저장됨") : "이 브라우저에만 저장"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => confirm("컨셉과 소재를 초기값(노션 기준)으로 되돌릴까요? 수정한 내용은 사라져요.") && reset(accountId)}>
              <RotateCcw size={14} /> 초기값으로
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-[13px] font-semibold text-gray-600">{f.label}</span>
            <textarea className={clsx(field, "resize-y leading-relaxed")} rows={f.rows} value={concept[f.key]} onChange={(e) => setConcept(accountId, { [f.key]: e.target.value })} />
          </label>
        ))}
      </div>

      <div className="mb-3 mt-6 flex flex-wrap items-center gap-2">
        <h3 className="mr-2 text-[15px] font-bold">소재 {materials.length}개</h3>
        {(["전체", ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={clsx("rounded-md px-2.5 py-1 text-[13px] font-semibold", filter === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {s}
          </button>
        ))}
        <Button size="sm" className="ml-auto" onClick={() => setEditing(blank())}>
          <Plus size={14} /> 소재 추가
        </Button>
      </div>

      {editing && (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <input autoFocus className={field} placeholder="소재 이름 (예: 채팅으로 고치기)" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <select className={field} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as MaterialStatus })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <textarea className={clsx(field, "mt-3")} rows={3} placeholder="메모 — 후킹 후보, 표기 규칙, 주의할 점" value={editing.memo} onChange={(e) => setEditing({ ...editing, memo: e.target.value })} />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X size={14} /> 취소</Button>
            <Button size="sm" onClick={submit} disabled={!editing.title.trim()}><Check size={14} /> 저장</Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {shown.length === 0 && <p className="p-6 text-center text-sm text-gray-400">이 상태의 소재가 없어요.</p>}
        {shown.map((m) => (
          <div key={m.id} className="flex items-start gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{m.title}</span>
                <Chip tone={statusTone[m.status]}>{m.status}</Chip>
              </div>
              {m.memo && <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-gray-500">{m.memo}</p>}
            </div>
            <Button variant="ghost" size="sm" aria-label="수정" onClick={() => setEditing(m)}><Pencil size={14} /></Button>
            <Button variant="ghost" size="sm" aria-label="삭제" onClick={() => confirm(`'${m.title}' 소재를 삭제할까요?`) && deleteMaterial(accountId, m.id)}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
