"use client";

import { ReadableText } from "./ReadableText";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Chip, Panel } from "./ui";
import { spring } from "@/lib/motion";
import { SERIES_CRITERIA, type SeriesRun } from "@/lib/seriesTypes";
import type { SERIES_EXAMPLE } from "@/lib/seriesExample";

/** 접었다 펴는 칸(<details>). 펼칠 때와 같은 길(높이·흐림, 같은 스프링)로 접힌다. 접히는 움직임이 끝날 때까지 <details>를 열어 둔다. */
function Fold({ className, label, children }: { className?: string; label: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  return (
    <details className={className} open={open || held}>
      <summary
        className="press origin-left cursor-pointer text-sm font-bold"
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

function Episodes({ episodes }: { episodes: SeriesRun["recommendations"][number]["episodes"] }) {
  return (
    <Fold className="series-episodes mt-4 rounded-lg bg-gray-50 p-3" label="에피소드 3편과 첫 3초 훅">
      <ol className="mt-3 space-y-3 text-sm">
        {episodes.map((episode, index) => <li key={index}>
          <h4 className="font-semibold">{index + 1}화 · {episode.title}</h4>
          <p className="text-blue-700">{episode.hook}</p><p><ReadableText text={episode.storyboard} /></p>
          <p className="text-gray-500">다음 편 예고 · {episode.nextEpisode}</p>
        </li>)}
      </ol>
    </Fold>
  );
}

const statusText: Record<string, string> = {
  loading: "불러오는 중…",
  error: "추천을 불러오지 못했어요.",
  unconfigured: "추천 데이터를 연결하면 여기에 표시돼요.",
  empty: "아직 생성된 추천이 없어요.",
  unavailable: "추천 저장소 설정을 확인해 주세요.",
};

export function SeriesDashboard() {
  const [run, setRun] = useState<SeriesRun | null>(null);
  const [state, setState] = useState("loading");
  const [example, setExample] = useState<typeof SERIES_EXAMPLE | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/series", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw Error("series_unavailable");
        return response.json();
      })
      .then((data) => {
        setRun(data.run);
        setState(data.state);
        setExample(data.example ?? null);
      })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, []);

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">신규 채널 추천</h1>
      <p className="mb-6 mt-1.5 text-gray-500">반응이 좋았던 릴스 형식을 바탕으로 독립 계정에서 연재할 시리즈를 추천해요.</p>
      <Panel className="series-criteria mb-4 p-5">
        <h2 className="font-bold">선정 기준</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SERIES_CRITERIA.map(({ key, label, weight }) => <li key={key}><Chip>{label} {weight}%</Chip></li>)}
        </ul>
        {run && <p className="mt-3 text-sm text-gray-500">후보 {run.candidateCount}개 중 {run.recommendations.length}개 선정 · {new Date(run.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
        {!run && <p role="status" className="mt-3 text-sm text-gray-500">{statusText[state]}</p>}
      </Panel>
      {example && (
        <Panel className="mb-4 p-5">
          <Chip tone="amber">가상 계정 예시</Chip>
          <h2 className="mt-2 text-xl font-bold">{example.name}</h2>
          <p className="mt-1 text-gray-700">{example.concept}</p>
          <dl className="series-facts text-sm">
            <div><dt className="inline font-bold">시청 대상 </dt><dd className="inline">{example.audience}</dd></div>
            <div><dt className="inline font-bold">반복 포맷 </dt><dd className="inline">{example.recurringFormat}</dd></div>
          </dl>
          <Episodes episodes={example.episodes} />
        </Panel>
      )}
      <div className="series-list">
        {run?.recommendations.map((idea, index) => (
          <Panel key={idea.name} className="series-card">
            <div className="series-heading">
              <h2 className="font-bold">{idea.name}</h2>
              <Chip tone="blue">추천 {index + 1}</Chip>
            </div>
            <p className="mt-1 text-gray-700">{idea.concept}</p>
            <dl className="series-facts text-sm">
              <div><dt className="inline font-bold">시청 대상 </dt><dd className="inline">{idea.audience}</dd></div>
              <div><dt className="inline font-bold">반복 포맷 </dt><dd className="inline">{idea.recurringFormat}</dd></div>
              <div className="series-reason"><dt className="font-bold">선정 이유 </dt><dd><ReadableText text={idea.rationale} /></dd></div>
            </dl>
            <Fold className="mt-4 rounded-lg bg-gray-50 p-3" label="추천 점수 보기">
              <p className="mt-3 text-sm"><span className="series-score">종합 {idea.total}점</span></p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {SERIES_CRITERIA.map(({ key, label }) => <li key={key}><Chip>{label} {idea.scores[key]}점</Chip></li>)}
              </ul>
            </Fold>
            <h3 className="mt-4 text-sm font-bold">근거 릴스</h3>
            <ul className="series-evidence mt-1 text-sm">
              {idea.evidence.map((reel) => <li key={reel.url}>
                <a href={reel.url} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">@{reel.username}</a>
                <span className="text-gray-600"> · 조회 {reel.plays.toLocaleString("ko-KR")}{reel.multiple == null ? "" : ` · 평소 대비 ${reel.multiple.toFixed(1)}배`}</span>
              </li>)}
            </ul>
            <Episodes episodes={idea.episodes} />
          </Panel>
        ))}
      </div>
    </section>
  );
}
