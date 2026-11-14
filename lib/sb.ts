// 서버 전용: Supabase REST 호출 도우미 (SUPABASE_SECRET_KEY는 브라우저로 내려보내지 않는다).
export const sbConfigured = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;

export async function sb<T = unknown>(
  table: string,
  opts: { method?: "GET" | "POST" | "PATCH"; params?: Record<string, string>; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const key = process.env.SUPABASE_SECRET_KEY!;
  const url = new URL(`/rest/v1/${table}`, process.env.SUPABASE_URL);
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL must be https");
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (opts.prefer) headers.Prefer = opts.prefer;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`supabase_http_${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
