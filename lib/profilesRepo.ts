// 서버 전용: 계정별 컨셉·소재를 Supabase `account_profiles` 테이블에 저장/조회한다.
// 테이블이 없거나 Supabase가 설정되지 않았으면 호출하는 쪽이 브라우저 저장으로 대신한다.
import { ACCOUNT_BY_ID, type AccountId, type Concept, type Material } from "./accounts";
import { sanitizeConcept, sanitizeMaterials } from "./chat";
import { supabaseConfigured } from "./cardsRepo";

export interface StoredProfile {
  concept: Concept;
  materials: Material[];
  updated_at: string;
}

function endpoint(params?: Record<string, string>) {
  const key = process.env.SUPABASE_SECRET_KEY!;
  const url = new URL("/rest/v1/account_profiles", process.env.SUPABASE_URL);
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL must be https");
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  return { url, headers };
}

export const profilesConfigured = supabaseConfigured;

export async function fetchProfiles(): Promise<Record<string, StoredProfile>> {
  const { url, headers } = endpoint({ select: "*" });
  const res = await fetch(url, { headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`supabase_http_${res.status}`);
  const rows = (await res.json()) as { account_id: string; concept: unknown; materials: unknown; updated_at: string }[];
  const out: Record<string, StoredProfile> = {};
  for (const r of rows) {
    const acc = ACCOUNT_BY_ID[r.account_id as AccountId];
    if (!acc) continue;
    out[r.account_id] = {
      concept: sanitizeConcept(r.concept as Partial<Concept>, acc.concept),
      materials: sanitizeMaterials(r.materials, acc.materials),
      updated_at: r.updated_at,
    };
  }
  return out;
}

export async function saveProfile(accountId: AccountId, concept: Concept, materials: Material[]) {
  const { url, headers } = endpoint({ on_conflict: "account_id" });
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ account_id: accountId, concept, materials, updated_at: new Date().toISOString() }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`supabase_http_${res.status}`);
}
