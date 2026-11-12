import type { CardType, PostWithScore } from "./types";
import { mean, median, mult } from "./format";

export interface Direction {
  lean: CardType | "balanced";
  headline: string;
  evidence: string[];
  confidence: "높음" | "보통" | "낮음";
  caveat?: string;
}

/**
 * 일일 방향성 제언 (규칙 기반 v1 — 전부 근거를 함께 반환).
 * 입력: 카드와 연결된 최근 게시물(성과 점수 포함)
 *
 * 규칙
 *  R1. 최근 7일 중 한 유형이 60% 이상 && 그 유형 평균 성과 < 0.9x  → 반대 유형 권장
 *  R2. 최근 7일 중 한 유형이 60% 이상 && 그 유형 평균 성과 ≥ 1.1x  → 흐름은 좋으나 편중, 다른 유형 병행 권장
 *  R3. 같은 유형 3연속 → 교대 권장
 *  R4. 최근 3개 게시물 모두 < 0.8x → 검증된 상위 포맷 재활용 권장
 *  그 외 → 균형 유지 + 상위 포맷 언급
 */
export function buildDirection(linked: PostWithScore[]): Direction {
  const sorted = linked
    .filter((p) => p.type)
    .sort((a, b) => +new Date(b.posted_at) - +new Date(a.posted_at));
  const week = sorted.filter((p) => Date.now() - +new Date(p.posted_at) <= 7 * 86400_000);
  const label = (t: CardType) => (t === "dummy" ? "Dummy" : "서비스 소개");
  const other = (t: CardType): CardType => (t === "dummy" ? "service" : "dummy");

  if (week.length < 3) {
    return {
      lean: "balanced",
      headline: "아직 근거가 부족해요. 두 유형을 번갈아 올리며 데이터를 쌓아보세요",
      evidence: [`최근 7일 카드 연동 게시물 ${week.length}개 (3개 미만)`],
      confidence: "낮음",
    };
  }

  const cnt = { dummy: 0, service: 0 };
  week.forEach((p) => (cnt[p.type as CardType] += 1));
  const dom: CardType = cnt.dummy >= cnt.service ? "dummy" : "service";
  const share = cnt[dom] / week.length;
  const domAvg = mean(week.filter((p) => p.type === dom).map((p) => p.multiple));
  const evidenceBase = `최근 7일 ${week.length}개 중 ${label(dom)} ${cnt[dom]}개 (${Math.round(share * 100)}%)`;
  const confidence: Direction["confidence"] = week.length >= 6 ? "높음" : week.length >= 4 ? "보통" : "낮음";

  let streak = 1;
  for (let i = 1; i < sorted.length && sorted[i].type === sorted[0].type; i++) streak++;

  const last3 = sorted.slice(0, 3);
  const last3Low = last3.length === 3 && last3.every((p) => p.multiple < 0.8);

  const top = [...new Map(sorted.filter((p) => p.format).map((p) => [p.format as string, 0])).keys()]
    .map((f) => ({ f, m: median(sorted.filter((p) => p.format === f).map((p) => p.multiple)), n: sorted.filter((p) => p.format === f).length }))
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.m - a.m)[0];

  if (share >= 0.6 && domAvg < 0.9) {
    const t = other(dom);
    return {
      lean: t,
      headline:
        t === "dummy"
          ? "지금은 정보성·소개형이 이어지며 반응이 식고 있어요. 오늘은 Dummy로 분위기를 환기해볼 때예요"
          : "Dummy 위주로 올렸는데 반응이 평소보다 낮아요. 오늘은 서비스 소개로 방향을 바꿔보세요",
      evidence: [
        evidenceBase,
        `${label(dom)} 평균 성과 ${mult(domAvg)} (계정 평균 대비, 1.0x 미만이면 평소보다 낮음)`,
        ...(streak >= 3 ? [`${label(sorted[0].type as CardType)} ${streak}연속 게시`] : []),
      ],
      confidence,
    };
  }

  if (share >= 0.6 && domAvg >= 1.1) {
    const t = other(dom);
    return {
      lean: "balanced",
      headline:
        t === "service"
          ? "Dummy로 도달이 잘 나오고 있어요. 이 반응을 서비스 소개로 연결할 타이밍이에요"
          : "서비스 소개 반응이 좋아요. Dummy를 섞어 계정 체온을 유지해보세요",
      evidence: [evidenceBase, `${label(dom)} 평균 성과 ${mult(domAvg)} — 흐름은 좋지만 한 유형에 쏠려 있음`],
      confidence,
      caveat: "한 유형이 계속 잘 나와도 편중되면 피로도가 쌓일 수 있어요.",
    };
  }

  if (streak >= 3) {
    const t = other(sorted[0].type as CardType);
    return {
      lean: t,
      headline: `${label(sorted[0].type as CardType)}가 ${streak}번 연속이에요. 오늘은 ${label(t)}로 바꿔보세요`,
      evidence: [`최근 게시 ${streak}개가 모두 ${label(sorted[0].type as CardType)}`, evidenceBase],
      confidence,
    };
  }

  if (last3Low && top) {
    return {
      lean: "balanced",
      headline: `최근 3개가 모두 평소보다 낮아요. 검증된 포맷 '${top.f}'를 다시 써보세요`,
      evidence: [`최근 3개 평균 성과 ${mult(mean(last3.map((p) => p.multiple)))}`, `'${top.f}' 중앙값 ${mult(top.m)} (n=${top.n})`],
      confidence,
    };
  }

  return {
    lean: "balanced",
    headline: top ? `균형이 좋아요. 지금 흐름을 유지하되 '${top.f}' 포맷이 강세예요` : "균형이 좋아요. 지금 흐름을 유지하세요",
    evidence: [evidenceBase, ...(top ? [`'${top.f}' 중앙값 ${mult(top.m)} (n=${top.n})`] : [])],
    confidence,
  };
}
