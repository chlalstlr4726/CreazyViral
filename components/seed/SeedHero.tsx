"use client";

import { useEffect, useRef, useState } from "react";
import type { Phase } from "./worldTree";
import { SEED_ART } from "./ascii";

const STAGES: { key: Phase[]; label: string }[] = [
  { key: ["seed"], label: "씨앗" },
  { key: ["sprout"], label: "새싹" },
  { key: ["sapling"], label: "작은 나무" },
  { key: ["bloom", "done"], label: "매화" },
];

/** 첫 화면: 3D 아스키 세계수(아래 층) + 왼쪽 아래 평면 소개 카드(위 층). 페이지를 열고 1초 뒤 저절로 자란다. */
export function SeedHero({ onExplain, onGrown }: { onExplain: () => void; onGrown: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("seed");
  const [fallback, setFallback] = useState(false);

  const cardBox = () => {
    const c = intro.current, st = stage.current;
    if (!c || !st) return null;
    const a = c.getBoundingClientRect(), b = st.getBoundingClientRect();
    return { right: (a.right - b.left + 16) / Math.max(1, b.width), bottom: (a.bottom - b.top + 14) / Math.max(1, b.height) };
  };
  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const jump = Number(new URLSearchParams(window.location.search).get("seedT")); // 확인용: ?seedT=12 이면 그 시각부터
    import("./worldTree")
      .then(({ startWorldTree }) =>
        startWorldTree(stage.current!, { reduced, delayMs: 1000, bg: [0.976, 0.98, 0.984], onPhase: (p) => alive && setPhase(p), onLayout: (g) => hero.current?.style.setProperty("--seed-ground", g.toFixed(4)), baseX: 0.66,
          // 카드가 장면 폭 대부분을 덮는 좁은 화면(휴대폰)에서는 나무를 카드 아래까지만, 넓은 화면에서는 카드 오른쪽에 둔다
          topLimit: () => { const r = cardBox(); return r && r.right > 0.7 ? r.bottom : 0.04; },
          cardRight: () => { const r = cardBox(); return r && r.right <= 0.7 ? r.right : 0; }, jumpT: Number.isFinite(jump) && jump > 0 ? jump : undefined }),
      )
      .then((h) => (alive ? (dispose = h.dispose) : h.dispose()))
      .catch(() => alive && setFallback(true));
    return () => {
      alive = false;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    if (phase === "bloom" || phase === "done") onGrown();
  }, [phase, onGrown]);

  const on = STAGES.findIndex((s) => s.key.includes(phase));
  return (
    <section ref={hero} className="seed-hero" aria-label="씨앗이 매화나무로 자라는 장면">
      <div ref={stage} className="seed-stage">
        {fallback && <pre className="seed-fallback" aria-hidden="true">{SEED_ART}</pre>}
      </div>
      <div ref={intro} className="seed-intro">
        <p className="seed-lead">AI는 아이디어를 주지 않는다. 아이디어 씨앗만 건넨다.</p>
        <p>내 감과 판단력은 AI에게 맡기지 않는다.</p>
        <p>요즘 가장 많이 공유된 릴스 100편을 직접 넘겨 보며, 무엇이 재밌고 쓸모 있는지 내 기준을 키우자.</p>
        <div className="seed-intro-row">
          <button type="button" className="seed-explain" onClick={onExplain}>설명 보기</button>
          <ol className="seed-stages" aria-label="자라는 단계">
            {STAGES.map((s, i) => (
              <li key={s.label} className={i <= on ? "on" : ""} aria-current={i === on ? "step" : undefined}>{s.label}</li>
            ))}
          </ol>
        </div>
      </div>
      <p className={"seed-down" + (on === 3 ? " show" : "")}>↓ 땅속으로 내려가면 오늘의 릴스가 있어요</p>
    </section>
  );
}
