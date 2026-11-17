// 씨앗 탭 아스키 엔진: 글자 칸(격자)에 나무·뿌리를 그리고, 자라는 순서대로 보여 준다.
// 글자판은 화면 위에 떠 있는 층이 아니라 페이지 안에 붙어 같이 스크롤된다. 움직임은 짧게 한 번만 돈다.

export const LEAF = 1, ROOT = 2, WOOD = 3, WORD = 4;
export type Layer = 1 | 2 | 3 | 4;
export const LAYERS: Layer[] = [LEAF, ROOT, WOOD, WORD];
export type Pres = Partial<Record<Layer, HTMLPreElement | null>>;
type Rnd = () => number;

export function mulberry(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 고정폭 글자 한 칸의 너비·줄 높이(px). host 안에 잠깐 글자를 놓고 잰다. */
export function measureChar(host: HTMLElement, cls: string) {
  const s = document.createElement("pre");
  s.className = cls;
  s.style.cssText = "position:absolute;visibility:hidden;inset:auto;left:0;top:0;width:auto;height:auto;margin:0;padding:0;white-space:pre";
  s.textContent = "M".repeat(40) + "\nM";
  host.appendChild(s);
  const r = s.getBoundingClientRect();
  s.remove();
  return { cw: r.width / 40 || 7.2, ch: r.height / 2 || 14 };
}

export class Grid {
  c: string[];
  l: Uint8Array;
  t: Float32Array;
  mask: ((x: number, y: number, layer: Layer) => boolean) | null = null;
  spots: { x: number; y: number; t: number }[] = [];
  wordSpots: { word: string; x: number; y: number }[] = [];
  constructor(public W: number, public H: number, public A: number) {
    const n = W * H;
    this.c = new Array(n).fill(" ");
    this.l = new Uint8Array(n);
    this.t = new Float32Array(n).fill(Infinity);
  }
  put(x: number, y: number, ch: string, t: number, layer: Layer) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    if (this.mask && this.mask(x, y, layer)) return;
    const i = y * this.W + x, old = this.l[i];
    if (old && (layer < old || (layer === old && this.t[i] <= t))) return;
    this.c[i] = ch;
    this.l[i] = layer;
    this.t[i] = t;
  }
}

/** 움직이는 방향(dx 칸, dy 줄)에 맞는 글자 */
function slopeChar(dx: number, dy: number, A: number, flat: string) {
  const vx = Math.abs(dx), vy = Math.abs(dy * A);
  if (vx < vy * 0.45) return "|";
  if (vy < vx * 0.45) return flat;
  return dx > 0 === dy < 0 ? "/" : "\\";
}

type StrokeOpt = { up: boolean; layer: Layer; t0: number; speed: number; rnd: Rnd; width?: number; wob?: number; flat?: string; bark?: (w: number, i: number) => string };

/** 한 줄기 긋기. ang: 0 = 곧게(위 또는 아래), +는 오른쪽 */
export function stroke(g: Grid, x: number, y: number, ang: number, len: number, o: StrokeOpt) {
  const A = g.A, step = 0.5, n = Math.max(1, Math.round(len / step)), wd = o.width || 1;
  let t = o.t0;
  for (let i = 1; i <= n; i++) {
    ang += (o.rnd() - 0.5) * (o.wob || 0);
    const sx = Math.sin(ang) * step, sy = ((o.up ? -1 : 1) * Math.cos(ang) * step) / A;
    x += sx;
    y += sy;
    t += step / o.speed;
    const ch = slopeChar(sx, sy, A, o.flat || "_");
    g.put(x, y, ch, t, o.layer);
    for (let w = 1; w < wd; w++) {
      const off = (w % 2 ? 1 : -1) * Math.ceil(w / 2);
      g.put(x + off, y, w >= wd - 2 ? ch : o.bark ? o.bark(w, i) : " ", t, o.layer);
    }
  }
  return { x, y, t, ang };
}

type SteerOpt = { layer: Layer; t0: number; speed: number; rnd: Rnd; wig?: number; flat?: string; rootlets?: number };

/** 목표 칸까지 꾸불꾸불 따라가는 뿌리(아래로만) */
export function steer(g: Grid, x: number, y: number, tx: number, ty: number, o: SteerOpt) {
  const A = g.A;
  let t = o.t0, guard = 0;
  while ((Math.abs(tx - x) > 0.7 || Math.abs(ty - y) > 0.4) && guard++ < 4000) {
    const ang = Math.atan2(tx - x, Math.max(0, ty - y) * A) + (o.rnd() - 0.5) * (o.wig ?? 0.6);
    const sx = Math.sin(ang) * 0.5, sy = (Math.max(0, Math.cos(ang)) * 0.5) / A;
    x += sx;
    y += sy;
    t += 0.5 / o.speed;
    g.put(x, y, slopeChar(sx, sy || 0.0001, A, o.flat || "~"), t, o.layer);
    if (o.rootlets && o.rnd() < o.rootlets)
      stroke(g, x, y, (o.rnd() < 0.5 ? -1 : 1) * (0.5 + o.rnd() * 0.7), 2 + o.rnd() * 5, { layer: o.layer, rnd: o.rnd, speed: o.speed, up: false, t0: t, flat: "~" });
  }
  return { x, y, t };
}

export type TreeOpt = {
  bx: number; gy: number; rnd: Rnd;
  trunkRows: number; trunkW: number; reach: number; depth: number; lift: number;
  mains: number[]; clusterR: number; leafChars: string; bark: (w: number, i: number) => string;
  speed: number; leafDelay: number; leafJitter: number; words: string[];
  ground: string; soil: number; roots: { tx: number; ty: number }[];
};

function cluster(g: Grid, cx: number, cy: number, t0: number, o: TreeOpt, scale: number) {
  const rx = o.clusterR * scale * (0.8 + o.rnd() * 0.5), ry = (rx / g.A) * 1.15;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1 || o.rnd() > 1.02 - d * 0.7) continue;
      g.put(x, y, o.leafChars[Math.floor(o.rnd() * o.leafChars.length)], t0 + Math.sqrt(d) * o.leafDelay + o.rnd() * o.leafJitter, LEAF);
    }
  g.spots.push({ x: cx, y: cy, t: t0 });
}

function branch(g: Grid, x: number, y: number, ang: number, len: number, depth: number, t0: number, w: number, o: TreeOpt): void {
  const e = stroke(g, x, y, ang, len, { up: true, layer: WOOD, t0, speed: o.speed, width: w, bark: o.bark, wob: 0.07, rnd: o.rnd });
  if (depth <= 0 || len < 3) return cluster(g, e.x, e.y, e.t, o, 1);
  const kids = depth > 2 && o.rnd() < 0.3 ? 3 : 2;
  for (let k = 0; k < kids; k++) {
    const dir = kids === 2 ? (k ? 1 : -1) : k - 1;
    const na = e.ang * o.lift + dir * (0.32 + o.rnd() * 0.38) + (o.rnd() - 0.5) * 0.2;
    branch(g, e.x, e.y, na, len * (0.62 + o.rnd() * 0.16), depth - 1, e.t, Math.max(1, w - 1), o);
  }
  if (depth <= 1) cluster(g, e.x, e.y, e.t, o, 0.75);
}

/** 나무 한 그루 + 땅과 흙 + 땅 밑 뿌리(o.roots 목표 칸까지) */
export function buildTree(g: Grid, o: TreeOpt) {
  const tr = stroke(g, o.bx, o.gy + 0.5, 0, o.trunkRows * g.A, { up: true, layer: WOOD, t0: 0, speed: o.speed, width: o.trunkW, bark: o.bark, wob: 0.03, rnd: o.rnd });
  const half = Math.floor(o.trunkW / 2);
  ([["_/", -half - 2], ["\\_", half + 1]] as const).forEach(([s, x0]) => {
    for (let k = 0; k < s.length; k++) g.put(o.bx + x0 + k, o.gy, s[k], 0.5, WOOD);
  });
  [0.62, 0.82].forEach((f, n) => {
    const sy = o.gy - o.trunkRows * f, dir = n ? 1 : -1;
    branch(g, o.bx + dir * half, sy, dir * (1.0 + o.rnd() * 0.25), o.reach * 0.38, Math.max(1, o.depth - 2), f * tr.t, Math.max(1, o.trunkW - 5), o);
  });
  for (const a of o.mains) branch(g, tr.x, tr.y, a + (o.rnd() - 0.5) * 0.12, o.reach * (0.8 + o.rnd() * 0.3), o.depth, tr.t, Math.max(1, o.trunkW - 2), o);
  // 잎 사이 낱말: 비어 있고 글을 가리지 않는 잎 덩어리 가운데에
  const spots = g.spots.filter((p) => p.y > 1 && p.y < o.gy - 3).sort(() => o.rnd() - 0.5);
  const used: { x: number; y: number; len: number }[] = [];
  for (const word of o.words) {
    for (let n = 0; n < spots.length; n++) {
      const p = spots[n], x0 = Math.round(p.x - word.length / 2), y0 = Math.round(p.y);
      if (x0 < 1 || x0 + word.length >= g.W - 1) continue;
      if (used.some((u) => Math.abs(u.y - y0) < 2 && x0 < u.x + u.len + 2 && u.x < x0 + word.length + 2)) continue;
      let ok = true;
      for (let k = 0; k < word.length; k++) if (g.mask && g.mask(x0 + k, y0, WORD)) ok = false;
      if (!ok) continue;
      for (let k = 0; k < word.length; k++) g.put(x0 + k, y0, word[k], p.t + 0.15 + k * 0.02, WORD);
      g.wordSpots.push({ word, x: x0, y: y0 });
      used.push({ x: x0, y: y0, len: word.length });
      spots.splice(n, 1);
      break;
    }
  }
  for (let x = 0; x < g.W; x++) {
    if (o.rnd() < 0.85) g.put(x, o.gy + 1, o.ground[Math.floor(o.rnd() * o.ground.length)], o.rnd() * 0.3, ROOT);
    for (let y = o.gy + 2; y < g.H; y++) if (o.rnd() < o.soil) g.put(x, y, ".,'`"[Math.floor(o.rnd() * 4)], 0.2 + o.rnd() * 0.6, ROOT);
  }
  for (const r of o.roots) steer(g, o.bx + (r.tx < o.bx ? -1 : 1), o.gy + 1.5, r.tx, r.ty, { layer: ROOT, t0: 0.05, speed: o.speed * 0.8, rnd: o.rnd, wig: 0.9, rootlets: 0.06 });
}

/** 자라는 순서대로 보여 주는 판. 글자판(pre) 4겹: 잎·뿌리·나무·낱말 */
export class Stage {
  private tpl: string[] = [];
  private order: number[] = [];
  private buf = {} as Record<Layer, string[]>;
  private k = 0;
  private key: (i: number) => number = (i) => this.g.t[i];
  private kMax = 1;
  private raf = 0;
  constructor(public g: Grid, private pres: Pres) {
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) this.tpl.push(" ");
      this.tpl.push("\n");
    }
    for (let i = 0; i < g.W * g.H; i++) if (g.l[i]) this.order.push(i);
    this.reset();
  }
  stop() { cancelAnimationFrame(this.raf); }
  reset() {
    this.stop();
    this.k = 0;
    for (const L of LAYERS) {
      this.buf[L] = this.tpl.slice();
      const p = this.pres[L];
      if (p) p.textContent = "";
    }
  }
  private timing(mode: "grow" | "type") {
    const g = this.g;
    this.key = mode === "type" ? (i) => (g.H - 1 - Math.floor(i / g.W)) * 1000 + (i % g.W) : (i) => g.t[i];
    this.order.sort((a, b) => this.key(a) - this.key(b));
    this.kMax = this.order.length ? this.key(this.order[this.order.length - 1]) : 1;
  }
  private show(T: number) {
    const g = this.g, W = g.W, dirty = new Set<Layer>();
    while (this.k < this.order.length && this.key(this.order[this.k]) <= T) {
      const i = this.order[this.k++], L = g.l[i] as Layer;
      this.buf[L][Math.floor(i / W) * (W + 1) + (i % W)] = g.c[i];
      dirty.add(L);
    }
    for (const L of dirty) { const p = this.pres[L]; if (p) p.textContent = this.buf[L].join(""); }
  }
  /** 움직임 없이 다 그린 모습 */
  instant() { this.reset(); this.timing("grow"); this.show(Infinity); }
  /** mode: grow(줄기부터 가지·잎 순서) | type(아래 줄부터 찍기). 움직임 줄이기 설정이면 바로 다 그린다. */
  play(mode: "grow" | "type", dur: number, done?: () => void) {
    this.reset();
    this.timing(mode);
    const t0 = performance.now(), ease = (p: number) => 1 - Math.pow(1 - p, 2.2);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - t0) / dur);
      this.show(p === 1 ? Infinity : ease(p) * this.kMax);
      if (p < 1) this.raf = requestAnimationFrame(frame);
      else done?.();
    };
    this.raf = requestAnimationFrame(frame);
  }
}

export const SEED_ART = ["  .-*~*-.", " (#@SEED@)", "  '*~:~*'"].join("\n");
export const SPROUT_ART = ["  \\ | /", " -- Y --", "    |", "  __|__"].join("\n");
