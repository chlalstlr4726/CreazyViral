"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Binoculars, History, Home, Link2, Menu, MessageSquareText, X } from "lucide-react";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/competitors", label: "경쟁사", icon: Binoculars },
  { href: "/history", label: "히스토리", icon: History },
  { href: "/insights", label: "(개발자용) 최적화 제언", icon: MessageSquareText },
  { href: "/accounts", label: "계정 연결", icon: Link2 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { ready, toast, cardSource } = useStore();
  const [open, setOpen] = useState(false); // 기본은 닫힘

  // 메뉴를 눌러 이동하면 자동으로 닫고, Esc로도 닫는다
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <button
        aria-label="메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={clsx(
          "fixed top-4 left-4 z-20 grid h-10 w-10 place-items-center rounded-md border border-gray-200 bg-white text-gray-700 shadow-xs hover:bg-gray-50 transition-opacity",
          open && "pointer-events-none opacity-0",
        )}
      >
        <Menu size={18} />
      </button>

      <aside
        inert={!open}
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-gray-200 bg-white transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-6 pt-6 pb-8">
          <img src="/logo.png" alt="Creazy" width={36} height={36} className="h-9 w-9 shrink-0" />
          <div className="leading-tight">
            <div className="text-[17px] font-bold tracking-tight">Creazy</div>
            <div className="text-[11px] text-gray-500">데일리 바이럴 카드</div>
          </div>
          <button
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="ml-auto grid h-8 w-8 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={17} />
          </button>
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
              <span className="font-semibold text-gray-700">실제 데이터만 표시 중</span>
              <br />
              데이터가 없는 칸은 ‘아직 데이터 없음’으로 보여요.
            </>
          ) : cardSource === "error" ? (
            <>
              <span className="font-semibold text-red-600">카드 DB 연결 실패</span>
              <br />
              카드는 ‘아직 데이터 없음’으로 보여요.
            </>
          ) : cardSource === "loading" ? (
            <span className="font-semibold text-gray-700">데이터 불러오는 중…</span>
          ) : (
            <>
              <span className="font-semibold text-gray-700">데이터 연결 전</span>
              <br />
              Supabase를 연결하면 실제 데이터가 나타나요.
            </>
          )}
        </div>
      </aside>

      <main className={clsx("min-h-screen px-10 pt-16 pb-8 transition-[margin] duration-200", open ? "ml-60" : "ml-0")}>
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
