// ─────────────────────────────────────────────
// 데이터 계약 (승원 카드 API ↔ 대시보드 ↔ Supabase)
// ─────────────────────────────────────────────

export type CardType = "dummy" | "service";

export interface StoryboardCut {
  cut: number;
  start_s: number;
  end_s: number;
  visual: string; // 화면·촬영
  caption: string; // 자막/멘트
  note?: string; // 비고
}

/** 승원 API가 내려주는 카드. 상세 내용(스토리보드·프롬프트)은 승원 파트. */
export interface Card {
  card_id: string; // 예: 2026-11-13-dummy-0  (마지막 숫자 = 재생성 회차)
  date: string; // YYYY-MM-DD
  type: CardType;
  title: string;
  format: string; // 포맷명 — 포맷별 성과 집계의 키
  rationale: string; // 선정 근거 (도하 점수 기반)
  difficulty: 1 | 2 | 3;
  audio: { name: string; commercial_ok: boolean };
  storyboard: StoryboardCut[];
  references: { url: string; role: "hook" | "structure" | "edit" }[];
  caption_draft: string;
  hashtags: string[];
  prompt: string; // 구체적 프롬프트
  asset_ids: string[]; // 사용한 회사 소재 ID
}

export type EventAction = "selected" | "passed" | "regenerated" | "linked";

export const PASS_REASONS = ["촬영 불가", "톤이 안 맞음", "이미 했음", "재미없음", "기타"] as const;
export type PassReason = (typeof PASS_REASONS)[number];

/** 피드백 루프의 핵심 로그. DB의 card_events 테이블과 1:1 */
export interface CardEvent {
  id: string;
  card_id: string;
  action: EventAction;
  reason?: string;
  post_url?: string;
  at: string; // ISO
}

export interface IgAccount {
  id: string;
  handle: string;
  name: string;
  followers: number;
  status: "connected" | "expired" | "pending";
  color: string;
}

export interface PostMetrics {
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface Post {
  id: string;
  account_id: string;
  url: string;
  caption: string;
  posted_at: string; // ISO
  card_id: string | null;
  format: string | null; // 연결된 카드의 포맷 (없으면 null)
  type: CardType | null;
  metrics: PostMetrics;
}

export interface PostWithScore extends Post {
  baseline: number; // 같은 계정의 직전 게시물 조회수 중앙값
  multiple: number; // views / baseline
}
