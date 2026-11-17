// 홈 Top 5·채팅이 쓰는 바이럴 릴스 한 편의 모양. 실제 데이터(daily_recs, reels)에서만 채운다.
export interface ViralReel {
  id: string; url: string; user: string; caption: string;
  plays: number; likes: number; comments: number; shares: number;
  at: string; sec: number; music: string; kw: string;
  // DB(reels)에서 올 때만 채워지는 분석값
  followers?: number; reach_x?: number; reason?: string; paid?: boolean | null;
  // daily_recs(매일 승인 추천)에서 올 때만 채워지는 값
  rank?: number; recDate?: string; multiple?: number | null; caution?: string | null; aiMade?: "예" | "아니오" | "모름" | null; hook?: string;
}
