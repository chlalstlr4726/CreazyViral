// 샘플 데이터 — Supabase 연결 전까지 화면/로직 검증용.
// 실제 연동 시 lib/repo.ts의 함수들만 DB 조회로 교체하면 된다.
import type { Card, CardEvent, CardType, IgAccount, Post } from "./types";
import { ACCOUNT_BY_ID, ACCOUNT_PROFILES, type AccountId } from "./accounts";
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

// ── 계정 (운영 중인 메인 3개) ──────────────────
// 팔로워 수는 아직 실제 연결 전이라 샘플 값입니다 (성과 샘플 데이터를 만드는 데만 사용).
const SAMPLE_FOLLOWERS: Record<AccountId, number> = { moodiee: 6400, creazy: 11800, bbakk: 18200 };
export const ACCOUNTS: IgAccount[] = ACCOUNT_PROFILES.map((a) => ({
  id: a.id,
  handle: a.handle,
  name: a.name,
  followers: SAMPLE_FOLLOWERS[a.id],
  status: "connected" as const,
  color: a.color,
}));

// ── 카드 템플릿 (승원 API가 대체할 부분) ─────────
// 계정마다 Dummy 바이럴 2개 + 서비스 소개 2개. 소재는 lib/accounts.ts 의 소재 ID를 가리킨다.
interface Tpl {
  account: AccountId;
  type: CardType;
  format: string;
  title: string;
  difficulty: 1 | 2 | 3;
  audio: string;
  commercial: boolean;
  material: string;
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
  // ───────── 무디 (moodiee.ai) — 나레이션 없이 자막·화면, 온라인 셀러 대상 ─────────
  {
    account: "moodiee",
    type: "dummy",
    format: "POV 셀러",
    title: "POV: 사장님이 ‘상세페이지 내일까지’ 라고 했을 때",
    difficulty: 1,
    audio: "Panic At 6PM",
    commercial: true,
    material: "mo-2",
    cuts: [
      ["캐릭터가 메신저 알림을 받고 굳는 컷", "사장님: 상세페이지 내일까지요~"],
      ["빈 캔버스 앞에서 시계만 보는 컷", "(디자인 경험 0)"],
      ["화면 녹화: 제품 사진 올리고 초안이 생성되는 장면", "근데 이게 되네요"],
      ["캐릭터가 글자를 클릭해 바로 고치는 컷", "수정도 그 자리에서"],
      ["완성 페이지를 스크롤해서 보여 주기", "퇴근 시간 지킴"],
    ],
    caption: "상세페이지 급하게 필요할 때 보세요 (댓글에 ‘링크’ 남기면 DM으로 보내드려요)",
    tags: ["상세페이지", "온라인셀러", "스마트스토어", "쇼핑몰운영", "AI툴"],
  },
  {
    account: "moodiee",
    type: "dummy",
    format: "디자이너 vs AI",
    title: "디자이너 vs AI, 어느 쪽이 AI가 만든 걸까?",
    difficulty: 2,
    audio: "Blind Test Beat",
    commercial: true,
    material: "mo-3",
    cuts: [
      ["두 개의 상세페이지를 좌우로 놓고 시작", "둘 중 AI가 만든 건?"],
      ["왼쪽 페이지 확대 — 섹션을 천천히 스크롤", "A"],
      ["오른쪽 페이지 확대 — 같은 속도로 스크롤", "B"],
      ["정답 공개: 제작 화면을 되감기로 보여 주기", "정답은…"],
      ["캐릭터가 댓글 유도 제스처", "여러분은 맞히셨나요?"],
    ],
    caption: "맞히셨다면 댓글로 A/B 남겨 주세요",
    tags: ["디자이너vsAI", "블라인드테스트", "상세페이지", "온라인셀러", "AI디자인"],
  },
  {
    account: "moodiee",
    type: "service",
    format: "기능 한 줄 시연",
    title: "피그마·포토샵 없이 3분 상세페이지 (수정은 나중에 포토샵으로도 가능)",
    difficulty: 2,
    audio: "Clean Beat",
    commercial: true,
    material: "mo-2",
    cuts: [
      ["타이머 00:00에서 시작, 빈 화면", "피그마·포토샵 없이 3분"],
      ["제품 정보 입력 → 초안 생성 화면 녹화", "제품 정보만 넣고"],
      ["섹션 순서 바꾸고 문구 수정하는 화면", "마음에 안 드는 곳만 고치고"],
      ["타이머 03:00에서 완성 페이지 공개", "3분 완성"],
      ["‘나중에 포토샵으로 이어서 고칠 수도 있어요’ 자막", "포토샵 내보내기도 가능"],
    ],
    caption: "3분 만에 상세페이지 한 장 (댓글에 ‘3분’ 남겨 주세요)",
    tags: ["상세페이지", "AI툴", "온라인셀러", "스마트스토어", "쇼핑몰창업"],
  },
  {
    account: "moodiee",
    type: "service",
    format: "레퍼런스 캡처",
    title: "‘이 페이지처럼 해 주세요’ 받으면, 캡처 올리고 끝",
    difficulty: 1,
    audio: "Easy Morning",
    commercial: true,
    material: "mo-3",
    cuts: [
      ["메신저 화면: 고객이 참고 페이지 캡처를 보냄", "“이 페이지처럼 해 주세요”"],
      ["캐릭터가 난감한 표정", "(막막)"],
      ["화면 녹화: 캡처 이미지를 올리는 장면", "캡처를 올리면"],
      ["그 형태대로 새 섹션이 만들어지는 장면", "그 형태대로 새 섹션이 생겨요"],
      ["우리 제품 내용으로 채워진 결과 화면", "내용은 내 제품으로"],
    ],
    caption: "레퍼런스 받은 의뢰, 이렇게 시작하세요",
    tags: ["상세페이지", "레퍼런스", "온라인셀러", "AI툴", "디자인"],
  },

  // ───────── 크리에이지 공식 (creazy.app) — 팀이 얼굴을 내는 브랜딩 ─────────
  {
    account: "creazy",
    type: "dummy",
    format: "신입 N시간",
    title: "입사 N시간차 신입이 만든 상세페이지 (시간·개수는 촬영한 그대로)",
    difficulty: 2,
    audio: "Morning Rush (Remix)",
    commercial: true,
    material: "cr-1",
    cuts: [
      ["출근 문 앞, 벽시계 클로즈업", "입사 ○시간차"],
      ["선배가 노트북을 건네며 첫 업무 전달", "첫 업무가 이거라고요?"],
      ["화면 녹화: 제품명을 입력하는 장면", "제품명만 넣었더니"],
      ["초안이 나오자 동료들이 모여드는 컷", "초안이 나왔는데요…"],
      ["완성 페이지와 실제 걸린 시간을 자막으로", "걸린 시간 ○분 (실제 값으로 교체)"],
    ],
    caption: "신입 직원 시리즈 1편 — 시간·개수는 실제 촬영값 그대로 올려 주세요",
    tags: ["신입", "직장인브이로그", "첫출근", "상세페이지", "크리에이지"],
  },
  {
    account: "creazy",
    type: "dummy",
    format: "POV 팀",
    title: "POV: 대표님이 ‘이번 주 안에 상품 다 올리자’ 했을 때",
    difficulty: 1,
    audio: "Panic At 6PM",
    commercial: true,
    material: "cr-9",
    cuts: [
      ["회의실, 대표님이 폭탄 발언하는 컷(팀원 시점)", "대표님: 이번 주 안에 다 올리죠"],
      ["팀원들이 서로 눈치 보는 컷", "(침묵)"],
      ["한 팀원이 노트북을 열고 채팅창에 요청 입력", "일단 채팅으로 고쳐 볼게요"],
      ["화면 녹화: 채팅 한 줄로 문구·이미지가 바뀜", "한 줄이면 수정 끝"],
      ["팀원 전원이 하이파이브", "다음 주제 가져오세요"],
    ],
    caption: "이런 팀 분위기 좋아하시나요? #크리에이지",
    tags: ["직장인공감", "POV", "스타트업", "상세페이지", "크리에이지"],
  },
  {
    account: "creazy",
    type: "service",
    format: "1분 시연",
    title: "제품명만 입력하면 1분 만에 기획+디자인 초안",
    difficulty: 1,
    audio: "Clean Beat",
    commercial: true,
    material: "cr-6",
    cuts: [
      ["빈 입력창 클로즈업, 타이머 00:00", "제품명만 넣어 볼게요"],
      ["제품명을 타이핑하는 화면 녹화", "(제품명 입력)"],
      ["기획 → 디자인 초안이 만들어지는 화면 빨리감기", "기획부터 디자인까지"],
      ["타이머 01:00에서 초안 공개", "1분 만에 초안"],
      ["링크 안내 카드", "무료 체험은 프로필 링크에서"],
    ],
    caption: "제품명만 넣어도 초안이 나와요. 지금 해 보세요",
    tags: ["상세페이지", "AI툴", "온라인셀러", "크리에이지", "1분시연"],
  },
  {
    account: "creazy",
    type: "service",
    format: "업종별 시연",
    title: "업종별 1분 시연 시리즈 — 화장품 편",
    difficulty: 2,
    audio: "Behind The Scenes",
    commercial: true,
    material: "cr-8",
    cuts: [
      ["화장품 제품 사진 한 장 클로즈업", "화장품 상세페이지, 1분 시연"],
      ["제품 사진과 제품명 입력 장면", "사진 올리고 제품명 입력"],
      ["생성되는 섹션을 위에서 아래로 스크롤", "성분·사용법 섹션까지 자동으로"],
      ["문구 한 곳을 클릭해 바로 수정", "문구는 글자를 눌러 바로 수정"],
      ["다음 업종 예고 카드(식품·전자제품)", "다음 업종은 댓글로 골라 주세요"],
    ],
    caption: "다음엔 어떤 업종을 해 볼까요? 댓글로 알려 주세요",
    tags: ["상세페이지", "화장품", "업종별시연", "AI툴", "크리에이지"],
  },

  // ───────── 빡 (bbakk_creazy) — 경빈님 얼굴 강사 페르소나 ─────────
  {
    account: "bbakk",
    type: "dummy",
    format: "공감 POV",
    title: "야근하던 상세페이지, AI한테 시켜 봤다",
    difficulty: 1,
    audio: "Panic At 6PM",
    commercial: true,
    material: "bb-5",
    cuts: [
      ["늦은 밤 사무실, 모니터 앞에서 지친 표정", "야근 중… 상세페이지 아직 못 끝냄"],
      ["손으로 얼굴을 쓸어내리는 컷", "(한숨)"],
      ["AI 툴에 제품 정보를 넣는 화면 녹화", "AI한테 맡겨 봤더니"],
      ["초안이 나오자 놀라는 표정(강사 얼굴)", "이게 된다고요?"],
      ["손목시계를 가리키며 퇴근하는 컷", "이거 진작 알았으면…"],
    ],
    caption: "상세페이지 야근하는 분들 보세요. 방법은 무료 라이브에서 알려드려요",
    tags: ["상세페이지", "AI툴", "직장인공감", "디자이너", "야근"],
  },
  {
    account: "bbakk",
    type: "dummy",
    format: "디자이너 vs AI",
    title: "외주 디자이너 결과물 vs AI 결과물, 맞혀 보세요",
    difficulty: 2,
    audio: "Blind Test Beat",
    commercial: true,
    material: "bb-2",
    cuts: [
      ["강사가 두 개의 상세페이지를 양손으로 가리키며 등장", "둘 중 AI가 만든 건 어느 쪽일까요?"],
      ["A 페이지 스크롤", "A"],
      ["B 페이지 스크롤", "B"],
      ["강사가 제작 화면을 돌려 보여 주며 정답 공개", "정답은 이쪽입니다"],
      ["강사가 카메라를 보며 마무리", "어디가 달랐는지는 라이브에서 알려드려요"],
    ],
    caption: "A/B 중 골라서 댓글 남겨 주세요",
    tags: ["디자이너vsAI", "블라인드테스트", "상세페이지", "AI디자인", "강의"],
  },
  {
    account: "bbakk",
    type: "service",
    format: "라이브 안내",
    title: "매주 저녁 무료 라이브, 상세페이지 이렇게 만듭니다",
    difficulty: 2,
    audio: "Clean Beat",
    commercial: true,
    material: "bb-6",
    cuts: [
      ["강사가 화면 앞에서 정면으로 인사", "상세페이지, 돈 주고 듣지 마세요"],
      ["라이브에서 다루는 내용 3가지를 카드로", "이번 라이브에서 보여드릴 것"],
      ["지난 라이브 화면 일부(허락받은 화면만)", "이렇게 같이 만들어요"],
      ["강사의 마무리 멘트", "무료예요"],
      ["신청 방법 안내 카드", "프로필 링크에서 신청 (일정은 올리기 전 확인)"],
    ],
    caption: "무료 라이브 신청은 프로필 링크에서",
    tags: ["무료강의", "상세페이지", "AI강의", "온라인셀러", "라이브"],
  },
  {
    account: "bbakk",
    type: "service",
    format: "툴 조합 시연",
    title: "AI 툴 두 개로 상세페이지 한 장 끝내기 (시연)",
    difficulty: 2,
    audio: "Behind The Scenes",
    commercial: true,
    material: "bb-3",
    cuts: [
      ["강사가 두 개의 툴 로고 없이 ‘툴 A + 툴 B’ 카드를 보여 줌", "툴 두 개면 충분해요"],
      ["툴 A에서 문구·구성을 만드는 화면", "먼저 구성부터"],
      ["툴 B에서 디자인을 입히는 화면", "그다음 디자인"],
      ["완성된 페이지를 스크롤", "완성"],
      ["강사의 마무리", "순서는 라이브에서 같이 해 봐요"],
    ],
    caption: "툴 조합 순서가 궁금하면 댓글 남겨 주세요",
    tags: ["상세페이지", "AI툴", "툴조합", "강의", "온라인셀러"],
  },
];

export const tplsOf = (type: CardType, account: AccountId) => TEMPLATES.filter((t) => t.type === type && t.account === account);

export function makeCard(tpl: Tpl, date: string, regen: number): Card {
  const n = 3 + Math.floor(rand() * 6);
  const acc = ACCOUNT_BY_ID[tpl.account];
  return {
    card_id: `${date}-${tpl.type}-${tpl.account}-${regen}`,
    account_id: tpl.account,
    date,
    type: tpl.type,
    title: tpl.title,
    format: tpl.format,
    rationale: `최근 수집한 바이럴 ${n}건에서 ‘${tpl.format}’ 구조가 반복돼요 · ${acc.name} 컨셉에 맞게 바꿨어요 (샘플)`,
    difficulty: tpl.difficulty,
    audio: { name: tpl.audio, commercial_ok: tpl.commercial },
    storyboard: tpl.cuts.map(([visual, caption], i) => ({
      cut: i + 1,
      start_s: TIMES[i][0],
      end_s: TIMES[i][1],
      visual,
      caption,
      note: i === 0 ? "훅 — 레퍼런스 훅 구조 차용" : i === 2 ? "음원 비트 포인트에 컷 전환" : undefined,
    })),
    references: [
      { url: "https://www.instagram.com/reel/REF0001/", role: "hook" },
      { url: "https://www.instagram.com/reel/REF0002/", role: "structure" },
      { url: "https://www.instagram.com/reel/REF0003/", role: "edit" },
    ],
    caption_draft: tpl.caption,
    hashtags: tpl.tags,
    prompt:
      `[역할] 너는 @${acc.handle}(${acc.name}) 계정의 숏폼 콘텐츠 제작 도우미야.\n` +
      `[계정 컨셉] ${acc.concept.summary}\n` +
      `[포맷] ${tpl.format} / [유형] ${tpl.type === "dummy" ? "Dummy 바이럴(도달 목적)" : "서비스 소개(전환 목적)"}\n` +
      `[주제] ${tpl.title}\n` +
      `[요청] 아래 컷 구성을 그대로 따라 촬영/편집 가이드를 작성하고, 컷마다 필요한 소품·인원·촬영 팁을 알려줘.\n` +
      tpl.cuts.map(([v, c], i) => `${i + 1}컷(${TIMES[i][0]}~${TIMES[i][1]}초): ${v} / 자막: ${c}`).join("\n") +
      `\n[주의] 계정 규칙을 지켜 줘: ${acc.concept.rules}`,
    asset_ids: [tpl.material],
  };
}

/** 오늘의 카드 풀(계정·유형별): [기본, 재생성1, 재생성2, ...] */
export function todayPool(type: CardType, account: AccountId): Card[] {
  const tpls = tplsOf(type, account);
  return tpls.map((_, k) => makeCard(tpls[k % tpls.length], TODAY, k));
}

// ── 포맷별 효과 (샘플용) ─────────────────────────
const FORMAT_EFFECT: Record<string, number> = {
  "POV 셀러": 1.5,
  "디자이너 vs AI": 1.7,
  "기능 한 줄 시연": 1.0,
  "레퍼런스 캡처": 0.9,
  "신입 N시간": 1.9,
  "POV 팀": 1.4,
  "1분 시연": 1.1,
  "업종별 시연": 0.8,
  "공감 POV": 1.5,
  "라이브 안내": 0.7,
  "툴 조합 시연": 1.1,
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

ACCOUNT_PROFILES.forEach((acct, ai) => {
for (let i = HISTORY_DAYS; i >= 1; i--) {
  const date = ymd(addDays(TODAY_DATE, -i));
  const dt = tplsOf("dummy", acct.id);
  const st = tplsOf("service", acct.id);
  const d = makeCard(dt[(i + ai) % dt.length], date, 0);
  const s = makeCard(st[(i + ai + 1) % st.length], date, 0);
  HISTORY_CARDS.push(d, s);

  const sel = selectedTypeFor(i + ai * 2);
  const at = (h: number) => new Date(`${date}T${String(h).padStart(2, "0")}:00:00+09:00`).toISOString();
  if (sel) {
    const chosen = sel === "dummy" ? d : s;
    const other = sel === "dummy" ? s : d;
    SEED_EVENTS.push({ id: `h${acct.id}${i}-sel`, card_id: chosen.card_id, action: "selected", at: at(10) });
    if (i % 3 === 0) {
      SEED_EVENTS.push({
        id: `h${acct.id}${i}-pass`,
        card_id: other.card_id,
        action: "passed",
        reason: REASONS[i % REASONS.length],
        at: at(10),
      });
    }
    const acc = ACCOUNTS[ai];
    const trend = chosen.type === "service" && i <= 4 ? 0.7 : 1;
    const views =
      acc.followers * 0.85 * lognormal(0.28) * (FORMAT_EFFECT[chosen.format] ?? 1) * trend;
    const post: Post = {
      id: `p-${acct.id}-${i}`,
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
    SEED_EVENTS.push({ id: `h${acct.id}${i}-link`, card_id: chosen.card_id, action: "linked", post_url: post.url, at: at(20) });
  }
}
});

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
