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

/** 땅속 구역: 화면에 고정된 뿌리 층 위로, 릴스가 인스타처럼 한 편씩 화면 가득 넘어간다. */
export function SeedFeed({ items, grown, capture = false }: { items: FeedItem[]; grown: boolean; capture?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const layer = useRef<ReturnType<typeof createRootLayer> | null>(null);
  const [active, setActive] = useState(0);
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
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i)); }), { threshold: 0.6 });
    w.querySelectorAll(".seed-reel").forEach((el) => io.observe(el));
    const io2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) layer.current?.grow(); }, { threshold: 0.02 });
    io2.observe(w);
    return () => { io.disconnect(); io2.disconnect(); };
  }, [items]);

  useEffect(() => {
    const it = items[active];
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
                <button type="button" className="seed-sound" onClick={() => setMuted((m) => !m)}>{muted ? "소리 켜기" : "소리 끄기"}</button>
              )}
            </div>
            <div className="seed-stem" aria-hidden="true" />
            <article className="seed-card">
              <header className="seed-card-head">
                <span className="seed-rank num">#{it.rank ?? i + 1}</span>
                <strong className="seed-user">@{it.username}</strong>
                <span className={"seed-chip " + (it.source === "foreign" ? "gray" : "blue")}>{it.source === "foreign" ? "해외" : "국내"}</span>
                <a className="seed-insta" href={it.url} target="_blank" rel="noreferrer">인스타에서 보기 ↗</a>
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
