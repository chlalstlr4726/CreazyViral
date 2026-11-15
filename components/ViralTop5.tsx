"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import clsx from "clsx";
import type { ViralReel } from "@/lib/viral";
import { compact } from "@/lib/format";
import { Chip, Panel, SectionTitle } from "./ui";

export type Days = 3 | 7 | 14;
const PERIODS: Days[] = [3, 7, 14];

const fmtDate = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};
const fmtX = (x: number) => `${x >= 100 ? Math.round(x).toLocaleString() : x.toFixed(1)}배`;

export function ViralTop5({ days, onDays }: { days: Days; onDays: (d: Days) => void }) {
  const [items, setItems] = useState<ViralReel[] | null>(null);
  const [source, setSource] = useState<"daily_recs" | "supabase" | "sample">("sample");
  const [recDate, setRecDate] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setItems(null);
    setFailed(false);
    fetch(`/api/viral/top?days=${days}&limit=5`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { items?: ViralReel[]; source?: "daily_recs" | "supabase" | "sample"; recDate?: string | null }) => {
        setItems(d.items ?? []);
        setSource(d.source ?? "sample");
        setRecDate(d.recDate ?? null);
      })
      .catch(() => setFailed(true));
  }, [days]);

  return (
    <Panel className="mb-6 p-5">
      <SectionTitle
        title={source === "daily_recs" ? `최신 승인 추천 Top 5${recDate ? ` (${recDate} 추천)` : ""}` : "최근 바이럴 Top 5"}
        right={source === "daily_recs" ? undefined : (
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => onDays(p)} className={clsx("rounded px-3 py-1 text-[13px] font-semibold", days === p ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-900")}>
                최근 {p}일
              </button>
            ))}
          </div>
        )}
      />
      <div className="mb-3 text-[12px] leading-relaxed text-gray-400">
        <div className="font-semibold text-gray-500">Top 5 기준</div>
        {source === "daily_recs" ? (
          <div>* 매일 추천(Supabase daily_recs)에서 가져옵니다. 처음 보는 계정의 터진 릴스 중 회사 기준(평소 조회수 3배 이상, 6개월 안, 광고·방송·유명인 제외)과 AI 1차 거르기를 통과하고 담당자가 직접 승인한 편을 반응 점수 순으로 보여 줍니다{recDate ? ` (${recDate} 추천)` : ""}. 아래 AI 스토리보드도 이 영상들을 기준으로 만듭니다.</div>
        ) : (
          <div>* Supabase reels 데이터에서 가져옵니다. 분석 결과가 "터짐"인 영상 중 최근 3, 7, 14일 조회수 상위 5개를 가져옵니다. 아래 AI 스토리보드도 이 영상들을 기준으로 만들고 있습니다.</div>
        )}
      </div>
      {items && source === "sample" && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-700">수집 DB에 연결되지 않아 코드에 들어 있는 수집 샘플로 보여주고 있어요.</p>}
      {failed && <p className="p-6 text-center text-sm text-red-500">영상 목록을 불러오지 못했어요.</p>}
      {!failed && items === null && <p className="p-6 text-center text-sm text-gray-400">불러오는 중…</p>}
      {items && items.length === 0 && <p className="p-6 text-center text-sm text-gray-400">이 기간에 수집된 바이럴 영상이 없어요.</p>}

      <ol className="space-y-2.5">
        {(items ?? []).map((v, i) => (
          <li key={v.id} className="flex gap-4 rounded-xl border border-gray-200 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-base font-bold text-blue-600">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-bold">@{v.user}</span>
                {v.followers != null && <span className="text-[13px] text-gray-500">팔로워 {compact(v.followers)}</span>}
                <span className="text-[13px] text-gray-500">{fmtDate(v.at)} 게시, {v.sec}초</span>
                {v.kw && <Chip>{v.kw}</Chip>}
                {v.aiMade === "예" && <Chip>AI로 만듦</Chip>}
                {v.paid && <Chip tone="amber">광고</Chip>}
                <a href={v.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 hover:underline">
                  영상 보기 <ExternalLink size={13} />
                </a>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="text-lg font-bold text-blue-600">조회수 {compact(v.plays)}</span>
                {v.multiple != null && <span className="text-[13px] text-gray-600">평소 대비 {fmtX(v.multiple)}</span>}
                {v.reach_x != null && <span className="text-[13px] text-gray-600">팔로워 대비 {fmtX(v.reach_x)}</span>}
                <span className="text-[13px] text-gray-500">좋아요 {compact(v.likes)}, 댓글 {compact(v.comments)}, 공유 {compact(v.shares)}</span>
              </div>
              {v.reason ? (
                <p className="mt-1.5 text-sm text-gray-700"><span className="font-semibold text-gray-900">추천 이유</span> {v.reason}</p>
              ) : (
                v.caption && <p className="mt-1.5 line-clamp-2 text-sm text-gray-700">{v.caption}</p>
              )}
              {v.caution && <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[13px] text-amber-700">주의: {v.caution}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
