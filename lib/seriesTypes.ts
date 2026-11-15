export const SERIES_CRITERIA = [
  { key: "evidence", label: "릴스 근거와 적용 가능성", weight: 35 },
  { key: "fit", label: "테르밋·Creazy 적합성", weight: 25 },
  { key: "originality", label: "참신함", weight: 20 },
  { key: "repeatability", label: "시리즈 지속성", weight: 20 },
] as const;

type Criterion = (typeof SERIES_CRITERIA)[number]["key"];

export interface SeriesRecommendation {
  name: string;
  concept: string;
  audience: string;
  rationale: string;
  recurringFormat: string;
  episodes: { title: string; hook: string; storyboard: string; nextEpisode: string }[];
  evidence: { username: string; url: string; plays: number; multiple: number | null }[];
  scores: Record<Criterion, number>;
  total: number;
}

export interface SeriesRun {
  candidateCount: number;
  recommendations: SeriesRecommendation[];
  createdAt: string;
}
