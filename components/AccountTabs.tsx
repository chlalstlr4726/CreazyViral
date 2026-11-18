"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ACCOUNT_PROFILES, type AccountId } from "@/lib/accounts";
import { TodaySection } from "./TodaySection";
import { ChatPanel } from "./ChatPanel";
import { ViralTop5, type Days } from "./ViralTop5";
import { ProfilePanel } from "./ProfilePanel";
import { PerformanceSection } from "./PerformanceSection";

const KEY = "viral-dashboard:tab";

export function AccountTabs() {
  const [tab, setTab] = useState<AccountId>("moodiee");
  const [days, setDays] = useState<Days>(7);
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("a") as AccountId | null;
    const saved = (q ?? localStorage.getItem(KEY)) as AccountId | null;
    if (saved && ACCOUNT_PROFILES.some((a) => a.id === saved)) setTab(saved);
  }, []);

  // 좁은 화면에서는 탭 줄이 가로로 밀린다. 고른 계정 탭이 줄 밖에 있으면 줄만 옮겨 보이게 한다(페이지는 그대로).
  useEffect(() => {
    const box = row.current;
    const btn = box?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!box || !btn) return;
    const r = box.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    if (b.left < r.left) box.scrollLeft -= r.left - b.left;
    else if (b.right > r.right) box.scrollLeft += b.right - r.right;
  }, [tab]);

  function pick(id: AccountId) {
    setTab(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
    history.replaceState(null, "", `?a=${id}`);
  }

  const acct = ACCOUNT_PROFILES.find((a) => a.id === tab)!;

  return (
    <>
      <div className="mb-6 border-b border-gray-200">
        <div ref={row} className="account-tabs -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ACCOUNT_PROFILES.map((a) => (
            <button
              key={a.id}
              onClick={() => pick(a.id)}
              aria-pressed={tab === a.id}
              className={clsx(
                "press flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold",
                tab === a.id ? "border-blue-500 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
              @{a.handle}
              <span className="text-xs font-normal text-gray-500">{a.owner}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mb-5 text-sm text-gray-500">{acct.kind}</p>

      <div key={tab}>
        <TodaySection accountId={tab} />
        <ViralTop5 days={days} onDays={setDays} />
        <ChatPanel accountId={tab} days={days} />
        <ProfilePanel accountId={tab} />
        <PerformanceSection accountId={tab} />
      </div>
    </>
  );
}
