"use client";

// 계정별 컨셉/소재의 편집 상태.
// - 저장 위치: Supabase `account_profiles`(팀 공용) → 테이블이 없으면 이 브라우저(localStorage)
// - 기본값은 lib/accounts.ts(노션 기준 초안). 편집하면 그 값이 우선하고, '초기값으로 되돌리기'로 복원.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ACCOUNT_PROFILES, type AccountId, type Concept, type Material } from "./accounts";

const KEY = "viral-dashboard:profiles:v1";

export interface ProfileState {
  concept: Concept;
  materials: Material[];
}
type All = Record<AccountId, ProfileState>;
export type ProfileStorage = "loading" | "supabase" | "local";

const defaults = (): All =>
  Object.fromEntries(ACCOUNT_PROFILES.map((a) => [a.id, { concept: { ...a.concept }, materials: a.materials.map((m) => ({ ...m })) }])) as All;

interface Ctx {
  storage: ProfileStorage;
  saved: "idle" | "saving" | "saved" | "failed";
  profile: (id: AccountId) => ProfileState;
  setConcept: (id: AccountId, patch: Partial<Concept>) => void;
  saveMaterial: (id: AccountId, m: Omit<Material, "updated_at"> & { updated_at?: string }) => void;
  deleteMaterial: (id: AccountId, materialId: string) => void;
  reset: (id: AccountId) => void;
}

const C = createContext<Ctx | null>(null);
export const useProfiles = () => {
  const v = useContext(C);
  if (!v) throw new Error("ProfilesProvider missing");
  return v;
};

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<All>(defaults);
  const [storage, setStorage] = useState<ProfileStorage>("loading");
  const [saved, setSaved] = useState<Ctx["saved"]>("idle");
  const storageRef = useRef<ProfileStorage>("loading");
  const timers = useRef<Partial<Record<AccountId, ReturnType<typeof setTimeout>>>>({});
  const dirty = useRef(false);

  // 1) 브라우저 저장값 → 2) 팀 공용 저장값(있으면 우선)
  useEffect(() => {
    let local: Partial<All> = {};
    try {
      local = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {}
    const base = defaults();
    for (const a of ACCOUNT_PROFILES) if (local[a.id]) base[a.id] = { ...base[a.id], ...local[a.id] } as ProfileState;
    setAll(base);

    fetch("/api/profiles", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { source?: string; profiles?: Partial<All> }) => {
        const src: ProfileStorage = d.source === "supabase" ? "supabase" : "local";
        storageRef.current = src;
        setStorage(src);
        if (src === "supabase" && d.profiles && !dirty.current) {
          setAll((prev) => {
            const next = { ...prev };
            for (const a of ACCOUNT_PROFILES) if (d.profiles![a.id]) next[a.id] = d.profiles![a.id] as ProfileState;
            return next;
          });
        }
      })
      .catch(() => {
        storageRef.current = "local";
        setStorage("local");
      });
  }, []);

  const persist = useCallback((id: AccountId, next: All) => {
    dirty.current = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    if (storageRef.current !== "supabase") {
      setSaved("saved");
      return;
    }
    setSaved("saving");
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      fetch("/api/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id, concept: next[id].concept, materials: next[id].materials }),
      })
        .then((r) => r.json())
        .then((d: { source?: string }) => setSaved(d.source === "supabase" ? "saved" : "failed"))
        .catch(() => setSaved("failed"));
    }, 700);
  }, []);

  const update = useCallback(
    (id: AccountId, fn: (p: ProfileState) => ProfileState) => {
      setAll((prev) => {
        const next = { ...prev, [id]: fn(prev[id]) };
        // setState 안에서 부수효과를 피하려고 다음 틱에 저장
        queueMicrotask(() => persist(id, next));
        return next;
      });
    },
    [persist],
  );

  const value = useMemo<Ctx>(
    () => ({
      storage,
      saved,
      profile: (id) => all[id],
      setConcept: (id, patch) => update(id, (p) => ({ ...p, concept: { ...p.concept, ...patch } })),
      saveMaterial: (id, m) =>
        update(id, (p) => {
          const row: Material = { ...m, updated_at: new Date().toISOString() };
          const i = p.materials.findIndex((x) => x.id === m.id);
          return { ...p, materials: i >= 0 ? p.materials.map((x, k) => (k === i ? row : x)) : [row, ...p.materials] };
        }),
      deleteMaterial: (id, materialId) => update(id, (p) => ({ ...p, materials: p.materials.filter((x) => x.id !== materialId) })),
      reset: (id) => update(id, () => defaults()[id]),
    }),
    [all, storage, saved, update],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}
