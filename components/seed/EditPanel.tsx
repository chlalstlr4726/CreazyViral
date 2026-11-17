"use client";

import { useState } from "react";
import { DEFAULT_SETTINGS, sanitize, type SeedSettings } from "./settings";

type Num = { label: string; get: (s: SeedSettings) => number; set: (s: SeedSettings, v: number) => SeedSettings; min: number; max: number; step: number; unit?: string };
const n = (label: string, path: [keyof SeedSettings, string?], min: number, max: number, step: number, unit = ""): Num => ({
  label, min, max, step, unit,
  get: (s) => (path[1] ? (s[path[0]] as Record<string, number>)[path[1]] : (s[path[0]] as unknown as number)),
  set: (s, v) => (path[1] ? { ...s, [path[0]]: { ...(s[path[0]] as object), [path[1]]: v } } : { ...s, [path[0]]: v }),
});
const GROUPS: { title: string; items: Num[] }[] = [
  { title: "나무", items: [n("가로 위치(왼쪽 0 ~ 오른쪽 1)", ["tree", "x"], 0.1, 0.9, 0.01), n("꼭대기 위 여백", ["tree", "top"], 0.02, 0.6, 0.01), n("글자 크기", ["tree", "glyph"], 2.6, 9, 0.1, "px")] },
  { title: "돌기", items: [n("한 번에 도는 각도", ["turn", "stepDeg"], 15, 360, 5, "°"), n("도는 시간", ["turn", "moveSec"], 0.6, 12, 0.1, "초"), n("멈추는 시간", ["turn", "holdSec"], 0, 10, 0.1, "초")] },
  { title: "거리감", items: [n("먼 쪽을 옅게(0이면 끔)", ["depth", "fog"], 0, 3, 0.05)] },
  { title: "나비", items: [n("나비 수", ["flies"], 0, 8, 1, "마리")] },
  { title: "달", items: [n("가로(-1 ~ 1)", ["moon", "x"], -1, 1, 0.01), n("세로(-1 ~ 1)", ["moon", "y"], -1, 1, 0.01), n("크기", ["moon", "size"], 0.2, 3, 0.05)] },
];
const COLORS: { label: string; key: keyof SeedSettings["color"] }[] = [
  { label: "꽃", key: "blossom" }, { label: "줄기", key: "wood" }, { label: "나비", key: "butterfly" }, { label: "땅", key: "ground" },
];

/** 편집 판(개발 화면 전용): 끌어서 값을 바꾸면 장면이 바로 바뀌고, '저장'하면 seedSettings.json에 쓴다. */
export function EditPanel({ value, onChange, onClose }: { value: SeedSettings; onChange: (s: SeedSettings) => void; onClose: () => void }) {
  const [msg, setMsg] = useState("값을 바꾸면 화면이 바로 바뀌어요. 카드는 손잡이로 끌고, 카드 글은 눌러서 고쳐요.");
  const save = async () => {
    setMsg("저장하는 중…");
    try {
      const r = await fetch("/api/seed-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sanitize(value)) });
      setMsg(r.ok ? "저장했어요. 새로 열어도 이 값으로 보여요(components/seed/seedSettings.json)." : "여기서는 저장할 수 없어요. '값 복사'를 눌러 채팅에 붙여 주세요.");
    } catch {
      setMsg("저장하지 못했어요. '값 복사'를 눌러 채팅에 붙여 주세요.");
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(sanitize(value), null, 2)); setMsg("값을 복사했어요. 채팅에 붙여 넣으면 그대로 고정할게요."); }
    catch { setMsg("복사하지 못했어요. 브라우저가 막았을 수 있어요."); }
  };
  return (
    <aside className="seed-edit" aria-label="씨앗 탭 편집 판">
      <div className="seed-edit-head">
        <strong>편집 모드</strong>
        <button type="button" onClick={onClose} aria-label="편집 판 닫기">×</button>
      </div>
      {GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend>{g.title}</legend>
          {g.title === "달" && (
            <label className="seed-check"><input type="checkbox" checked={value.moon.show} onChange={(e) => onChange({ ...value, moon: { ...value.moon, show: e.target.checked } })} /> 달 보이기</label>
          )}
          {g.items.map((it) => (
            <label key={it.label}>
              <span>{it.label} <b>{Number(it.get(value).toFixed(2))}{it.unit}</b></span>
              <input type="range" min={it.min} max={it.max} step={it.step} value={it.get(value)} onChange={(e) => onChange(it.set(value, Number(e.target.value)))} />
            </label>
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>색</legend>
        <div className="seed-colors">
          {COLORS.map((c) => (
            <label key={c.key}><input type="color" value={value.color[c.key]} onChange={(e) => onChange({ ...value, color: { ...value.color, [c.key]: e.target.value } })} /> {c.label}</label>
          ))}
        </div>
      </fieldset>
      <div className="seed-edit-actions">
        <button type="button" className="primary" onClick={save}>저장</button>
        <button type="button" onClick={copy}>값 복사</button>
        <button type="button" onClick={() => onChange(DEFAULT_SETTINGS)}>저장한 값으로</button>
      </div>
      <p className="seed-edit-msg" role="status">{msg}</p>
    </aside>
  );
}
