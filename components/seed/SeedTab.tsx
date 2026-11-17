"use client";

import { useEffect, useState } from "react";
import type { FeedResult } from "@/lib/feed";
import { SeedHero } from "./SeedHero";
import { SeedFeed } from "./SeedFeed";
import { EditPanel } from "./EditPanel";
import { DEFAULT_SETTINGS, type SeedSettings } from "./settings";
import "./seed.css";

/** 홈 네 번째 탭 "씨앗": 의미 있는 둠스크롤. 첫 화면은 3D 아스키 세계수, 아래는 한 편씩 넘기는 릴스 100편. */
export function SeedTab() {
  const [data, setData] = useState<FeedResult | null>(null);
  const [grown, setGrown] = useState(false);
  const [explain, setExplain] = useState(false);
  const [settings, setSettings] = useState<SeedSettings>(DEFAULT_SETTINGS);
  const [editing, setEditing] = useState(false);
  const canEdit = process.env.NODE_ENV === "development"; // 편집 모드는 내 컴퓨터의 개발 화면에서만

  useEffect(() => {
    let alive = true;
    fetch("/api/feed?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: FeedResult) => alive && setData(d))
      .catch(() => alive && setData({ status: "error" }));
    // 이 탭에 있는 동안만 인스타처럼 한 편씩 딱 멈추며 넘긴다
    document.documentElement.classList.add("seed-snap");
    return () => {
      alive = false;
      document.documentElement.classList.remove("seed-snap");
    };
  }, []);

  return (
    <div className="seed-tab">
      <div className="seed-titlebar">
        <h1 className="text-3xl font-bold tracking-tight">
          씨앗<span aria-hidden="true">🌱</span>
        </h1>
        {canEdit && (
          <button type="button" className="seed-edit-toggle" aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
            {editing ? "편집 끝내기" : "✎ 직접 편집"}
          </button>
        )}
      </div>
      <SeedHero settings={settings} editing={editing} onCard={(patch) => setSettings((s) => ({ ...s, card: { ...s.card, ...patch } }))} onExplain={() => setExplain(true)} onGrown={() => setGrown(true)} />
      {editing && <EditPanel value={settings} onChange={setSettings} onClose={() => setEditing(false)} />}
      {data === null && <p className="seed-state">불러오는 중…</p>}
      {data && data.status !== "ok" && (
        <p className="seed-state">
          아직 데이터 없음
          <small>{data.status === "error" ? "피드 표를 읽지 못했어요. 잠시 뒤 다시 열어 주세요." : "오늘의 릴스가 피드 표에 들어오면 여기에 보여요."}</small>
        </p>
      )}
      {data?.status === "ok" && <SeedFeed items={data.items} grown={grown} />}
      {explain && <ExplainPopup onClose={() => setExplain(false)} />}
    </div>
  );
}

function ExplainPopup({ onClose }: { onClose: () => void }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const card = (who: "a" | "b") => {
    const p = who === "a"
      ? { tag: "방구석 백수", title: "인스타 릴스 중독자", img: "/seed/meme-addict.jpg", alt: "릴스 5시간 둠스크롤 뒤 뇌가 빨려 나간 사람 그림(밈)", pts: ["아무 도움 안 되는 릴스만 내리며 감각을 깎아 먹음", "도파민에 절여짐", "인스타에 지배당함"] }
      : { tag: "나도 이젠… 감다살?", title: "릴스 개척자", img: "/seed/meme-pioneer.jpg", alt: "이 페이지에서 5분 뒤 눈부시게 깨달은 사람 그림(밈)", pts: ["엄선된 릴스만 쏙쏙(오늘의 100편)", "릴스마다 넓혀 볼 아이디어 씨앗까지", "아이디어는 내가 스스로 키움"] };
    return (
      <article className={"seed-persona " + who} aria-hidden={(who === "b") !== flipped}>
        <span className="seed-ptag">{p.tag}</span>
        <h3>{p.title}</h3>
        <img src={p.img} alt={p.alt} />
        <ul>{p.pts.map((t) => <li key={t}>{t}</li>)}</ul>
      </article>
    );
  };
  return (
    <div className="seed-pop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="seed-pop-card" role="dialog" aria-modal="true" aria-label="씨앗 탭 소개">
        <button type="button" className="seed-pop-x" aria-label="닫기" onClick={onClose} autoFocus>×</button>
        <h2>씨앗 탭은 이런 곳이에요</h2>
        <div className={"seed-flip" + (flipped ? " on" : "")}>
          <div className="seed-face front">{card("a")}</div>
          <div className="seed-face back">{card("b")}</div>
        </div>
        <button type="button" className="seed-flip-btn" onClick={() => setFlipped((v) => !v)}>
          {flipped ? "← 다시 중독자로" : "이 페이지에서 5분 보내기 →"}
        </button>
        <p className="seed-pop-foot">AI는 아이디어 씨앗만 건네요. 무엇이 재밌고 쓸모 있는지는 내가 정해요.</p>
      </div>
    </div>
  );
}
