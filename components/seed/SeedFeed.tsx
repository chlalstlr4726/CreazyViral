"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/lib/feed";
import { compact } from "@/lib/format";
import { FeedMedia } from "./FeedMedia";
import { createRootLayer } from "./rootLayer";

const ACC: Record<string, string> = { "빡": "amber", "칼티": "blue", "무디": "violet", "크리에이지 공식": "green" };
const firstSentence = (s: string) => {
  const line = s.split("\n")[0] || "";
  const m = line.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : line).trim();
};
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
/** 화면 위에 붙은 반투명 머리줄 높이(px, Shell의 --app-header-h). 그 아래만 실제로 보이는 칸이다. */
const headerPx = () => {
  const root = document.documentElement, v = getComputedStyle(root).getPropertyValue("--app-header-h").trim();
  const n = parseFloat(v) || 0;
  return v.endsWith("rem") ? n * (parseFloat(getComputedStyle(root).fontSize) || 16) : n;
};

/** 땅속 구역: 화면에 고정된 뿌리 층 위로, 릴스가 인스타처럼 한 편씩 화면 가득 넘어간다. */
export function SeedFeed({ items, grown, capture = false }: { items: FeedItem[]; grown: boolean; capture?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const layer = useRef<ReturnType<typeof createRootLayer> | null>(null);
  // 지금 편: 화면에 60% 넘게 들어온 릴스. 처음엔 없음(-1)이라, 씨앗 그림을 보는 동안 첫 영상이 보이지 않는 채로 재생되지 않는다.
  const [active, setActive] = useState(-1);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const c = cv.current!, w = wrap.current!;
    const L = createRootLayer(c, { stem: "#8b7b6b", root: "#94a3b8", speck: "#a8a29e", text: "#1f2937" });
    layer.current = L;
    const place = () => {
      const stem = w.querySelector<HTMLElement>(".seed-stem");
      const r = stem?.getBoundingClientRect(), wr = c.getBoundingClientRect();
      L.layout(r && r.width > 0 ? r.left + r.width / 2 - wr.left : 14);
    };
    place();
    let t = 0;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(place, 150); });
    ro.observe(c);
    return () => { ro.disconnect(); L.dispose(); };
  }, []);

  useEffect(() => { if (grown) layer.current?.grow(); }, [grown]);

  useEffect(() => {
    const w = wrap.current!;
    // 머리줄에 가린 부분은 빼고, 보이는 칸에 60% 넘게 들어온 편이 지금 편이다.
    // 빨리 넘기면 들어오는 편과 나가는 편이 한 번에 보고되므로, 비율이 0.6 이상인 편만 고른다(나가는 편으로 되돌아가지 않게).
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.intersectionRatio >= 0.6) setActive(Number((e.target as HTMLElement).dataset.i)); }),
      { threshold: 0.6, rootMargin: `${-headerPx()}px 0px 0px 0px` },
    );
    w.querySelectorAll(".seed-reel").forEach((el) => io.observe(el));
    // 땅속 구역이 화면에 조금이라도 들어오면 뿌리를 키운다. 구역이 릴스 수만큼 길어서(100편이면 화면의 약 100배)
    // 비율 기준(예전 0.02)은 50편이 넘으면 닿을 수 없어 뿌리가 영영 자라지 않았다. 그래서 0(닿기만 하면)으로 본다.
    const io2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) layer.current?.grow(); }, { threshold: 0 });
    io2.observe(w);
    return () => { io.disconnect(); io2.disconnect(); };
  }, [items]);

  // 키보드로 한 편씩 넘기기: 아래·위 화살표, PageDown·PageUp을 누르면 다음·이전 릴스로 가서 머리줄 바로 아래에 멈춘다.
  // (브라우저 기본은 40px쯤만 내려가고 '가까우면 멈춤' 칸 맞춤이 같은 편으로 되돌려, 키로는 넘어가지 않았다)
  // 입력 칸에서는 건드리지 않는다. 첫 편보다 위(씨앗 그림)에서는 첫 편이 한 화면 안에 보일 때만 첫 편으로 데려간다.
  useEffect(() => {
    if (capture) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const down = e.key === "ArrowDown" || e.key === "PageDown";
      const up = e.key === "ArrowUp" || e.key === "PageUp";
      if (!down && !up) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const w = wrap.current;
      if (!w) return;
      const reels = [...w.querySelectorAll<HTMLElement>(".seed-reel")];
      if (!reels.length) return;
      const h = headerPx();
      const view = window.innerHeight - h;
      const tops = reels.map((r) => r.getBoundingClientRect().top - h); // 머리줄 아래 가장자리 기준
      let cur = 0;
      tops.forEach((d, i) => { if (Math.abs(d) < Math.abs(tops[cur])) cur = i; });
      let target: number;
      if (Math.abs(tops[cur]) > view / 2) {
        // 릴스 칸 밖: 씨앗 그림에서 아래로 갈 때 첫 편이 가까우면 첫 편으로, 아니면 브라우저 기본 스크롤
        if (down && tops[0] > 0 && tops[0] < view * 1.1) target = 0;
        else return;
      } else target = down ? cur + 1 : cur - 1;
      if (target < 0 || target >= reels.length) return; // 첫 편에서 위로, 마지막 편에서 아래로는 기본 스크롤
      e.preventDefault();
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: window.scrollY + tops[target], behavior: calm ? "auto" : "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture]);

  useEffect(() => {
    const it = items[Math.max(active, 0)]; // 첫 편이 들어오기 전에도 첫 편의 훅 글씨는 미리 보인다(예전과 같음)
    if (it && !capture) layer.current?.show(firstSentence(it.hookStructure));
  }, [active, items, capture]);

  return (
    <div ref={wrap} className="seed-under">
      <div className="seed-rootlayer" aria-hidden="true"><canvas ref={cv} /></div>
      {items.map((it, i) => (
        <section key={it.shortcode} className="seed-reel" data-i={i} aria-label={`${i + 1}번째 릴스, @${it.username}`}>
          {capture && <p className="seed-hook-still">{firstSentence(it.hookStructure)}</p>}
          <div className="seed-reel-grid">
            <div className="seed-video">
              {capture ? <div className="seed-video-ph seed-video-label">릴스 영상 자리 · @{it.username}</div> : Math.abs(i - active) <= 1 ? <FeedMedia item={it} active={i === active} muted={muted} /> : <div className="seed-video-ph" />}
              {!capture && it.videoUrl && i === active && (
                <button type="button" className="seed-sound press" onClick={() => setMuted((m) => !m)}>{muted ? "소리 켜기" : "소리 끄기"}</button>
              )}
            </div>
            <div className="seed-stem" aria-hidden="true" />
            <article className="seed-card">
              <header className="seed-card-head">
                <span className="seed-rank num">#{it.rank ?? i + 1}</span>
                <strong className="seed-user">@{it.username}</strong>
                <span className={"seed-chip " + (it.source === "foreign" ? "gray" : "blue")}>{it.source === "foreign" ? "해외" : "국내"}</span>
                <a className="seed-insta press" href={it.url} target="_blank" rel="noreferrer">인스타에서 보기 ↗</a>
              </header>
              <dl className="seed-stats">
                {([["조회", it.plays], ["좋아요", it.likes], ["댓글", it.comments], ...(it.shares != null ? [["공유", it.shares]] : [])] as [string, number | null][]).map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd className="num">{v == null ? "–" : compact(v)}</dd></div>
                ))}
              </dl>
              <dl className="seed-spec">
                <div><dt>편집 방법</dt><dd><ul>{lines(it.editMethod).map((l) => <li key={l}>{l}</li>)}</ul></dd></div>
                <div><dt>훅 구조</dt><dd><ul>{lines(it.hookStructure).map((l) => <li key={l}>{l}</li>)}</ul></dd></div>
              </dl>
              <section className="seed-ideas">
                <h4>아이디어 씨앗 {it.ideas.length} · 어느 계정에 맞나</h4>
                <table>
                  <tbody>
                    {it.ideas.map((d, k) => (
                      <tr key={k}>
                        <th scope="row">{d.account ? <span className={"seed-chip " + (ACC[d.account] || "gray")}>{d.account}</span> : "–"}</th>
                        <td>{d.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {it.caption && <p className="seed-cap">캡션: {it.caption.slice(0, 140)}{it.caption.length > 140 ? "…" : ""}</p>}
            </article>
          </div>
          <p className="seed-next">{i < items.length - 1 ? `↓ 다음 릴스 (${i + 2}/${items.length})` : `여기까지 오늘의 ${items.length}편이에요`}</p>
        </section>
      ))}
    </div>
  );
}
