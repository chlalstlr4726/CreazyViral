"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { ACCOUNT_BY_ID, type AccountId } from "@/lib/accounts";
import { dailySeries, formatStats, kpis, MIN_N_FOR_FORMAT } from "@/lib/analytics";
import { addDays, compact, mult, shortDate, ymd } from "@/lib/format";
import { Chip, Panel, SectionTitle, TypeBadge } from "./ui";

const PERIODS = [7, 30, 90] as const;

export function PerformanceSection({ accountId }: { accountId?: string } = {}) {
  const { posts, postSource, lastCaptured } = useStore();
  const [accState, setAcc] = useState<string>("all");
  const acc = accountId ?? accState;
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [showAll, setShowAll] = useState(false);

  const scoped = useMemo(() => posts.filter((p) => acc === "all" || p.account_id === acc), [posts, acc]);

  const { cur, prev, series } = useMemo(() => {
    const now = Date.now();
    const ms = period * 86400_000;
    const cur = scoped.filter((p) => now - +new Date(p.posted_at) <= ms);
    const prev = scoped.filter((p) => {
      const age = now - +new Date(p.posted_at);
      return age > ms && age <= 2 * ms;
    });
    const dates = Array.from({ length: period }, (_, i) => ymd(addDays(new Date(), -(period - 1 - i))));
    return { cur, prev, series: dailySeries(cur, dates) };
  }, [scoped, period]);

  const kpiList = useMemo(() => kpis(cur, prev), [cur, prev]);
  const formats = useMemo(
    () => formatStats(scoped.filter((p) => Date.now() - +new Date(p.posted_at) <= 90 * 86400_000)),
    [scoped],
  );
  const maxMult = Math.max(2.5, ...formats.map((f) => f.medianMultiple));
  const accOf = (id: string) => ACCOUNT_BY_ID[id as AccountId];
  const rows = showAll ? cur : cur.slice(0, 10);

  if (scoped.length === 0) {
    const connected = acc !== "all" && postSource(acc as never) === "instagram";
    return (
      <div className="mt-14">
        <SectionTitle
          title="지금까지 올린 콘텐츠와 성과"
          desc="연결된 인스타 계정의 게시물을 모아 보여줘요. 성과는 ‘같은 계정의 평소 조회수’와 비교한 값이에요."
        />
        <Panel className="p-8 text-center">
          <p className="text-lg font-bold">아직 데이터 없음</p>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            {connected ? "연결된 계정에 아직 수집된 게시물이 없어요. 성과가 모이면 표와 그래프가 나타나요." : "인스타 계정을 연결하면 게시물 성과가 여기에 모여요."}
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mt-14">
      <SectionTitle
        title="지금까지 올린 콘텐츠와 성과"
        desc="연결된 인스타 계정의 게시물을 모아 보여줘요. 성과는 ‘같은 계정의 평소 조회수’와 비교한 값이에요."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {accountId && (
          <span className={clsx("rounded-md px-2.5 py-1 text-[0.8125rem] font-semibold", postSource(accountId as never) === "instagram" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            {postSource(accountId as never) === "instagram"
              ? `인스타 공식 API 실제 데이터${lastCaptured ? `, 마지막 수집 ${new Date(lastCaptured).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}`
              : "계정 연결 전 (데이터 없음)"}
          </span>
        )}
        <div className="ml-auto inline-flex rounded-md border border-gray-200 bg-white p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                "press rounded px-3 py-1.5 text-[0.8125rem] font-semibold",
                period === p ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {p}일
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpiList.map((k) => {
          const delta = k.kind === "multiple" ? k.value - k.prev : k.prev > 0 ? (k.value - k.prev) / k.prev : 0;
          const up = delta >= 0;
          return (
            <Panel key={k.label} className="p-5">
              <div className="text-[0.8125rem] text-gray-500">{k.label}</div>
              <div className="num mt-2 text-[1.75rem] font-bold tracking-tight">
                {k.kind === "multiple" ? mult(k.value) : compact(k.value)}
              </div>
              <div className={clsx("mt-1 flex items-center gap-0.5 text-xs font-semibold", up ? "text-emerald-600" : "text-red-500")}>
                {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {k.kind === "multiple" ? `${up ? "+" : ""}${delta.toFixed(1)}x` : `${Math.abs(Math.round(delta * 100))}%`}
                <span className="ml-1 font-normal text-gray-500">직전 {period}일 대비</span>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Panel className="p-6 lg:col-span-3">
          <div className="mb-1 font-bold">일별 조회수</div>
          <p className="mb-4 text-[0.8125rem] text-gray-500">게시일 기준으로 합산한 조회수예요.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(period / 7) - 1)}
                />
                <YAxis tickFormatter={(v) => compact(Number(v))} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [Number(v).toLocaleString(), "조회수"]}
                  labelFormatter={(l) => String(l)}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: "0.75rem" }}
                />
                <Area type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={2} fill="url(#v)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="font-bold">포맷별 성과</div>
            <Chip>최근 90일</Chip>
          </div>
          <p className="mt-1 mb-5 text-[0.8125rem] text-gray-500">카드로 만든 게시물이 계정 평균의 몇 배였는지 보여줘요 (중앙값).</p>

          {formats.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">카드와 연결된 게시물이 아직 없어요</p>
          ) : (
            <ul className="space-y-3.5">
              {formats.map((f) => (
                <li key={f.format}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className={clsx("font-medium", f.lowN && "text-gray-500")}>{f.format}</span>
                    <span className="num">
                      <b className={clsx(f.medianMultiple >= 1 ? "text-gray-900" : "text-gray-500", f.lowN && "text-gray-500")}>
                        {mult(f.medianMultiple)}
                      </b>
                      <span className="ml-1.5 text-xs text-gray-500">n={f.n}</span>
                      {f.lowN && <span className="ml-1.5 text-[0.6875rem] text-amber-600">참고용</span>}
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-gray-100">
                    <div
                      className={clsx("h-full rounded-full", f.lowN ? "bg-blue-200" : f.medianMultiple >= 1 ? "bg-blue-500" : "bg-gray-400")}
                      style={{ width: `${Math.min(100, (f.medianMultiple / maxMult) * 100)}%` }}
                    />
                    <div className="absolute -top-1 h-4.5 w-px bg-gray-900/50" style={{ left: `${(1 / maxMult) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 flex gap-1.5 text-xs leading-relaxed text-gray-500">
            <Info size={13} className="mt-0.5 shrink-0" />세로선은 1.0x(평소 수준). 게시물이 {MIN_N_FOR_FORMAT}개 미만인 포맷은 우연일 수 있어 ‘참고용’으로 표시해요.
          </p>
        </Panel>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="font-bold">게시물별 성과</div>
          <span className="text-[0.8125rem] text-gray-500">{cur.length}개, 최근 {period}일</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-y border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-6 py-2.5 font-medium">게시물</th>
                <th className="py-2.5 font-medium">포맷</th>
                <th className="w-28 py-2.5 text-right font-medium">조회수</th>
                <th className="w-20 py-2.5 text-right font-medium">성과</th>
                <th className="w-20 py-2.5 text-right font-medium">좋아요</th>
                <th className="w-20 py-2.5 text-right font-medium">댓글</th>
                <th className="w-20 py-2.5 text-right font-medium">공유</th>
                <th className="w-20 py-2.5 pl-0 pr-6 text-right font-medium box-content">저장</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const a = accOf(p.account_id);
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-[0.6875rem] font-bold text-white" style={{ background: a.color }}>
                          {shortDate(ymd(new Date(p.posted_at)))}
                        </div>
                        <div className="min-w-0">
                          <a href={p.url} target="_blank" rel="noreferrer" className="block max-w-[320px] truncate font-medium hover:text-blue-600">
                            {p.caption}
                          </a>
                          <div className="text-xs text-gray-500">@{a.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.format && p.type ? (
                        <div className="flex flex-col items-start gap-1">
                          <TypeBadge type={p.type} />
                          <span className="text-xs text-gray-500">{p.format}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">카드 미연결</span>
                      )}
                    </td>
                    <td className="num py-3 text-right font-medium">
                      {p.metrics.views.toLocaleString()}
                      {p.checkpoints && Object.keys(p.checkpoints).length > 0 && (
                        <div className="text-[0.6875rem] font-normal text-gray-500">
                          {(["24h", "72h", "7d"] as const).filter((k) => p.checkpoints![k] != null).map((k) => `${k === "24h" ? "24시간" : k === "72h" ? "72시간" : "7일"} ${p.checkpoints![k]!.toLocaleString()}`).join(" / ")}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={clsx(
                          "num inline-block rounded-md px-2 py-0.5 text-xs font-bold",
                          p.multiple >= 1.5 ? "bg-blue-500 text-white" : p.multiple >= 1 ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500",
                        )}
                      >
                        {mult(p.multiple)}
                      </span>
                    </td>
                    <td className="num py-3 text-right text-gray-600">{p.metrics.likes.toLocaleString()}</td>
                    <td className="num py-3 text-right text-gray-600">{p.metrics.comments.toLocaleString()}</td>
                    <td className="num py-3 text-right text-gray-600">{p.metrics.shares.toLocaleString()}</td>
                    <td className="num py-3 pl-0 pr-6 text-right text-gray-600">{p.metrics.saves.toLocaleString()}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-gray-500">
                    이 기간에 올린 게시물이 없어요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {cur.length > 10 && (
          <button onClick={() => setShowAll((v) => !v)} className="press w-full border-t border-gray-100 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50">
            {showAll ? "접기" : `전체 ${cur.length}개 보기`}
          </button>
        )}
      </Panel>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "press inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium",
        active ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
      )}
    >
      {children}
    </button>
  );
}
