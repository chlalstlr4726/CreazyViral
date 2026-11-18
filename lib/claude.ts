// 서버 전용: Claude Messages API를 한 번 부르는 작은 도우미.
// 이 레포는 Anthropic SDK를 깔지 않고 fetch로 부른다(기존 /api/chat과 같은 방식, 의존성 추가 없음).

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface ClaudeResult {
  ok: boolean;
  text: string;
  usage: ClaudeUsage;
  stop: string;
  error?: string;
}

type Block = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

export const emptyUsage = (): ClaudeUsage => ({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });

export function addUsage(a: ClaudeUsage, b: ClaudeUsage) {
  a.input_tokens += b.input_tokens;
  a.output_tokens += b.output_tokens;
  a.cache_creation_input_tokens += b.cache_creation_input_tokens;
  a.cache_read_input_tokens += b.cache_read_input_tokens;
}

// 1백만 토큰당 달러(2026-11 기준). 캐시 쓰기 1.25배, 캐시 읽기 0.1배.
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
};

export function costUsd(model: string, u: ClaudeUsage) {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return (u.input_tokens * p.in + u.cache_creation_input_tokens * p.in * 1.25 + u.cache_read_input_tokens * p.in * 0.1 + u.output_tokens * p.out) / 1e6;
}

/**
 * 한 번 부른다(스트리밍 아님). 생각은 기본 adaptive, 깊이는 effort로 정한다.
 * schema를 주면 구조화된 출력(JSON 스키마)으로 받는다.
 */
export async function callClaude(args: {
  key: string;
  model: string;
  system: string;
  content: Block[];
  maxTokens: number;
  effort: "low" | "medium" | "high";
  /** 기본 adaptive(모델이 필요한 만큼 생각). Haiku 5.5는 effort high 이하에서 disabled(생각 끄기)를 받는다. */
  thinking?: "adaptive" | "disabled";
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<ClaudeResult> {
  const { key, model, system, content, maxTokens, effort, thinking = "adaptive", schema, signal } = args;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2026-10-21", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        thinking: { type: thinking },
        output_config: { effort, ...(schema ? { format: { type: "json_schema", schema } } : {}) },
        system,
        messages: [{ role: "user", content }],
      }),
      signal,
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { error?: { message?: string } })?.error?.message ?? "";
      } catch {}
      return { ok: false, text: "", usage: emptyUsage(), stop: "", error: `http_${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}` };
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: Partial<ClaudeUsage>; stop_reason?: string };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const u = data.usage ?? {};
    const usage: ClaudeUsage = {
      input_tokens: u.input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    };
    const stop = data.stop_reason ?? "";
    if (stop === "refusal") return { ok: false, text, usage, stop, error: "refusal" };
    if (stop === "max_tokens") return { ok: false, text, usage, stop, error: "max_tokens" };
    return { ok: true, text, usage, stop };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    return { ok: false, text: "", usage: emptyUsage(), stop: "", error: name === "AbortError" || name === "TimeoutError" ? "aborted" : "unreachable" };
  }
}
