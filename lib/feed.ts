import { sb, sbConfigured } from "@/lib/sb";
import { isVideoAlive } from "@/lib/feedVideo";

// Supabase `feed_items` 표: "의미 있는 둠스크롤" 피드(한 줄 = 릴스 한 편, 계획 v4).
// 서버에서만 읽는다(서버 키, lib/sb.ts). 칸 설명은 supabase/migrations/007_feed_items.sql.
// 채우는 쪽(피드 데이터 세션, 11-17): 매일 100편을 새로 쓰고 rank 1~100(국내·해외를 고르게 섞음)을 매긴다.
// 오늘 100편에서 빠진 옛 줄은 included = false로 돌린다. 걸러진 편(included = false)은 화면에 보이지 않는다.
// 가짜 데이터로 채우지 않는다: 표가 비었으면 "empty", 연결 정보가 없으면 "not_configured"를 돌려준다.

type Row = Record<string, unknown>;

/** 아이디어 후보 한 줄. 채우는 쪽이 줄 앞에 맞는 회사 계정을 [빡]·[칼티]·[무디]·[크리에이지 공식] 꼴로 붙인다. */
export type FeedIdea = { account: string | null; text: string };

export type FeedItem = {
  shortcode: string;
  /** 인스타 주소 */
  url: string;
  source: "domestic" | "foreign";
  username: string;
  caption: string;
  postedAt: string | null;
  plays: number | null;
  likes: number | null;
  comments: number | null;
  /** 공유 수. 국내만 있다(해외는 null). */
  shares: number | null;
  followers: number | null;
  durationSec: number | null;
  feedDate: string;
  rank: number | null;
  /** 편집 방법(2~3줄, 줄바꿈으로 나뉨) */
  editMethod: string;
  /** 훅 구조: 첫 몇 초에 무엇으로 붙잡는지(1~2줄) */
  hookStructure: string;
  /** 아이디어 후보(회사 계정 기준, 보통 5개) */
  ideas: FeedIdea[];
  /** 영상 주소. 읽을 때 이미 만료됐거나 없으면 null(화면은 인스타 퍼가기 창). */
  videoUrl: string | null;
  /** 영상 주소 만료 시각(ISO). 화면이 재생 직전에 한 번 더 견준다. */
  videoExpiresAt: string | null;
  /** 첫 장면 그림. 영상 주소와 함께 만료되므로 그때는 null. */
  thumbnailUrl: string | null;
  /** 인스타 공식 퍼가기 창 주소 */
  embedUrl: string;
};

export type FeedResult =
  | { status: "ok"; feedDate: string; items: FeedItem[] }
  | { status: "empty" }
  | { status: "not_configured" }
  | { status: "error" };

const COLS =
  "shortcode,url,source,username,caption,posted_at,plays,likes,comments,shares,followers,duration_sec," +
  "feed_date,rank,edit_method,hook_structure,ideas,video_url,thumbnail_url,video_url_expires_at";

const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
/** 칸 안 띄어쓰기를 고르고 줄바꿈은 남긴다(빈 줄은 하나로). */
const text = (v: unknown, max = 2000) =>
  String(v ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
const httpsOrNull = (v: unknown) => (typeof v === "string" && v.startsWith("https://") ? v : null);
const SHORTCODE = /^[A-Za-z0-9_-]{5,40}$/;
const ACCOUNT_TAG = /^\[([^\]\n]{1,24})\]\s*/;

/** `ideas` 칸(jsonb, 글 배열)을 [계정 + 글] 목록으로. 글이 JSON 문자열이나 객체로 와도 읽어 낸다. */
function toIdeas(v: unknown): FeedIdea[] {
  let arr: unknown = v;
  if (typeof v === "string") {
    try {
      arr = JSON.parse(v);
    } catch {
      arr = v.split(/\n+/);
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object") {
        const o = x as Row;
        return String(o.idea ?? o.title ?? o.text ?? "");
      }
      return "";
    })
    .map((s) => text(s, 300).replace(/\s+/g, " ").replace(/^(?:\d+[.)]|[-•·])\s*/, ""))
    .filter(Boolean)
    .map((s) => {
      const m = s.match(ACCOUNT_TAG);
      return m ? { account: m[1].trim(), text: s.slice(m[0].length).trim() } : { account: null, text: s };
    })
    .filter((i) => i.text);
}

function toItem(r: Row, now: number): FeedItem | null {
  const shortcode = String(r.shortcode ?? "");
  if (!SHORTCODE.test(shortcode)) return null;
  const url = httpsOrNull(r.url) ?? `https://www.instagram.com/reel/${shortcode}/`;
  const videoUrl = httpsOrNull(r.video_url);
  const thumb = httpsOrNull(r.thumbnail_url);
  const videoExpiresAt = r.video_url_expires_at == null ? null : String(r.video_url_expires_at);
  return {
    shortcode,
    url,
    source: r.source === "foreign" ? "foreign" : "domestic",
    username: text(r.username, 60),
    caption: text(r.caption, 1200),
    postedAt: r.posted_at == null ? null : String(r.posted_at),
    plays: numOrNull(r.plays),
    likes: numOrNull(r.likes),
    comments: numOrNull(r.comments),
    shares: numOrNull(r.shares),
    followers: numOrNull(r.followers),
    durationSec: numOrNull(r.duration_sec),
    feedDate: String(r.feed_date ?? ""),
    rank: numOrNull(r.rank),
    editMethod: text(r.edit_method, 800),
    hookStructure: text(r.hook_structure, 500),
    ideas: toIdeas(r.ideas),
    videoUrl: isVideoAlive(videoUrl, videoExpiresAt, now) ? videoUrl : null,
    videoExpiresAt,
    thumbnailUrl: isVideoAlive(thumb, videoExpiresAt, now) ? thumb : null,
    embedUrl: `https://www.instagram.com/reel/${shortcode}/embed/`,
  };
}

/** 가장 최근 피드 날짜(feed_date)에 피드에 나오는 편(included = true)을 피드 순위(rank) 순으로 limit편. */
export async function readFeed(limit = 100): Promise<FeedResult> {
  if (!sbConfigured()) return { status: "not_configured" };
  try {
    const [latest] = await sb<{ feed_date: string }[]>("feed_items", {
      params: { select: "feed_date", included: "eq.true", order: "feed_date.desc", limit: "1" },
    });
    if (!latest?.feed_date) return { status: "empty" };
    const rows = await sb<Row[]>("feed_items", {
      params: {
        select: COLS,
        feed_date: `eq.${latest.feed_date}`,
        included: "eq.true",
        order: "rank.asc.nullslast,shortcode.asc",
        limit: String(Math.min(200, Math.max(1, Math.floor(limit)))),
      },
    });
    const now = Date.now();
    const items = rows.map((r) => toItem(r, now)).filter((x): x is FeedItem => x !== null);
    if (!items.length) return { status: "empty" };
    return { status: "ok", feedDate: latest.feed_date, items };
  } catch (e) {
    console.error("[feed] feed_items 읽기 실패:", e instanceof Error ? e.message : e);
    return { status: "error" };
  }
}
