"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Repeat } from "lucide-react";
import clsx from "clsx";
import { CATEGORIES, multipleOf, type RefCategory, type RefRegion, type ViralReference } from "@/lib/references";
import { compact } from "@/lib/format";
import { Chip, Panel, SectionTitle } from "./ui";

const PERIODS = [3, 7, 14] as const;
const fmtDate = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={clsx("rounded-md px-2.5 py-1 text-[13px] font-semibold", active ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
      {children}
    </button>
  );
}

export function ReferenceSection() {
  const [items, setItems] = useState<ViralReference[] | null>(null);
  const [sample, setSample] = useState(false);
  const [failed, setFailed] = useState(false);
  const [days, setDays] = useState<3 | 7 | 14>(7);
  const [cat, setCat] = useState<"전체" | RefCategory>("전체");
  const [region, setRegion] = useState<"전체" | RefRegion>("전체");
  const [sort, setSort] = useState<"multiple" | "plays" | "recent">("multiple");

  useEffect(() => {
    setItems(null);
    setFailed(false);
    fetch(`/api/references?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setSample(!!d.sample);
      })
      .catch(() => setFailed(true));
  }, [days]);

  // 같은 형식(format_key)이 서로 다른 계정에서 몇 곳 터졌는지
  const repeats = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of items ?? []) if (r.format_key) m.set(r.format_key, (m.get(r.format_key) ?? new Set()).add(r.username));
    return m;
  }, [items]);

  const shown = useMemo(() => {
    const v = (items ?? []).filter((r) => (cat === "전체" || r.category === cat) && (region === "전체" || r.region === region));
    return [...v].sort((a, b) =>
      sort === "multiple" ? (multipleOf(b) ?? -1) - (multipleOf(a) ?? -1) : sort === "plays" ? b.plays - a.plays : +new Date(b.posted_at) - +new Date(a.posted_at),
    );
  }, [items, cat, region, sort]);

  const hot = [...repeats.entries()].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size);

  return (
    <Panel className="mb-6 p-5">
      <SectionTitle
        title="바이럴 레퍼런스"
        desc="최근 터진 영상을 평소 대비 배수 순으로 보여줘요. 같은 형식이 여러 계정에서 반복되는지도 함께 표시해요."
        right={
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setDays(p)} className={clsx("rounded px-3 py-1 text-[13px] font-semibold", days === p ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-900")}>
                최근 {p}일
              </button>
            ))}
          </div>
        }
      />
      {sample && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-700">지금 보이는 영상은 화면 확인용 샘플이에요. 데이터 연결 후 실제 영상으로 바뀌어요.</p>}

      {hot.length > 0 && (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
          <p className="mb-1.5 text-[13px] font-bold text-violet-700">여러 계정에서 반복해서 터지는 형식</p>
          <div className="flex flex-wrap gap-2">
            {hot.map(([k, s]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[13px] font-semibold text-violet-700 ring-1 ring-violet-200">
                <Repeat size={13} /> {k}: {s.size}개 계정
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill active={cat === "전체"} onClick={() => setCat("전체")}>전체 분류</Pill>
        {CATEGORIES.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}
        <span className="mx-1 h-4 w-px bg-gray-200" />
        {(["전체", "국내", "해외"] as const).map((r) => <Pill key={r} active={region === r} onClick={() => setRegion(r)}>{r === "전체" ? "국내+해외" : r}</Pill>)}
        <select className="ml-auto h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="multiple">배수 높은 순</option>
          <option value="plays">조회수 높은 순</option>
          <option value="recent">최신순</option>
        </select>
      </div>

      {failed && <p className="p-6 text-center text-sm text-red-500">레퍼런스를 불러오지 못했어요.</p>}
      {!failed && items === null && <p className="p-6 text-center text-sm text-gray-400">불러오는 중…</p>}
      {items && shown.length === 0 && <p className="p-6 text-center text-sm text-gray-400">조건에 맞는 영상이 없어요.</p>}

      <div className="space-y-3">
        {shown.map((r) => {
          const mult = multipleOf(r);
          const n = r.format_key ? repeats.get(r.format_key)?.size ?? 0 : 0;
          return (
            <article key={r.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="blue">{r.category}</Chip>
                <Chip>{r.region}</Chip>
                {r.is_ad === true && <Chip tone="amber">광고</Chip>}
                {r.is_ad === null && <Chip>광고 여부 미확인</Chip>}
                {n >= 2 && <Chip tone="green">같은 형식 {n}개 계정에서 반복</Chip>}
                <a href={r.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 hover:underline">
                  영상 보기 <ExternalLink size={13} />
                </a>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="text-sm font-bold">@{r.username}</span>
                <span className="text-[13px] text-gray-500">팔로워 {r.followers != null ? compact(r.followers) : "-"}</span>
                <span className="text-[13px] text-gray-500">{fmtDate(r.posted_at)} 게시, {r.duration_s}초</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="text-xl font-bold text-blue-600">{mult != null ? `${mult >= 10 ? Math.round(mult) : mult.toFixed(1)}배` : "배수 -"}</span>
                <span className="text-[13px] text-gray-600">조회수 <b>{compact(r.plays)}</b>, 평소 {r.usual_plays != null ? compact(r.usual_plays) : "-"}</span>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-[84px_1fr]">
                <dt className="text-[13px] font-semibold text-gray-500">첫 3초</dt><dd className="font-medium">{r.hook_3s || "-"}</dd>
                <dt className="text-[13px] font-semibold text-gray-500">내용 전개</dt><dd>{r.flow || "-"}</dd>
                <dt className="text-[13px] font-semibold text-gray-500">CTA</dt><dd>{r.cta || "없음"}</dd>
                <dt className="text-[13px] font-semibold text-gray-500">추천 이유</dt><dd className="text-gray-700">{r.reason || "-"}</dd>
              </dl>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
