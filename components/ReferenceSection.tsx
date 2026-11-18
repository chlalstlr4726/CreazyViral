"use client";

import { ReadableText } from "./ReadableText";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Repeat } from "lucide-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORIES, multipleOf, type RefCategory, type RefRegion, type ViralReference } from "@/lib/references";
import { compact } from "@/lib/format";
import { spring } from "@/lib/motion";
import { Chip, Panel, SectionTitle } from "./ui";
import type { summarizeCompetitors } from "@/lib/competitorRepo";

const PERIODS = [3, 7, 14] as const;
const fmtDate = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={clsx("press rounded-md px-2.5 py-1 text-[0.8125rem] font-semibold", active ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
      {children}
    </button>
  );
}

/** 접었다 펴는 칸(<details>). 펼칠 때와 같은 길(높이·흐림, 같은 스프링)로 접힌다. 접히는 움직임이 끝날 때까지 <details>를 열어 둔다. */
function Fold({ className, label, children }: { className?: string; label: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  return (
    <details className={className} open={open || held}>
      <summary
        className="press origin-left cursor-pointer"
        style={{ listStyleType: open ? "disclosure-open" : "disclosure-closed" }}
        onClick={(e) => {
          e.preventDefault();
          setHeld(true);
          setOpen(!open);
        }}
      >
        {label}
      </summary>
      <AnimatePresence initial={false} onExitComplete={() => setHeld(false)}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="flow-root overflow-clip"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </details>
  );
}

export function ReferenceSection() {
  const [items, setItems] = useState<ViralReference[] | null>(null);
  const [sample, setSample] = useState(false);
  const [summary, setSummary] = useState<ReturnType<typeof summarizeCompetitors> | null>(null);
  const [failed, setFailed] = useState(false);
  const [days, setDays] = useState<3 | 7 | 14>(7);
  const [cat, setCat] = useState<"전체" | RefCategory>("전체");
  const [region, setRegion] = useState<"전체" | RefRegion>("전체");
  const [sort, setSort] = useState<"multiple" | "plays" | "recent">("multiple");

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setFailed(false);
    setSample(false);
    setSummary(null);
    fetch(`/api/references?days=${days}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw Error("references_unavailable");
        return response.json();
      })
      .then((data) => {
        setItems(data.items);
        setSample(data.sample);
        setSummary(data.summary);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [days]);

  const repeats = new Map((summary?.formats ?? []).map((group) => [group.format, group.accounts]));

  const shown = useMemo(() => {
    const v = (items ?? []).filter((r) => (cat === "전체" || r.category === cat) && (region === "전체" || r.region === region));
    return [...v].sort((a, b) =>
      sort === "multiple" ? (multipleOf(b) ?? -1) - (multipleOf(a) ?? -1) : sort === "plays" ? b.plays - a.plays : +new Date(b.posted_at) - +new Date(a.posted_at),
    );
  }, [items, cat, region, sort]);

  const hot = summary?.formats ?? [];

  return (
    <Panel className="dashboard-copy mb-6 p-3 sm:p-5">
      <SectionTitle
        title="경쟁사 레퍼런스"
        desc="경쟁사 계정의 최근 영상을 평소 대비 배수 순으로 보여줘요. 같은 형식이 여러 계정에서 반복되는지도 함께 표시해요."
        right={
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setDays(p)} className={clsx("press rounded px-3 py-1 text-[0.8125rem] font-semibold", days === p ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-900")}>
                최근 {p}일
              </button>
            ))}
          </div>
        }
      />
      {sample && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-[0.8125rem] text-amber-700">지금 보이는 영상은 화면 확인용 샘플이에요. 데이터 연결 후 실제 영상으로 바뀌어요.</p>}

      {summary && (
        <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">
          <p className="font-bold">평소 대비 3배 이상 {summary.viralReels}편 · {summary.accounts.length}개 계정</p>
          {summary.accounts.length > 0 && (
            <Fold className="mt-2 text-gray-600" label="계정별 반응 확인">
              <ul className="mt-2 space-y-1">
                {summary.accounts.map((account) => <li key={account.username}>@{account.username} · {account.reels}편 · 최고 {account.peak?.toFixed(1)}배</li>)}
              </ul>
            </Fold>
          )}
        </div>
      )}
      {hot.length > 0 && (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
          <p className="mb-1.5 text-[0.8125rem] font-bold text-violet-700">여러 계정에서 반복되는 형식</p>
          <div className="flex flex-wrap gap-2">
            {hot.map(({ format, accounts }) => (
              <span key={format} className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[0.8125rem] font-semibold text-violet-700 ring-1 ring-violet-200">
                <Repeat size={13} /> {format}: {accounts}개 계정
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="competitor-filters mb-4 flex flex-wrap items-center gap-2">
        <Pill active={cat === "전체"} onClick={() => setCat("전체")}>전체 분류</Pill>
        {CATEGORIES.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}
        <span className="mx-1 h-4 w-px bg-gray-200" />
        {(["전체", "국내", "해외"] as const).map((r) => <Pill key={r} active={region === r} onClick={() => setRegion(r)}>{r === "전체" ? "국내+해외" : r}</Pill>)}
        <select className="press ml-auto h-8 rounded-md border border-gray-200 bg-white px-2 text-[0.8125rem]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="multiple">평소 대비 배수 높은 순</option>
          <option value="plays">조회수 높은 순</option>
          <option value="recent">최신순</option>
        </select>
      </div>

      {failed && <p className="p-6 text-center text-sm text-red-500">레퍼런스를 불러오지 못했어요.</p>}
      {!failed && items === null && <p className="p-6 text-center text-sm text-gray-500">불러오는 중…</p>}
      {items && shown.length === 0 && <p className="p-6 text-center text-sm text-gray-500">조건에 맞는 영상이 없어요.</p>}

      <div className="competitor-list">
        {shown.map((r) => {
          const mult = multipleOf(r);
          const n = r.format_key && (mult ?? 0) >= 3 ? repeats.get(r.format_key.trim()) ?? 0 : 0;
          return (
            <article key={r.id} className="competitor-card">
              <div className="competitor-account flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="text-sm font-bold">@{r.username}</span>
                <span className="text-[0.8125rem] text-gray-500">팔로워 {r.followers != null ? compact(r.followers) : "-"}</span>
                <span className="text-[0.8125rem] text-gray-500">{fmtDate(r.posted_at)} 게시, {r.duration_s}초</span>
              </div>
              <div className="competitor-metrics">
                <span className="text-xl font-bold text-blue-600">{mult != null ? `평소 대비 ${mult >= 10 ? Math.round(mult) : mult.toFixed(1)}배` : "평소 대비 배수 -"}</span>
                <span className="text-[0.8125rem] text-gray-600">조회수 <b>{compact(r.plays)}</b>, 평소 조회수 {r.usual_plays != null ? compact(r.usual_plays) : "-"}</span>
              </div>
              <div className="competitor-tags flex flex-wrap items-center gap-2">
                <Chip tone="blue">{r.category}</Chip>
                <Chip>{r.region}</Chip>
                {r.is_ad === true && <Chip tone="amber">광고</Chip>}
                {r.is_ad === null && <Chip>광고 여부 미확인</Chip>}
                {n >= 2 && <Chip tone="green">같은 형식 {n}개 계정에서 반복</Chip>}
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-blue-600 hover:underline">
                  영상 보기 <ExternalLink size={13} />
                </a>
              </div>

              <dl className="competitor-analysis">
                <div className="competitor-detail"><dt className="text-[0.8125rem] font-semibold text-gray-500">첫 3초</dt><dd className="font-medium"><ReadableText text={r.hook_3s || "-"} /></dd></div>
                <div className="competitor-detail"><dt className="text-[0.8125rem] font-semibold text-gray-500">내용 전개</dt><dd><ReadableText text={r.flow || "-"} /></dd></div>
                <div className="competitor-detail"><dt className="text-[0.8125rem] font-semibold text-gray-500">CTA</dt><dd><ReadableText text={r.cta || "없음"} /></dd></div>
                <div className="competitor-detail"><dt className="text-[0.8125rem] font-semibold text-gray-500">추천 이유</dt><dd className="text-gray-700"><ReadableText text={r.reason || "-"} /></dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
