// 샘플 데이터 — Supabase 연결 전까지 화면/로직 검증용.
// 실제 연동 시 lib/repo.ts의 함수들만 DB 조회로 교체하면 된다.
import type { Card, CardEvent, CardType, IgAccount, Post } from "./types";
import { addDays, ymd } from "./format";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261112);
const lognormal = (sigma: number) => {
  const u = Math.max(rand(), 1e-6);
  const v = rand();
  return Math.exp(sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
};

export const TODAY_DATE = new Date();
export const TODAY = ymd(TODAY_DATE);

// ── 계정 (7개, 샘플) ───────────────────────────
export const ACCOUNTS: IgAccount[] = [
  { id: "a1", handle: "creazy_official", name: "크리에이지 공식", followers: 48200, status: "connected", color: "#3B82F6" },
  { id: "a2", handle: "creazy_tips", name: "마케팅 꿀팁", followers: 21800, status: "connected", color: "#8B5CF6" },
  { id: "a3", handle: "termit_team", name: "테르밋 팀", followers: 9400, status: "connected", color: "#0EA5E9" },
  { id: "a4", handle: "creazy_daily", name: "크리에이지 데일리", followers: 15600, status: "connected", color: "#14B8A6" },
  { id: "a5", handle: "creazy_studio", name: "크리에이지 스튜디오", followers: 12300, status: "connected", color: "#F59E0B" },
  { id: "a6", handle: "termit_life", name: "테르밋 라이프", followers: 6100, status: "expired", color: "#EF4444" },
  { id: "a7", handle: "creazy_ads", name: "크리에이지 광고", followers: 31900, status: "connected", color: "#6366F1" },
];

// ── 카드 템플릿 (승원 API가 대체할 부분) ─────────
interface Tpl {
  type: CardType;
  format: string;
  title: string;
  difficulty: 1 | 2 | 3;
  audio: string;
  commercial: boolean;
  cuts: [string, string][];
  caption: string;
  tags: string[];
}

const TIMES: [number, number][] = [
  [0, 3],
  [3, 8],
  [8, 15],
  [15, 22],
  [22, 25],
];

const TEMPLATES: Tpl[] = [
  {
    type: "dummy",
    format: "신입 N시간",
    title: "입사 3시간차 신입의 첫 업무",
    difficulty: 2,
    audio: "Morning Rush (Remix)",
    commercial: true,
    cuts: [
      ["출근 문 앞, 벽시계 클로즈업", "입사 3시간차"],
      ["첫 업무 전달 장면, 선배가 노트북 건네는 컷", "첫 업무가 이거라고요?"],
      ["실수로 화면이 멈추고 당황하는 컷", "(비트 드롭에 맞춰 컷 전환)"],
      ["동료가 도와주고 하이파이브", "근데 해냄"],
      ["로고 없이 자막만 남기고 마무리", "다음 신입은 당신?"],
    ],
    caption: "입사 3시간 만에 첫 결과물 뽑은 신입 🫡 #신입 #직장인브이로그",
    tags: ["신입", "직장인브이로그", "첫출근", "회사생활", "릴스"],
  },
  {
    type: "dummy",
    format: "POV 직장인",
    title: "POV: 퇴근 10분 전에 온 수정 요청",
    difficulty: 1,
    audio: "Panic At 6PM",
    commercial: true,
    cuts: [
      ["퇴근 가방을 싸는 손", "POV: 오늘은 칼퇴다"],
      ["메신저 알림이 울리는 모니터", "…수정 요청 1건"],
      ["천천히 고개를 돌리는 얼굴 클로즈업", "(정적 1초)"],
      ["가방을 다시 내려놓는 컷", "알겠습니다 😇"],
      ["어두워진 사무실 창밖", "오늘도 칼퇴는 꿈"],
    ],
    caption: "다들 이거 공감하죠 #직장인공감 #POV",
    tags: ["직장인공감", "POV", "퇴근", "회사릴스", "공감"],
  },
  {
    type: "dummy",
    format: "N년차 vs 신입",
    title: "3년차 vs 신입, 같은 요청 다르게 받기",
    difficulty: 2,
    audio: "Two Faces",
    commercial: true,
    cuts: [
      ["화면 분할: 왼쪽 신입 / 오른쪽 3년차", "같은 요청, 다른 반응"],
      ["요청 메시지 도착", "'내일까지 가능?'"],
      ["신입은 허둥, 3년차는 여유롭게 커피", "(좌우 대비 컷)"],
      ["둘 다 결과물 제출", "근데 결과는…"],
      ["엔딩 반전 자막", "3년차도 밤샘"],
    ],
    caption: "연차별 반응 차이 #N년차 #신입 #직장인",
    tags: ["N년차", "신입", "직장인", "공감", "밈"],
  },
  {
    type: "dummy",
    format: "밈 챌린지",
    title: "탕비실 밈 챌린지",
    difficulty: 1,
    audio: "Snack Time (Trend)",
    commercial: false,
    cuts: [
      ["탕비실 문 열고 등장", "(트렌드 음원 인트로)"],
      ["간식 서랍 클로즈업", "오늘의 선택은?"],
      ["동료 3명이 동시에 손 뻗는 컷", "(비트에 맞춘 점프컷)"],
      ["마지막 하나 남은 간식", "…"],
      ["서로 양보하는 엔딩", "역시 우리 팀"],
    ],
    caption: "탕비실에서 생긴 일 #밈 #챌린지",
    tags: ["밈", "챌린지", "탕비실", "회사", "릴스"],
  },
  {
    type: "service",
    format: "비포/애프터",
    title: "크리에이지로 배너 만들기: 2시간 → 3분",
    difficulty: 2,
    audio: "Before & After",
    commercial: true,
    cuts: [
      ["타이머 02:00:00이 찍힌 노트북", "배너 하나에 2시간"],
      ["빈 캔버스와 한숨", "이게 맞나…"],
      ["크리에이지에 한 줄 입력하는 화면 녹화", "'신제품 할인 배너'"],
      ["결과물 3종 생성되는 화면", "3분 뒤"],
      ["타이머 00:03:12, 엔딩 CTA", "프로필 링크에서 무료 체험"],
    ],
    caption: "마케터라면 이 차이 아시죠? #마케팅 #AI툴",
    tags: ["마케팅", "AI툴", "배너제작", "크리에이지", "업무효율"],
  },
  {
    type: "service",
    format: "정보성 꿀팁",
    title: "마케터가 몰랐던 숏폼 제작 꿀팁 3가지",
    difficulty: 1,
    audio: "Clean Beat",
    commercial: true,
    cuts: [
      ["텍스트 훅 슬라이드", "숏폼 조회수 안 나온다면 이것부터"],
      ["꿀팁 1: 첫 3초 훅 화면 예시", "① 첫 3초에 결론부터"],
      ["꿀팁 2: 자막 크기 비교", "② 자막은 크게, 짧게"],
      ["꿀팁 3: 제작 도구 화면", "③ 템플릿은 AI로"],
      ["저장 유도 엔딩", "저장해두고 써먹기"],
    ],
    caption: "저장 필수 📌 #마케터 #숏폼팁",
    tags: ["마케터", "숏폼팁", "릴스제작", "콘텐츠마케팅", "저장필수"],
  },
  {
    type: "service",
    format: "제작 과정 공개",
    title: "AI로 제품 광고 영상 뽑는 과정 그대로 공개",
    difficulty: 3,
    audio: "Behind The Scenes",
    commercial: true,
    cuts: [
      ["빈 타임라인 화면", "광고 영상, 처음부터 만들어봤다"],
      ["제품 사진 업로드", "사진 1장으로 시작"],
      ["프롬프트 입력과 생성 대기 (타임랩스)", "…"],
      ["영상 후보 3개 비교", "이 중에 고르면 끝"],
      ["완성본 풀 재생과 CTA", "직접 만들어보세요"],
    ],
    caption: "사진 1장으로 광고 영상 뚝딱 #AI영상 #광고",
    tags: ["AI영상", "광고제작", "제작과정", "크리에이지", "마케팅"],
  },
  {
    type: "service",
    format: "POV 직장인",
    title: "POV: 대표가 내일까지 영상 10개 만들래",
    difficulty: 2,
    audio: "Panic At 6PM",
    commercial: true,
    cuts: [
      ["회의실, 대표의 한마디", "내일까지 영상 10개요"],
      ["얼어붙은 팀원 표정", "(정적 1초)"],
      ["노트북에서 크리에이지 실행", "…근데 우리한텐 이게 있잖아"],
      ["영상이 연달아 생성되는 화면", "(빠른 컷)"],
      ["여유롭게 커피 마시는 엔딩", "퇴근합니다 ☕"],
    ],
    caption: "이럴 때 쓰는 툴 #마케터 #직장인공감",
    tags: ["마케터", "직장인공감", "AI툴", "영상제작", "POV"],
  },
];

const DUMMY_TPLS = TEMPLATES.filter((t) => t.type === "dummy");
const SERVICE_TPLS = TEMPLATES.filter((t) => t.type === "service");
export const tplsOf = (type: CardType) => (type === "dummy" ? DUMMY_TPLS : SERVICE_TPLS);

export function makeCard(tpl: Tpl, date: string, regen: number): Card {
  const n = 3 + Math.floor(rand() * 6);
  const x = (3 + rand() * 2.5).toFixed(1);
  return {
    card_id: `${date}-${tpl.type}-${regen}`,
    date,
    type: tpl.type,
    title: tpl.title,
    format: tpl.format,
    rationale: `어제 시드 계정 ${n}곳에서 같은 포맷이 동시에 상승했어요 (계정 평균 대비 ${x}배)`,
    difficulty: tpl.difficulty,
    audio: { name: tpl.audio, commercial_ok: tpl.commercial },
    storyboard: tpl.cuts.map(([visual, caption], i) => ({
      cut: i + 1,
      start_s: TIMES[i][0],
      end_s: TIMES[i][1],
      visual,
      caption,
      note: i === 0 ? "훅 — 레퍼런스 A 훅 구조 차용" : i === 2 ? "음원 비트 포인트에 컷 전환" : undefined,
    })),
    references: [
      { url: "https://www.instagram.com/reel/REF0001/", role: "hook" },
      { url: "https://www.instagram.com/reel/REF0002/", role: "structure" },
      { url: "https://www.instagram.com/reel/REF0003/", role: "edit" },
    ],
    caption_draft: tpl.caption,
    hashtags: tpl.tags,
    prompt:
      `[역할] 너는 크리에이지의 숏폼 콘텐츠 제작 도우미야.\n` +
      `[포맷] ${tpl.format} / [유형] ${tpl.type === "dummy" ? "Dummy 바이럴(도달 목적)" : "서비스 소개(전환 목적)"}\n` +
      `[주제] ${tpl.title}\n` +
      `[요청] 아래 컷 구성을 그대로 따라 촬영/편집 가이드를 작성하고, 컷마다 필요한 소품·인원·촬영 팁을 알려줘.\n` +
      tpl.cuts.map(([v, c], i) => `${i + 1}컷(${TIMES[i][0]}~${TIMES[i][1]}초): ${v} / 자막: ${c}`).join("\n") +
      `\n[주의] 브랜드 톤을 유지하고, 개인정보·고객 정보가 노출되지 않게 해줘.`,
    asset_ids: [`E-0${10 + (tpl.format.length % 9)}`],
  };
}

/** 오늘의 카드 풀: 유형별로 [기본, 재생성1, 재생성2, ...] */
export function todayPool(type: CardType): Card[] {
  const tpls = tplsOf(type);
  const start = type === "dummy" ? 1 : 0;
  return tpls.map((_, k) => makeCard(tpls[(start + k) % tpls.length], TODAY, k));
}

// ── 포맷별 효과 (샘플용) ─────────────────────────
const FORMAT_EFFECT: Record<string, number> = {
  "신입 N시간": 1.9,
  "POV 직장인": 1.45,
  "N년차 vs 신입": 1.25,
  "밈 챌린지": 1.6,
  "비포/애프터": 0.95,
  "정보성 꿀팁": 0.65,
  "제작 과정 공개": 1.05,
};

const code = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 11 }, () => c[Math.floor(rand() * c.length)]).join("");
};

function metricsFor(views: number) {
  const r = () => 0.85 + rand() * 0.3;
  return {
    views: Math.round(views),
    reach: Math.round(views * 0.78 * r()),
    likes: Math.round(views * 0.035 * r()),
    comments: Math.round(views * 0.002 * r()),
    shares: Math.round(views * 0.006 * r()),
    saves: Math.round(views * 0.008 * r()),
  };
}

// ── 히스토리 생성 ───────────────────────────────
const HISTORY_DAYS = 30;
/** i일 전에 어떤 유형을 선택했는지 (최근엔 서비스 소개가 몰려 있는 시나리오) */
function selectedTypeFor(i: number): CardType | null {
  if (i % 9 === 0) return null; // 선택 안 한 날
  if (i >= 1 && i <= 4) return "service";
  if (i === 5) return "dummy";
  return i % 2 === 0 ? "dummy" : "service";
}

export const HISTORY_CARDS: Card[] = [];
export const SEED_EVENTS: CardEvent[] = [];
export const POSTS: Post[] = [];

const REASONS = ["촬영 불가", "톤이 안 맞음", "이미 했음", "재미없음", "기타"];

for (let i = HISTORY_DAYS; i >= 1; i--) {
  const date = ymd(addDays(TODAY_DATE, -i));
  const d = makeCard(DUMMY_TPLS[i % DUMMY_TPLS.length], date, 0);
  const s = makeCard(SERVICE_TPLS[(i + 1) % SERVICE_TPLS.length], date, 0);
  HISTORY_CARDS.push(d, s);

  const sel = selectedTypeFor(i);
  const at = (h: number) => new Date(`${date}T${String(h).padStart(2, "0")}:00:00+09:00`).toISOString();
  if (sel) {
    const chosen = sel === "dummy" ? d : s;
    const other = sel === "dummy" ? s : d;
    SEED_EVENTS.push({ id: `h${i}-sel`, card_id: chosen.card_id, action: "selected", at: at(10) });
    if (i % 3 === 0) {
      SEED_EVENTS.push({
        id: `h${i}-pass`,
        card_id: other.card_id,
        action: "passed",
        reason: REASONS[i % REASONS.length],
        at: at(10),
      });
    }
    const acc = ACCOUNTS[i % ACCOUNTS.length];
    const trend = chosen.type === "service" && i <= 4 ? 0.7 : 1;
    const views =
      acc.followers * 0.85 * lognormal(0.28) * (FORMAT_EFFECT[chosen.format] ?? 1) * trend;
    const post: Post = {
      id: `p-${i}`,
      account_id: acc.id,
      url: `https://www.instagram.com/reel/${code()}/`,
      caption: chosen.caption_draft,
      posted_at: at(19),
      card_id: chosen.card_id,
      format: chosen.format,
      type: chosen.type,
      metrics: metricsFor(views),
    };
    POSTS.push(post);
    SEED_EVENTS.push({ id: `h${i}-link`, card_id: chosen.card_id, action: "linked", post_url: post.url, at: at(20) });
  }
}

// 카드 없이 올린 일반 게시물 (계정 평균 기준선 계산용)
for (const acc of ACCOUNTS) {
  for (let k = 0; k < 9; k++) {
    const daysAgo = 1 + Math.floor(rand() * 75);
    const date = ymd(addDays(TODAY_DATE, -daysAgo));
    POSTS.push({
      id: `o-${acc.id}-${k}`,
      account_id: acc.id,
      url: `https://www.instagram.com/reel/${code()}/`,
      caption: "일반 게시물",
      posted_at: new Date(`${date}T${String(11 + Math.floor(rand() * 9)).padStart(2, "0")}:30:00+09:00`).toISOString(),
      card_id: null,
      format: null,
      type: null,
      metrics: metricsFor(acc.followers * 0.8 * lognormal(0.3)),
    });
  }
}

// URL 붙여넣기 데모용: 카드와 아직 연결되지 않은 최근 게시물 3개
export const DEMO_URLS = [
  "https://www.instagram.com/reel/DEMO0001abc/",
  "https://www.instagram.com/reel/DEMO0002def/",
  "https://www.instagram.com/reel/DEMO0003ghi/",
];
DEMO_URLS.forEach((url, k) => {
  const acc = ACCOUNTS[k];
  POSTS.push({
    id: `demo-${k}`,
    account_id: acc.id,
    url,
    caption: "(샘플) 카드 연결 전 게시물",
    posted_at: new Date(Date.now() - (k + 1) * 3600_000 * 5).toISOString(),
    card_id: null,
    format: null,
    type: null,
    metrics: metricsFor(acc.followers * 1.4 * lognormal(0.2)),
  });
});

POSTS.sort((a, b) => +new Date(a.posted_at) - +new Date(b.posted_at));
