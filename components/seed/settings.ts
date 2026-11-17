// 씨앗 탭에서 사람이 직접 고칠 수 있는 값. 기본값은 seedSettings.json(편집 모드에서 '저장'하면 이 파일이 바뀐다).
import defaults from "./seedSettings.json";

export type SeedSettings = {
  tree: { x: number; top: number; glyph: number };
  turn: { stepDeg: number; moveSec: number; holdSec: number };
  depth: { fog: number };
  color: { blossom: string; wood: string; butterfly: string; ground: string };
  flies: number;
  moon: { show: boolean; x: number; y: number; size: number };
  card: { x: number; y: number; lead: string; line2: string; line3: string };
};

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
const txt = (v: unknown, d: string) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 200) : d);

/** 들어온 값을 안전한 범위로 맞춘다(저장할 때도, 읽을 때도). */
export function sanitize(input: unknown): SeedSettings {
  const d = defaults as SeedSettings;
  const s = (input && typeof input === "object" ? input : {}) as Partial<SeedSettings>;
  return {
    tree: { x: num(s.tree?.x, 0.1, 0.9, d.tree.x), top: num(s.tree?.top, 0.02, 0.6, d.tree.top), glyph: num(s.tree?.glyph, 2.6, 9, d.tree.glyph) },
    turn: { stepDeg: num(s.turn?.stepDeg, 15, 360, d.turn.stepDeg), moveSec: num(s.turn?.moveSec, 0.6, 12, d.turn.moveSec), holdSec: num(s.turn?.holdSec, 0, 10, d.turn.holdSec) },
    depth: { fog: num(s.depth?.fog, 0, 3, d.depth.fog) },
    color: { blossom: hex(s.color?.blossom, d.color.blossom), wood: hex(s.color?.wood, d.color.wood), butterfly: hex(s.color?.butterfly, d.color.butterfly), ground: hex(s.color?.ground, d.color.ground) },
    flies: Math.round(num(s.flies, 0, 8, d.flies)),
    moon: { show: typeof s.moon?.show === "boolean" ? s.moon.show : d.moon.show, x: num(s.moon?.x, -1, 1, d.moon.x), y: num(s.moon?.y, -1, 1, d.moon.y), size: num(s.moon?.size, 0.2, 3, d.moon.size) },
    card: { x: num(s.card?.x, 0, 4000, d.card.x), y: num(s.card?.y, 0, 4000, d.card.y), lead: txt(s.card?.lead, d.card.lead), line2: txt(s.card?.line2, d.card.line2), line3: txt(s.card?.line3, d.card.line3) },
  };
}

export const DEFAULT_SETTINGS = sanitize(defaults);
