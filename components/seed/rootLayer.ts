// 땅속 뿌리 층: 릴스 뒤에 화면에 고정된 글자판(캔버스 하나). 스크롤 때는 다시 그리지 않고,
// 뿌리가 자랄 때와 릴스가 바뀔 때만 잠깐 움직인다. 릴스가 바뀌면 위쪽 뿌리 띠의 글자들이 미끄러져 와서
// 그 릴스의 훅 문장이 되고(릴스 위쪽, 칸에 내려앉음), 다음 릴스에서는 제자리로 돌아간다. 글자 수는 그대로다.
//
// 움직임(2026-11-18, 애플식): 글자마다 튕김 없는 스프링(lib/motion의 값)으로 움직인다. 새 문장이 오면 줄 세워
// 기다리지 않고, 글자마다 지금 화면에 있는 자리와 속도에서 바로 새 목표로 방향을 튼다(처음부터 다시 하지 않음).
// 그래서 릴스를 빨리 넘겨도 문장이 늦지 않게 따라온다.
// '움직임 줄이기'를 켜면: 뿌리는 다 자란 모습이 흐려지며 나타나고, 문장은 미끄러지지 않고 흐려지며 바뀐다.
// 설정을 도중에 바꿔도 바로 따른다. 칸과 글자 크기는 브라우저 기본 글자 크기(16px 기준)를 따라 커진다.

import { spring, springGentle } from "@/lib/motion";

type P = {
  hx: number; hy: number; hc: string; // 제자리 칸과 제 글자
  x: number; y: number; c: string; // 지금 자리(칸 단위, 소수)와 지금 보이는 글자
  vx: number; vy: number; // 지금 속도(칸/초)
  tx: number; ty: number; tc: string; // 가는 곳과 거기 닿으면 될 글자
  w: number; // 스프링 빠르기(각진동수, 1/초)
  d0: number; // 목표가 바뀐 순간 남은 거리(칸)
  t: number; kind: 0 | 1 | 2 | 3; a: number;
};
export type RootColors = { stem: string; root: string; speck: string; text: string };
type Ghost = { x: number; y: number; c: string; a: number; col: string };

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** lib/motion의 visualDuration을 Motion과 같은 식으로 스프링 빠르기로 바꾼다(감쇠 1.0: 튕기지 않고 멈춘다). */
const omega = (visualDuration: number) => (2 * Math.PI) / (1.2 * visualDuration);
const W_HOME = omega(spring.visualDuration); // 옛 문장 글자가 제자리로(0.35초)
const W_LAND = omega(springGentle.visualDuration); // 새 문장 글자가 미끄러져 와서 내려앉기(0.5초)
const LAND = 0.6; // 문장 칸에서 이만큼(칸) 안에 들면 새 글자로 바뀐다
const TEXT_AT = 1.5; // 위쪽 뿌리 띠가 다 자란 뒤(T ≥ 1.5)에 첫 문장을 띄운다
const FADE_MS = 180; // 움직임 줄이기: 문장이 흐려지며 바뀌는 시간
const GROW_FADE_MS = 240; // 움직임 줄이기: 다 자란 뿌리가 흐려지며 나타나는 시간
/** 한글·한자(두 칸 차지, 문장 글꼴로 그림) */
const wide = (c: string) => c.charCodeAt(0) > 0x2fff;

export function createRootLayer(canvas: HTMLCanvasElement, colors: RootColors) {
  const g = canvas.getContext("2d")!;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = mq.matches;
  let W = 0, H = 0, cw = 7, ch = 13, dpr = 1, T = 0, raf = 0, last = 0, growStart = -1, stemCol = 0, ga = 1;
  let asciiFont = "", textFont = "";
  let ps: P[] = [], band: P[] = [], textPs: P[] = [];
  const moving = new Set<P>();
  let fade: { start: number; set: Set<P>; ghosts: Ghost[] } | null = null;
  let pendingText: string | null = null, shownText = "";

  function build(stemX: number) {
    const R = rng(1117);
    // 칸과 글자 크기는 브라우저 기본 글자 크기를 따른다(16px일 때 칸 7×13px, 뿌리 글자 11px, 문장 글자 13px)
    const s = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
    cw = 7 * s;
    ch = 13 * s;
    asciiFont = `${11 * s}px 'JetBrains Mono', Menlo, ui-monospace, monospace`;
    textFont = `600 ${13 * s}px Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    W = Math.floor(w / cw);
    H = Math.floor(h / ch);
    stemCol = Math.max(1, Math.min(W - 2, Math.round(stemX / cw)));
    ps = [];
    const used = new Set<number>();
    const put = (x: number, y: number, c: string, t: number, kind: P["kind"], a: number) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H || used.has(y * W + x)) return;
      used.add(y * W + x);
      ps.push({ hx: x, hy: y, hc: c, x, y, c, vx: 0, vy: 0, tx: x, ty: y, tc: c, w: W_HOME, d0: 0, t, kind, a });
    };
    // 가운데 줄기(위에서 아래로)
    for (let y = 0; y < H; y++) {
      const wig = Math.round(Math.sin(y * 0.35) * 0.6);
      put(stemCol + wig, y, y % 6 === 3 ? (wig > 0 ? ")" : "(") : "|", y * 0.012, 0, 1);
      if (y % 3 === 0) put(stemCol + wig + 1, y, ":", y * 0.012 + 0.01, 0, 0.7);
    }
    // 잔뿌리: 줄기에서 양옆으로 뻗으며 아래로 처진다
    const strand = (x: number, y: number, dir: number, len: number, t0: number, a0: number) => {
      let dy = 0.08 + R() * 0.22;
      for (let k = 1; k < len; k++) {
        x += dir;
        dy += (R() - 0.5) * 0.08;
        const ny = y + Math.max(0, dy);
        const c = ny - y > 0.45 ? (dir > 0 ? "\\" : "/") : R() < 0.5 ? "~" : "_";
        y = ny;
        put(x, y, c, t0 + k * 0.01, 1, Math.max(0.12, a0 * (1 - k / len)));
        if (R() < 0.05 && k > 4) strand(x, y, dir, Math.round(len * 0.4), t0 + k * 0.01, a0 * 0.7);
      }
    };
    for (let k = 0; k < Math.floor(H / 4); k++) {
      const y = 2 + Math.floor(R() * (H * 0.72)), dir = R() < 0.5 ? -1 : 1;
      strand(stemCol + dir, y, dir, Math.round(W * (0.12 + R() * 0.3)), y * 0.012 + 0.2, 0.55);
    }
    // 위쪽 뿌리 띠(릴스 위): 훅 문장으로 바뀔 글자 창고
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x - stemCol) / W;
        if (R() < 0.62 - d * 0.5) put(x, y, "~-_~=~"[Math.floor(R() * 6)], 0.55 + d * 0.8 + R() * 0.1, 2, 0.5 - d * 0.35);
      }
    // 흙 알갱이
    for (let i = 0; i < W * H * 0.02; i++) put(R() * W, R() * H, ".,'`"[Math.floor(R() * 4)], R() * 1.2, 3, 0.25);
    band = ps.filter((p) => p.kind === 2);
    textPs = [];
    moving.clear();
    fade = null;
  }

  const colorOf = (p: P, c: string) => (wide(c) ? colors.text : p.kind === 0 ? colors.stem : p.kind === 3 ? colors.speck : colors.root);

  function draw(now = performance.now()) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.textBaseline = "top";
    const f = fade ? Math.min(1, Math.max(0, (now - fade.start) / FADE_MS)) : 1;
    // 두 번에 나눠 그린다: 뿌리 글자 먼저, 문장 글자(한글)는 그 위에. 글꼴은 한 번씩만 바꾼다.
    for (let pass = 0; pass < 2; pass++) {
      g.font = pass ? textFont : asciiFont;
      let fill = "";
      for (const p of ps) {
        if (p.t > T || wide(p.c) !== (pass === 1)) continue;
        const col = colorOf(p, p.c);
        if (col !== fill) g.fillStyle = fill = col;
        g.globalAlpha = (pass ? 1 : p.a) * ga * (fade && fade.set.has(p) ? f : 1);
        g.fillText(p.c, p.x * cw, p.y * ch);
      }
    }
    // 움직임 줄이기: 바뀌기 전 모습이 흐려지며 사라진다
    if (fade)
      for (const q of fade.ghosts) {
        g.font = wide(q.c) ? textFont : asciiFont;
        g.fillStyle = q.col;
        g.globalAlpha = q.a * ga * (1 - f);
        g.fillText(q.c, q.x * cw, q.y * ch);
      }
    g.globalAlpha = 1;
  }

  /** 글자를 칸 단위로 늘어놓기(한글은 두 칸) */
  function layoutText(text: string) {
    const maxCols = Math.min(64, Math.max(20, Math.floor(W * 0.8)));
    const words = text.split(/\s+/), lines: string[] = [];
    let cur = "";
    const wcols = (s: string) => [...s].reduce((n, c) => n + (wide(c) ? 2 : 1), 0);
    for (const w of words) {
      if (wcols(cur + " " + w) > maxCols && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
      if (lines.length === 2) break;
    }
    if (cur && lines.length < 2) lines.push(cur);
    const cells: { x: number; y: number; c: string }[] = [];
    lines.forEach((line, li) => {
      let x = Math.max(1, Math.round(stemCol - wcols(line) / 2));
      x = Math.min(x, Math.max(1, W - wcols(line) - 1));
      const y = 1 + li * 2;
      for (const c of line) {
        if (c !== " ") cells.push({ x, y, c });
        x += wide(c) ? 2 : 1;
      }
    });
    return cells;
  }

  /** 글자 하나의 목표를 바꾼다. 지금 자리·속도는 그대로 두므로, 움직이던 글자는 그 자리에서 방향을 튼다. */
  function aim(p: P, x: number, y: number, c: string, w: number) {
    p.tx = x; p.ty = y; p.tc = c; p.w = w;
    p.d0 = Math.hypot(p.x - x, p.y - y);
    moving.add(p);
  }
  function settle(p: P) {
    p.x = p.tx; p.y = p.ty; p.vx = 0; p.vy = 0; p.c = p.tc;
    moving.delete(p);
  }
  /** 튕김 없는 스프링(감쇠 1.0)을 dt초만큼 정확히 푼다. 프레임이 길어져도 흔들리거나 튀지 않는다. */
  function advance(p: P, dt: number) {
    const k = Math.exp(-p.w * dt);
    const ex = p.x - p.tx, bx = p.vx + p.w * ex;
    const ey = p.y - p.ty, by = p.vy + p.w * ey;
    p.x = p.tx + (ex + bx * dt) * k;
    p.y = p.ty + (ey + by * dt) * k;
    p.vx = (p.vx - p.w * bx * dt) * k;
    p.vy = (p.vy - p.w * by * dt) * k;
    const d = Math.hypot(p.x - p.tx, p.y - p.ty);
    if (d < 0.03 && Math.hypot(p.vx, p.vy) < 0.3) return settle(p);
    // 제자리로 가는 글자는 반쯤 왔을 때 제 글자로 돌아가고, 문장으로 가는 글자는 칸 가까이 와서야 새 글자가 된다
    const home = p.tx === p.hx && p.ty === p.hy && p.tc === p.hc;
    if (home ? d <= p.d0 * 0.5 : d < LAND) p.c = p.tc;
  }

  /** 지금 보이는 문장을 바꾼다. 앞 문장이 아직 움직이는 중이어도 기다리지 않는다. */
  function setText(text: string, instant: boolean) {
    const old = textPs, oldSet = new Set(old);
    for (const p of old) aim(p, p.hx, p.hy, p.hc, W_HOME); // 옛 문장은 제자리로
    // 새 문장 칸마다 가장 가까운 띠 글자를 고른다. 지금 화면 위치로 재므로, 제자리로 돌아가던 글자도 그 자리에서 다시 불려 온다.
    const pool = band.filter((p) => !oldSet.has(p)), next: P[] = [];
    for (const cell of layoutText(text)) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const q = pool[i], d = (q.x - cell.x) ** 2 + ((q.y - cell.y) * 2) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) break;
      const p = pool.splice(best, 1)[0];
      aim(p, cell.x, cell.y, cell.c, W_LAND);
      next.push(p);
    }
    textPs = next;
    shownText = text;
    if (instant) { [...moving].forEach(settle); return; }
    if (reduced) {
      // 움직임 줄이기: 미끄러지지 않고, 바뀌기 전 모습이 흐려지며 새 모습으로 바뀐다
      const changed = [...moving];
      fade = { start: performance.now(), set: new Set(changed), ghosts: changed.map((p) => ({ x: p.x, y: p.y, c: p.c, a: wide(p.c) ? 1 : p.a, col: colorOf(p, p.c) })) };
      changed.forEach(settle);
    }
    loop();
  }

  function step(now: number) {
    // 실제로 흐른 시간만큼 푼다(스프링 풀이가 정확해서 프레임이 띄엄띄엄 와도 안전하다). 1초 넘게 멈췄다면 어차피 다 멈춘 뒤다.
    const dt = last ? Math.min(1, Math.max(0, (now - last) / 1000)) : 1 / 60;
    last = now;
    let busy = false;
    if (growStart >= 0 && (T < 3 || ga < 1)) {
      if (reduced) { T = 9; ga = Math.min(1, Math.max(0, (now - growStart) / GROW_FADE_MS)); }
      else { T = Math.max(T, ((now - growStart) / 1000) * 1.6); ga = 1; }
      busy = T < 3 || ga < 1;
    }
    if (pendingText !== null && T >= TEXT_AT) { const t = pendingText; pendingText = null; setText(t, false); }
    for (const p of moving) advance(p, dt);
    if (fade && now - fade.start >= FADE_MS) fade = null;
    if (moving.size || fade) busy = true;
    draw(now);
    if (busy) raf = requestAnimationFrame(step);
    else { raf = 0; last = 0; }
  }
  const loop = () => { if (!raf) raf = requestAnimationFrame(step); };

  // '움직임 줄이기'를 도중에 켜면, 움직이던 것은 모두 바로 끝 모습으로
  const onMotionPref = () => {
    reduced = mq.matches;
    if (!reduced) return;
    if (growStart >= 0) { T = 9; ga = 1; }
    [...moving].forEach(settle);
    fade = null;
    draw();
  };
  mq.addEventListener?.("change", onMotionPref);

  return {
    /** 줄기 위치(px)를 정하고 처음부터 다시 만든다(크기가 바뀔 때). 이미 자랐으면 다 자란 모습과 지금 문장을 바로 그린다. */
    layout(stemX: number) {
      build(stemX);
      if (growStart >= 0) {
        T = 9; ga = 1;
        const t = pendingText ?? shownText;
        pendingText = null;
        if (t) setText(t, true);
      }
      draw();
    },
    /** 뿌리가 위에서부터 자란다(땅속 구역이 화면에 들어올 때 한 번) */
    grow() { if (growStart < 0) { growStart = performance.now(); if (reduced) ga = 0; loop(); } },
    /** 지금 보는 릴스의 훅 문장으로 바꾼다. 줄 세우지 않고 바로 방향을 튼다(뿌리 띠가 아직 덜 자랐으면 자란 뒤에). */
    show(text: string) {
      if (T < TEXT_AT) { pendingText = text; return; }
      pendingText = null;
      if (text !== shownText) setText(text, false);
    },
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
      mq.removeEventListener?.("change", onMotionPref);
    },
  };
}
