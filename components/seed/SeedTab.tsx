"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { FeedResult } from "@/lib/feed";
import { SeedHero } from "./SeedHero";
import { SeedFeed } from "./SeedFeed";
import "./seed.css";

/** 홈 네 번째 탭 "씨앗": 의미 있는 둠스크롤. 첫 화면은 소개, 아래는 한 편씩 넘기는 릴스 100편. */
export function SeedTab() {
  const [data, setData] = useState<FeedResult | null>(null);
  // 피그마로 옮길 때(?capture=1): 영상 없이 릴스 두 편만 평면으로
  const capture = useSearchParams().has("capture");

  useEffect(() => {
    let alive = true;
    fetch("/api/feed?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: FeedResult) => alive && setData(d))
      .catch(() => alive && setData({ status: "error" }));
    // 이 탭에 있는 동안만 인스타처럼 한 편씩 딱 멈추며 넘긴다
    if (!capture) document.documentElement.classList.add("seed-snap");
    if (capture && !document.getElementById("figma-capture")) {
      const el = document.createElement("script");
      el.id = "figma-capture";
      el.src = "https://mcp.figma.com/mcp/html-to-design/capture.js";
      el.async = true;
      document.head.appendChild(el);
    }
    return () => {
      alive = false;
      document.documentElement.classList.remove("seed-snap");
    };
  }, [capture]);

  return (
    <div className="seed-tab">
      <header className="seed-titlebar">
        <h1 className="text-3xl font-bold tracking-tight">
          씨앗<span aria-hidden="true">🌱</span>
        </h1>
        <p className="seed-sub">엄선한 100편의 고능한 릴스</p>
      </header>
      <SeedHero />
      {data === null && <p className="seed-state">불러오는 중…</p>}
      {data && data.status !== "ok" && (
        <p className="seed-state">
          아직 데이터 없음
          <small>{data.status === "error" ? "피드 표를 읽지 못했어요. 잠시 뒤 다시 열어 주세요." : "오늘의 릴스가 피드 표에 들어오면 여기에 보여요."}</small>
        </p>
      )}
      {data?.status === "ok" && <SeedFeed items={capture ? data.items.slice(0, 2) : data.items} grown={false} capture={capture} />}
    </div>
  );
}
