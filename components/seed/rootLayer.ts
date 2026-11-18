// 땅속 뿌리 층: 릴스 뒤에 화면에 고정된 글자판(캔버스 하나). 스크롤 때는 다시 그리지 않고,
// 뿌리가 자랄 때와 릴스가 바뀔 때만 잠깐 움직인다. 릴스가 바뀌면 위쪽 뿌리 띠의 글자들이 미끄러져 와서
// 그 릴스의 훅 문장이 되고(릴스 위쪽, 칸에 내려앉음), 다음 릴스에서는 제자리로 돌아간다. 글자 수는 그대로다.

type P = { hx: number; hy: number; hc: string; x: number; y: number; c: string; t: number; kind: 0 | 1 | 2 | 3; a: number; tx?: number; ty?: number; tc?: string; s0x?: number; s0y?: number };
export type RootColors = { stem: string; root: string; speck: string; text: string };

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function createRootLayer(canvas: HTMLCanvasElement, colors: RootColors) {
  const g = canvas.getContext("2d")!;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, cw = 7, ch = 13, dpr = 1, ps: P[] = [], textPs: P[] = [], T = 0, raf = 0, growStart = -1, stemCol = 0;
  let morph: { start: number; dur: number; back: P[]; to: P[] } | null = null;
  let pendingText: string | null = null, shownText = "";

  function build(stemX: number) {
    const R = rng(1117);
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
      ps.push({ hx: x, hy: y, hc: c, x, y, c, t, kind, a });
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
    textPs = [];
    morph = null;
  }

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W * cw + cw, H * ch + ch);
    g.textBaseline = "top";
    let lastFont = "";
    for (const p of ps) {
      if (p.t > T) continue;
      const isText = p.c.charCodeAt(0) > 0x2fff;
      const font = isText ? "600 13px Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" : "11px 'JetBrains Mono', Menlo, ui-monospace, monospace";
      if (font !== lastFont) { g.font = font; lastFont = font; }
      g.globalAlpha = isText ? 1 : p.a;
      g.fillStyle = isText ? colors.text : p.kind === 0 ? colors.stem : p.kind === 3 ? colors.speck : colors.root;
      g.fillText(p.c, p.x * cw, p.y * ch);
    }
    g.globalAlpha = 1;
  }

  /** 글자를 칸 단위로 늘어놓기(한글은 두 칸) */
  function layoutText(text: string) {
    const maxCols = Math.min(64, Math.max(20, Math.floor(W * 0.8)));
    const words = text.split(/\s+/), lines: string[] = [];
    let cur = "";
    const wcols = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x2fff ? 2 : 1), 0);
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
        x += c.charCodeAt(0) > 0x2fff ? 2 : 1;
      }
    });
    return cells;
  }

  function startMorph(text: string) {
    const now = performance.now();
    const back = textPs;
    back.forEach((p) => { p.s0x = p.x; p.s0y = p.y; p.tx = p.hx; p.ty = p.hy; p.tc = p.hc; });
    const cells = layoutText(text), pool = ps.filter((p) => p.kind === 2 && !back.includes(p));
    const to: P[] = [];
    cells.forEach((cell) => {
      let best = -1, bd = 1e9;
      for (let i = 0; i < pool.length; i++) {
        const q = pool[i], d = (q.hx - cell.x) ** 2 + ((q.hy - cell.y) * 2) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return;
      const p = pool.splice(best, 1)[0];
      p.s0x = p.x; p.s0y = p.y; p.tx = cell.x; p.ty = cell.y; p.tc = cell.c;
      to.push(p);
    });
    textPs = to;
    shownText = text;
    if (reduced) {
      [...back, ...to].forEach((p) => { p.x = p.tx!; p.y = p.ty!; p.c = p.tc!; });
      draw();
      return;
    }
    morph = { start: now, dur: 900, back, to };
    loop();
  }

  function step(now: number) {
    let busy = false;
    if (growStart >= 0 && T < 3) {
      T = reduced ? 9 : (now - growStart) / 1000 * 1.6;
      busy = true;
    }
    if (morph) {
      const k = (now - morph.start) / morph.dur;
      // 앞 40%: 옛 문장이 제자리로, 뒤 60%: 새 글자가 미끄러져 와서 칸에 내려앉는다
      const kb = ease(Math.min(1, k / 0.4)), kt = ease(Math.max(0, (k - 0.3) / 0.7));
      for (const p of morph.back) { p.x = p.s0x! + (p.tx! - p.s0x!) * kb; p.y = p.s0y! + (p.ty! - p.s0y!) * kb; if (kb > 0.5) p.c = p.tc!; }
      for (const p of morph.to) { p.x = p.s0x! + (p.tx! - p.s0x!) * kt; p.y = p.s0y! + (p.ty! - p.s0y!) * kt; if (kt > 0.92) { p.c = p.tc!; p.x = p.tx!; p.y = p.ty!; } }
      if (k >= 1) morph = null; else busy = true;
    }
    draw();
    if (busy) raf = requestAnimationFrame(step);
    else { raf = 0; if (pendingText !== null && T >= 1) { const t = pendingText; pendingText = null; startMorph(t); } }
  }
  const loop = () => { if (!raf) raf = requestAnimationFrame(step); };

  return {
    /** 줄기 위치(px)를 정하고 처음부터 다시 만든다(크기가 바뀔 때). */
    layout(stemX: number) {
      build(stemX);
      if (growStart >= 0) { T = 9; textPs = []; const t = shownText; shownText = ""; if (t) startMorph(t); }
      draw();
    },
    /** 나무가 다 자라면 뿌리가 위에서부터 자란다 */
    grow() { if (growStart < 0) { growStart = performance.now(); loop(); } },
    /** 지금 보는 릴스의 훅 문장으로 바꾼다 */
    show(text: string) {
      if (text === shownText) return;
      if (morph || T < 1) { pendingText = text; loop(); return; }
      startMorph(text);
    },
    dispose() { cancelAnimationFrame(raf); },
  };
}
