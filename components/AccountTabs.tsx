"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ACCOUNT_PROFILES, type AccountId } from "@/lib/accounts";
import { TodaySection } from "./TodaySection";
import { ChatPanel } from "./ChatPanel";
import { ProfilePanel } from "./ProfilePanel";
import { PerformanceSection } from "./PerformanceSection";
import { ReferenceSection } from "./ReferenceSection";

const KEY = "viral-dashboard:tab";

export function AccountTabs() {
  const [tab, setTab] = useState<AccountId>("moodiee");

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("a") as AccountId | null;
    const saved = (q ?? localStorage.getItem(KEY)) as AccountId | null;
    if (saved && ACCOUNT_PROFILES.some((a) => a.id === saved)) setTab(saved);
  }, []);

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
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {ACCOUNT_PROFILES.map((a) => (
          <button
            key={a.id}
            onClick={() => pick(a.id)}
            className={clsx(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === a.id ? "border-blue-500 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900",
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
            @{a.handle}
            <span className="text-xs font-normal text-gray-400">{a.owner}</span>
          </button>
        ))}
      </div>
      <p className="mb-5 text-sm text-gray-500">{acct.kind}</p>

      <div key={tab}>
        <TodaySection accountId={tab} />
        <ReferenceSection />
        <ChatPanel accountId={tab} />
        <ProfilePanel accountId={tab} />
        <PerformanceSection accountId={tab} />
      </div>
    </>
  );
}
