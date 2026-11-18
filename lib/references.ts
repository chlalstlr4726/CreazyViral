// 경쟁사 레퍼런스 한 편의 데이터 형태(계약). 앞단(DB/분석 API)이 이 모양으로 내려주면 화면이 그대로 그려집니다.
// 명세: docs/REFERENCE_API.md

export const CATEGORIES = ["직접 경쟁사(AI 상세페이지)", "AI SaaS", "디자인 툴/서비스", "셀러/커머스", "마케팅 꿀팁", "기타(포맷만 참고)"] as const;
export type RefCategory = (typeof CATEGORIES)[number];
export type RefRegion = "국내" | "해외";

export interface ViralReference {
  id: string;
  url: string; // 릴스 링크
  username: string; // 올린 계정(@ 없이)
  posted_at: string; // 올린 날짜 ISO
  plays: number; // 조회수
  usual_plays: number | null; // 그 계정 평소 조회수(최근 릴스 중앙값 등). 없으면 null
  multiple?: number | null; // 평소 대비 배수. 없으면 화면에서 plays / usual_plays 로 계산
  followers: number | null; // 팔로워 수
  category: RefCategory; // 분류
  region: RefRegion; // 국내/해외
  hook_3s: string; // 첫 3초 문장(자막이나 말)
  duration_s: number; // 길이(초)
  flow: string; // 내용 전개 한 줄
  cta: string; // CTA (없으면 빈 문자열)
  is_ad: boolean | null; // 광고 여부(모르면 null)
  reason: string; // 추천 이유 한 줄
  format_key?: string | null; // 같은 형식·소재 묶음 키 (예: "비포애프터 시연"). 여러 계정에서 같은 키면 '반복'으로 표시
}

export const multipleOf = (r: ViralReference): number | null => {
  if (r.multiple != null) return r.multiple;
  return r.usual_plays && r.usual_plays > 0 ? r.plays / r.usual_plays : null;
};
