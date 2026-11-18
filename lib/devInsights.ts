import type { Card, CardEvent, PostWithScore } from "./types";
import { formatStats } from "./analytics";
import { mult } from "./format";

export interface DevMessage {
  to: "도하" | "승원";
  priority: "높음" | "보통";
  title: string;
  suggestion: string; // 개발자에게 전하는 수정 제안
  evidence: string[]; // 근거 (수치)
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/**
 * 쌓인 피드백(card_events) + 성과(posts)로 도하(점수/분석)/승원(카드 생성 API)에게 보낼 제안을 만든다.
 * 모든 제안은 표본 수 기준(MIN_N)을 넘을 때만 나온다.
 */
export function buildDevMessages(args: { cards: Card[]; events: CardEvent[]; posts: PostWithScore[] }): DevMessage[] {
  const { cards, events, posts } = args;
  const out: DevMessage[] = [];

  const selectedIds = new Set(events.filter((e) => e.action === "selected").map((e) => e.card_id));
  const passes = events.filter((e) => e.action === "passed");
  const regens = events.filter((e) => e.action === "regenerated");
  const shown = cards.length + regens.length;

  // ── 패스 사유 → 승원/도하 ───────────────────
  const reasonCount = new Map<string, number>();
  passes.forEach((e) => reasonCount.set(e.reason ?? "기타", (reasonCount.get(e.reason ?? "기타") ?? 0) + 1));
  const topReason = [...reasonCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (passes.length >= 5 && topReason) {
    const [reason, n] = topReason;
    const share = pct(n, passes.length);
    const evidence = [`패스 ${passes.length}건 중 '${reason}' ${n}건 (${share}%)`];
    const map: Record<string, { to: DevMessage["to"]; title: string; suggestion: string }> = {
      "촬영 불가": {
        to: "승원",
        title: "촬영 난이도/자원 제약을 생성 단계에서 하드 제약으로",
        suggestion:
          "회사 정보 리스트의 ‘촬영 가능 인원/공간/소품’을 프롬프트에 필수 제약으로 넣고, difficulty가 3인 카드는 하루 1장 이하로 제한해 주세요. 제약을 못 지킨 카드는 반환 전 자체 검증으로 걸러주세요.",
      },
      "톤이 안 맞음": {
        to: "승원",
        title: "브랜드 톤 가이드를 few-shot으로 보강",
        suggestion: "채택된 카드의 제목/훅/자막 3~5개를 ‘브랜드 톤 예시’로 프롬프트에 넣고, 패스된 카드는 ‘피해야 할 톤’ 예시로 넣어주세요 (card_events에서 조회 가능).",
      },
      "이미 했음": {
        to: "승원",
        title: "최근 소재/포맷 중복 방지 입력 추가",
        suggestion: "생성 요청에 ‘최근 14일 사용한 asset_ids와 format’을 함께 넘기고 중복을 금지해 주세요. 대시보드가 이 목록을 API로 제공할 수 있어요 (v_card_feedback).",
      },
      재미없음: {
        to: "도하",
        title: "레퍼런스 선정 임계치 상향 + 훅 강도 점수화",
        suggestion: "‘재미없음’ 패스가 많다면 후보 레퍼런스의 이상치 기준이 느슨할 수 있어요. 이상치 임계치를 올리고, 첫 3초 훅 강도(자막/움직임/반전 유무)를 별도 점수로 만들어 가중해 주세요.",
      },
    };
    const m = map[reason];
    if (m) out.push({ ...m, priority: share >= 35 ? "높음" : "보통", evidence });
    else out.push({ to: "승원", priority: "보통", title: "‘기타’ 패스 사유 구체화 필요", suggestion: "기타 사유가 가장 많아요. 대시보드에서 자유 입력을 받아 분류할 수 있게 하겠습니다. 분류 결과를 생성 프롬프트에 반영해 주세요.", evidence });
  }

  // ── 재생성 비율 → 승원 ──────────────────────
  if (shown >= 20 && regens.length / shown >= 0.15) {
    out.push({
      to: "승원",
      priority: "높음",
      title: "첫 번째 카드 품질이 낮아 재생성이 많음",
      suggestion: "후보를 3개 생성한 뒤 자체 평가로 1개만 반환하는 방식(best-of-n)을 권장해요. 재생성 직전 카드와 그 이유를 다음 호출의 ‘피해야 할 예시’로 넘겨주세요.",
      evidence: [`카드 노출 ${shown}회 중 재생성 ${regens.length}회 (${pct(regens.length, shown)}%)`],
    });
  }

  // ── 난이도별 선택률 → 승원 ──────────────────
  const diff = [1, 2, 3].map((d) => {
    const list = cards.filter((c) => c.difficulty === d);
    return { d, n: list.length, sel: list.filter((c) => selectedIds.has(c.card_id)).length };
  });
  const easy = diff[0];
  const hard = diff[2];
  if (easy.n >= 5 && hard.n >= 5 && pct(hard.sel, hard.n) + 15 <= pct(easy.sel, easy.n)) {
    out.push({
      to: "승원",
      priority: "보통",
      title: "난이도 3 카드는 선택되지 않음 — 난이도 분포 조정",
      suggestion: "난이도 3 카드 비중을 줄이고, 난이도 1~2에서 같은 포맷을 만들어 주세요.",
      evidence: [`선택률 난이도1 ${pct(easy.sel, easy.n)}% (n=${easy.n}) vs 난이도3 ${pct(hard.sel, hard.n)}% (n=${hard.n})`],
    });
  }

  // ── 포맷 성과/선택률 → 도하/승원 ────────────
  const stats = formatStats(posts.filter((p) => p.format)).filter((f) => !f.lowN);
  for (const f of stats) {
    const list = cards.filter((c) => c.format === f.format);
    const sel = list.filter((c) => selectedIds.has(c.card_id)).length;
    if (f.medianMultiple < 0.95) {
      out.push({
        to: "도하",
        priority: f.medianMultiple < 0.8 ? "높음" : "보통",
        title: `'${f.format}' 포맷 가중치 하향 검토`,
        suggestion: "시드 계정에서는 떴지만 우리 계정에서는 평소 이하예요. 포맷 점수에 ‘우리 계정 실측 성과’를 보정 계수로 반영해 주세요 (예: 점수 × clamp(중앙값, 0.5, 1.5)).",
        evidence: [`우리 계정 중앙값 ${mult(f.medianMultiple)} (n=${f.n})`, `카드 노출 ${list.length}회 중 선택 ${sel}회`],
      });
    } else if (f.medianMultiple >= 1.5) {
      out.push({
        to: "도하",
        priority: "보통",
        title: `'${f.format}' 포맷 가중치 상향`,
        suggestion: "우리 계정에서 일관되게 잘 나오는 포맷이에요. 같은 포맷을 다른 소재로 반복 제안해도 좋아요. 다만 최근 7일 내 반복은 제한해 주세요.",
        evidence: [`우리 계정 중앙값 ${mult(f.medianMultiple)} (n=${f.n})`, `카드 노출 ${list.length}회 중 선택 ${sel}회`],
      });
      if (list.length >= 5 && pct(sel, list.length) < 40) {
        out.push({
          to: "승원",
          priority: "보통",
          title: `'${f.format}'은 성과가 좋은데 선택률이 낮음`,
          suggestion: "성과는 좋지만 팀이 잘 고르지 않아요. 이 포맷을 난이도 낮은 버전(출연 1명, 촬영 30분 이내)으로 만들어 주세요.",
          evidence: [`선택률 ${pct(sel, list.length)}% (${sel}/${list.length}), 중앙값 ${mult(f.medianMultiple)}`],
        });
      }
    }
  }

  // ── 상시 데이터 요청 (현재 스키마에 없는 항목) ─
  const hasScores = cards.some((c) => "score" in c);
  if (cards.length > 0 && !hasScores) {
    out.push({
      to: "도하",
      priority: "높음",
      title: "카드 JSON에 점수 구성요소를 같이 내려주세요",
      suggestion:
        "카드마다 score: { viral_strength, fit, feasibility, freshness }와 reference_video_ids를 포함해 주세요. 그래야 ‘어떤 점수가 실제 성과를 예측하는지’를 상관분석으로 검증하고 가중치를 조정할 수 있어요. (card_events.score_snapshot에 저장 예정)",
      evidence: ["현재 카드에는 최종 근거 문장만 있고 점수 구성요소가 없어 사후 검증이 불가능"],
    });
  }

  return out.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "높음" ? -1 : 1));
}

/** 화면과 복사 메시지에 쓰는 파트 이름 (내부 키는 담당자 이름 그대로) */
export const PART_LABEL: Record<DevMessage["to"], string> = { 도하: "점수 분석 파트", 승원: "카드 생성 API 파트" };

export function toPlainText(msgs: DevMessage[], to: DevMessage["to"]) {
  const list = msgs.filter((m) => m.to === to);
  if (!list.length) return "";
  return [
    `[${PART_LABEL[to]}] 대시보드에 쌓인 피드백 기준 제안입니다.`,
    "",
    ...list.map((m, i) => `${i + 1}. [${m.priority}] ${m.title}\n   - 제안: ${m.suggestion}\n   - 근거: ${m.evidence.join(" / ")}`),
  ].join("\n");
}
