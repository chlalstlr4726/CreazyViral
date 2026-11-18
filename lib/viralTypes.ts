// 홈 Top 5·채팅이 쓰는 바이럴 릴스 한 편의 모양. 실제 데이터(daily_recs, reels)에서만 채운다.
export interface ViralReel {
  id: string; url: string; user: string; caption: string;
  plays: number; likes: number; comments: number; shares: number;
  at: string; sec: number; music: string; kw: string;
  // DB(reels)에서 올 때만 채워지는 분석값
  followers?: number; reach_x?: number; reason?: string; paid?: boolean | null;
  // daily_recs(매일 승인 추천)에서 올 때만 채워지는 값
  rank?: number; recDate?: string; multiple?: number | null; caution?: string | null; aiMade?: "예" | "아니오" | "모름" | null; hook?: string;
  // daily_recs의 깊은 분석 칸(11-15 추천 줄에 들어 있음). 비어 있으면 undefined
  hookFormula?: string; // 훅 공식 이름(회사 사전)
  storyStructure?: string; // 이야기 구조(회사 사전)
  displayStyle?: string; // 화면 구성(회사 사전)
  sameFormatAccounts?: number | null; // 같은 포맷을 쓴 서로 다른 계정 수
  flow?: string; // 이야기 전개 한 줄
  cta?: string; // 영상 끝에 하라는 말
  usualPlays?: number | null; // 평소 조회수(최근 릴스 중앙값)
}
