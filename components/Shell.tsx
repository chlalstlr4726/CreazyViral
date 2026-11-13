"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { History, Home, Link2, MessageSquareText, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/history", label: "히스토리", icon: History },
  { href: "/insights", label: "개발자 제언", icon: MessageSquareText },
  { href: "/accounts", label: "계정 연결", icon: Link2 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { ready, toast, cardSource } = useStore();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-60 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2.5 px-6 pt-6 pb-8">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-white">
            <Sparkles size={16} />
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-bold tracking-tight">Creazy</div>
            <div className="text-[11px] text-gray-500">데일리 바이럴 카드</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" || path.startsWith("/cards") : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto m-4 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
          {cardSource === "supabase" ? (
            <>
              <span className="font-semibold text-gray-700">카드는 실제 데이터</span>
              <br />
              성과·히스토리는 아직 샘플이에요.
            </>
          ) : cardSource === "error" ? (
            <>
              <span className="font-semibold text-red-600">카드 DB 연결 실패</span>
              <br />
              샘플 카드로 대신 보여주고 있어요.
            </>
          ) : (
            <>
              <span className="font-semibold text-gray-700">샘플 데이터로 표시 중</span>
              <br />
              Supabase를 연결하면 카드가 실제 데이터로 바뀌어요.
            </>
          )}
        </div>
      </aside>

      <main className="ml-60 min-h-screen px-10 py-8">
        <div className="mx-auto max-w-[1200px]">{ready ? children : <div className="h-96" />}</div>
      </main>

      {toast && (
        <div className="pop fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
