"use client";

import { AccountTabs } from "@/components/AccountTabs";
import { ReferenceSection } from "@/components/ReferenceSection";
import { SeriesDashboard } from "@/components/SeriesDashboard";
import { SeedTab } from "@/components/seed/SeedTab";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const tabs = [
  { key: "today", label: "오늘 콘텐츠" },
  { key: "competitors", label: "경쟁사 분석" },
  { key: "series", label: "신규 채널 추천" },
  { key: "seed", label: "씨앗🌱" },
] as const;

function HomeTabs() {
  const params = useSearchParams();
  const selected = tabs.find(({ key }) => key === params.get("tab"))?.key ?? "today";
  return (
    <div className="dashboard-copy">
      <nav aria-label="홈 메뉴" className="dashboard-tabs mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {tabs.map(({ key, label }) => {
          const query = new URLSearchParams(params.toString());
          if (key === "today") query.delete("tab");
          else query.set("tab", key);
          return <Link key={key} href={query.size ? "/?" + query : "/"} aria-current={key === selected ? "page" : undefined}
            className={key === selected ? "press rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700" : "press rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"}>{label}</Link>;
        })}
      </nav>
      {selected === "today" && <AccountTabs />}
      {selected === "competitors" && (
        <section>
          <h1 className="text-3xl font-bold tracking-tight">경쟁사 분석</h1>
          <p className="mb-6 mt-1.5 text-gray-500">Creazy가 추적하는 계정에서 반응이 컸던 릴스를 확인해요.</p>
          <ReferenceSection />
        </section>
      )}
      {selected === "series" && <SeriesDashboard />}
      {selected === "seed" && <SeedTab />}
    </div>
  );
}

export default function Home() {
  return <Suspense fallback={null}><HomeTabs /></Suspense>;
}
