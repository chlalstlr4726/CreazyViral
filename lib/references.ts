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

const d = (daysAgo: number) => new Date(Date.now() - (daysAgo - 0.5) * 86_400_000).toISOString();

// 화면 확인용 샘플(가상의 계정). 실제 데이터가 연결되면 loadReferences()만 교체하세요.
const SAMPLE: ViralReference[] = [
  { id: "s1", url: "https://www.instagram.com/reel/SAMPLE1/", username: "sample_detail_ai", posted_at: d(1), plays: 1_240_000, usual_plays: 62_000, followers: 48_000, category: "직접 경쟁사(AI 상세페이지)", region: "국내", hook_3s: "디자이너한테 50만 원 주던 상세페이지, 3분 만에 끝났어요", duration_s: 28, flow: "타이머를 켜고 상품 사진 한 장으로 상세페이지가 완성될 때까지 화면 녹화", cta: "댓글에 '상세'를 남기면 DM으로 링크 발송", is_ad: false, reason: "평소 대비 20배. 같은 비포애프터 시연 형식이 다른 계정에서도 터지는 중", format_key: "타이머 시연" },
  { id: "s2", url: "https://www.instagram.com/reel/SAMPLE2/", username: "sample_seller_tip", posted_at: d(2), plays: 780_000, usual_plays: 90_000, followers: 31_000, category: "셀러/커머스", region: "국내", hook_3s: "스마트스토어 첫 달에 이거 안 하면 망합니다", duration_s: 21, flow: "실수 3가지를 자막으로 하나씩 보여주고 마지막에 해결 화면", cta: "저장해두고 하나씩 체크하세요", is_ad: false, reason: "평소 대비 8.7배. 짧은 체크리스트형이라 우리 소재로 바꾸기 쉬움", format_key: "실수 체크리스트" },
  { id: "s3", url: "https://www.instagram.com/reel/SAMPLE3/", username: "sample_ai_saas", posted_at: d(3), plays: 2_100_000, usual_plays: 310_000, followers: 120_000, category: "AI SaaS", region: "해외", hook_3s: "This one prompt replaced my whole design team", duration_s: 34, flow: "프롬프트 한 줄 입력 후 결과물이 연달아 생성되는 화면", cta: "프로필 링크에서 무료 체험", is_ad: true, reason: "평소 대비 6.8배. 광고 영상이라 구조만 참고(문구는 그대로 쓰지 않기)", format_key: "타이머 시연" },
  { id: "s4", url: "https://www.instagram.com/reel/SAMPLE4/", username: "sample_design_tool", posted_at: d(4), plays: 540_000, usual_plays: 120_000, followers: 76_000, category: "디자인 툴/서비스", region: "국내", hook_3s: "피그마 없이 이 정도까지 된다고?", duration_s: 17, flow: "툴 두 개를 이어 붙여 같은 결과를 내는 과정을 빠르게 비교", cta: "", is_ad: false, reason: "평소 대비 4.5배. 툴 비교형이 무디 컨셉과 맞음", format_key: "툴 비교" },
  { id: "s5", url: "https://www.instagram.com/reel/SAMPLE5/", username: "sample_marketing", posted_at: d(5), plays: 960_000, usual_plays: 140_000, followers: 52_000, category: "마케팅 꿀팁", region: "국내", hook_3s: "광고비 0원으로 첫 주문 받는 법", duration_s: 26, flow: "질문 한 줄, 방법 3단계, 실제 주문 알림 화면으로 마무리", cta: "다음 편 보려면 팔로우", is_ad: false, reason: "평소 대비 6.9배. 숫자 훅과 결과 화면으로 끝내는 구조", format_key: "실수 체크리스트" },
  { id: "s6", url: "https://www.instagram.com/reel/SAMPLE6/", username: "sample_detail_ai2", posted_at: d(6), plays: 430_000, usual_plays: 55_000, followers: 22_000, category: "직접 경쟁사(AI 상세페이지)", region: "국내", hook_3s: "상세페이지 외주 견적이 이상해서 직접 만들어봤어요", duration_s: 31, flow: "외주 견적서를 보여주고 같은 상세페이지를 AI로 만드는 화면 녹화", cta: "댓글로 업종을 알려주면 다음 편에서 만들어드려요", is_ad: false, reason: "평소 대비 7.8배. 견적서 비교로 시작해 공감과 결과를 한 번에 보여줌", format_key: "타이머 시연" },
  { id: "s7", url: "https://www.instagram.com/reel/SAMPLE7/", username: "sample_daily", posted_at: d(2), plays: 3_400_000, usual_plays: 800_000, followers: 410_000, category: "기타(포맷만 참고)", region: "해외", hook_3s: "POV: you finally hit publish", duration_s: 9, flow: "자막 한 줄과 빠른 컷 전환만 쓰는 9초짜리 POV", cta: "", is_ad: false, reason: "평소 대비 4.3배. 내용과 무관하게 컷 전환 박자만 참고할 만함", format_key: null },
];

/** 레퍼런스 목록. 지금은 샘플. DB/분석 API가 준비되면 이 함수만 교체. */
export async function loadReferences(): Promise<{ items: ViralReference[]; sample: boolean }> {
  return { items: SAMPLE, sample: true };
}
