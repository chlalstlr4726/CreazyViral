"use client";

import { useEffect, useRef, useState } from "react";
import type { Phase } from "./worldTree";
import type { SeedSettings } from "./settings";
import { SEED_ART } from "./ascii";

const STAGES: { key: Phase[]; label: string }[] = [
  { key: ["seed"], label: "씨앗" },
  { key: ["sprout"], label: "새싹" },
  { key: ["sapling"], label: "작은 나무" },
  { key: ["bloom", "done"], label: "매화" },
];
type Card = SeedSettings["card"];

/**
 * 첫 화면: 3D 아스키 매화나무(아래 층) + 제목 바로 아래 평면 소개 카드(위 층). 페이지를 열고 1초 뒤 저절로 자란다.
 * 편집 모드에서는 카드를 손잡이로 끌어 옮기고, 카드 글을 눌러 바로 고칠 수 있다.
 */
export function SeedHero({ capture = false, settings, editing, onCard, onExplain, onGrown }: {
  capture?: boolean;
  settings: SeedSettings;
  editing: boolean;
  onCard: (patch: Partial<Card>) => void;
  onExplain: () => void;
  onGrown: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const tree = useRef<{ apply: (s: SeedSettings) => void } | null>(null);
  const first = useRef(settings);
  const [phase, setPhase] = useState<Phase>("seed");
  const [fallback, setFallback] = useState(false);

  const cardBox = () => {
    const c = intro.current, st = stage.current;
    if (!c || !st) return null;
    const a = c.getBoundingClientRect(), b = st.getBoundingClientRect();
    return { right: (a.right - b.left + 16) / Math.max(1, b.width), bottom: (a.bottom - b.top + 14) / Math.max(1, b.height) };
  };

  useEffect(() => {
    if (capture) return; // 피그마로 옮길 때는 3D 나무를 그리지 않는다
    let alive = true;
    let dispose: (() => void) | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const jump = Number(new URLSearchParams(window.location.search).get("seedT")); // 확인용: ?seedT=12 이면 그 시각부터
    import("./worldTree")
      .then(({ startWorldTree }) =>
        startWorldTree(stage.current!, {
          reduced, delayMs: 1000, bg: [0.976, 0.98, 0.984], settings: first.current,
          onPhase: (p) => alive && setPhase(p),
          onLayout: (g) => hero.current?.style.setProperty("--seed-ground", g.toFixed(4)),
          // 카드가 장면 폭 대부분을 덮는 좁은 화면(휴대폰)에서는 나무를 카드 아래까지만, 넓은 화면에서는 카드 오른쪽에 둔다
          topLimit: () => { const r = cardBox(); return r && r.right > 0.7 ? r.bottom : 0; },
          cardRight: () => { const r = cardBox(); return r && r.right <= 0.7 ? r.right : 0; },
          jumpT: Number.isFinite(jump) && jump > 0 ? jump : undefined,
        }),
      )
      .then((h) => { if (alive) { dispose = h.dispose; tree.current = h; } else h.dispose(); })
      .catch(() => alive && setFallback(true));
    return () => {
      alive = false;
      tree.current = null;
      dispose?.();
    };
  }, [capture]);

  // 편집 모드에서 값이 바뀌면 장면에 바로 반영
  useEffect(() => { tree.current?.apply(settings); }, [settings]);

  useEffect(() => {
    if (phase === "bloom" || phase === "done") onGrown();
  }, [phase, onGrown]);

  // 카드 끌어 옮기기(손잡이)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: settings.card.x, cy: settings.card.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, st = stage.current, c = intro.current;
    if (!d || !st || !c) return;
    const maxX = st.clientWidth - c.offsetWidth - 8, maxY = st.clientHeight - c.offsetHeight - 8;
    onCard({ x: Math.round(Math.min(maxX, Math.max(8, d.cx + e.clientX - d.x))), y: Math.round(Math.min(maxY, Math.max(8, d.cy + e.clientY - d.y))) });
  };
  const onUp = () => { drag.current = null; };
  const editText = (key: "lead" | "line2" | "line3") => ({
    contentEditable: editing,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLParagraphElement>) => editing && onCard({ [key]: e.currentTarget.textContent || "" }),
  });

  const on = STAGES.findIndex((s) => s.key.includes(phase));
  const c = settings.card;
  return (
    <section ref={hero} className={"seed-hero" + (editing ? " editing" : "")} aria-label="씨앗이 매화나무로 자라는 장면">
      <div ref={stage} className="seed-stage">
        {fallback && <pre className="seed-fallback" aria-hidden="true">{SEED_ART}</pre>}
      </div>
      <div ref={intro} className="seed-intro" style={{ "--card-x": `${c.x}px`, "--card-y": `${c.y}px` } as React.CSSProperties}>
        {editing && (
          <button type="button" className="seed-grip" aria-label="카드를 끌어 옮기기" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            ⠿ 끌어서 옮기기
          </button>
        )}
        <p className="seed-lead" key={"a" + c.lead} {...editText("lead")}>{c.lead}</p>
        <p key={"b" + c.line2} {...editText("line2")}>{c.line2}</p>
        <p key={"c" + c.line3} {...editText("line3")}>{c.line3}</p>
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
