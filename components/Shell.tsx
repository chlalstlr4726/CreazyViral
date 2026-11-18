"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Binoculars, History, Home, Link2, Menu, MessageSquareText, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { project, spring, springFlick } from "@/lib/motion";

const NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/competitors", label: "경쟁사", icon: Binoculars },
  { href: "/history", label: "히스토리", icon: History },
  { href: "/insights", label: "(개발자용) 최적화 제언", icon: MessageSquareText },
  { href: "/accounts", label: "계정 연결", icon: Link2 },
];

const DRAWER_W = 264;
const HIDDEN_X = -DRAWER_W - 32; // 그림자까지 화면 밖으로

/** 머리줄에 보일 '지금 위치' */
function sectionOf(path: string) {
  if (path === "/") return "홈";
  if (path.startsWith("/cards")) return "카드 상세";
  return NAV.find((n) => n.href !== "/" && path.startsWith(n.href))?.label ?? "";
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    // 기기의 '움직임 줄이기'를 따른다: 위치·크기 움직임은 끄고 흐려짐만 남긴다
    <MotionConfig reducedMotion="user">
      <ShellInner>{children}</ShellInner>
    </MotionConfig>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { ready, toast, cardSource, dismissToast } = useStore();
  const [open, setOpen] = useState(false); // 기본은 닫힘
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // 메뉴 위치는 하나의 값(x)으로 움직인다. 끄는 동안 손가락에 1:1로 붙고, 어둡게 가리는 막도 같은 값을 따라간다.
  const x = useMotionValue(HIDDEN_X);
  const scrim = useTransform(x, [HIDDEN_X, 0], [0, 1]);

  useEffect(() => {
    const target = open ? 0 : HIDDEN_X;
    if (reduce) {
      x.set(target);
      return;
    }
    // 지금 화면의 위치·속도에서 이어서 간다(도중에 다시 눌러도 튀지 않음)
    const ctrl = animate(x, target, spring);
    return () => ctrl.stop();
  }, [open, reduce, x]);

  // 메뉴를 눌러 이동하면 자동으로 닫고, Esc로도 닫는다
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 메뉴가 열린 동안 뒤 페이지는 스크롤되지 않게 잠근다(닫으면 풀린다)
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  // 열면 닫기 단추로, 닫으면(메뉴 안에 초점이 있었을 때) 메뉴 단추로 초점을 옮긴다
  useEffect(() => {
    if (open) closeBtn.current?.focus({ preventScroll: true });
    else if (drawerRef.current?.contains(document.activeElement)) menuBtn.current?.focus({ preventScroll: true });
  }, [open]);

  // 내용이 머리줄 아래로 지나갈 때만 머리줄 아래 가장자리를 보인다(늘 있는 줄 대신)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const section = sectionOf(path);

  return (
    <div className="min-h-screen">
      <header
        className={clsx(
          "glass sticky top-0 z-30 flex h-[var(--app-header-h)] items-center gap-3 px-3 sm:px-5",
          "transition-shadow duration-300",
          scrolled ? "shadow-[0_1px_0_rgba(15,23,42,0.07),0_8px_24px_-18px_rgba(15,23,42,0.35)]" : "shadow-none",
        )}
      >
        <button
          ref={menuBtn}
          type="button"
          aria-label="메뉴 열기"
          aria-expanded={open}
          aria-controls="app-menu"
          onClick={() => setOpen(true)}
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-700 hover:bg-gray-900/5"
        >
          <Menu size={19} />
        </button>
        <Link href="/" className="press flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-gray-900/5">
          <img src="/logo.png" alt="" width={24} height={24} className="h-6 w-6 shrink-0" />
          <span className="text-[0.9375rem] font-bold">Creazy</span>
        </Link>
        {section && (
          <>
            <span aria-hidden className="text-gray-300">/</span>
            <span className="truncate text-[0.9375rem] font-semibold text-gray-700">
              {section}
            </span>
          </>
        )}
      </header>

      {/* 어둡게 가리는 막: 메뉴가 열린 만큼만 짙어진다. 누르면 닫힌다 */}
      <motion.div
        aria-hidden
        onClick={() => setOpen(false)}
        style={{ opacity: scrim }}
        className={clsx("fixed inset-0 z-40 bg-gray-950/20", open ? "pointer-events-auto" : "pointer-events-none")}
      />

      <motion.aside
        id="app-menu"
        ref={drawerRef}
        inert={!open}
        aria-label="메뉴"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: HIDDEN_X, right: 0 }}
        dragElastic={{ left: 0, right: 0.12 }} // 열린 자리보다 더 끌면 점점 버틴다
        dragMomentum={false}
        onDragEnd={(_, info) => {
          // 손을 뗀 속도로 어디까지 갈지 내다보고, 절반을 넘으면 닫는다(속도는 그대로 이어받음)
          const landing = x.get() + project(info.velocity.x);
          if (landing < -DRAWER_W / 2) setOpen(false);
          else if (!reduce) animate(x, 0, { ...springFlick, velocity: info.velocity.x });
          else x.set(0);
        }}
        className="glass-thick fixed inset-y-0 left-0 z-50 flex w-[264px] touch-pan-y flex-col overscroll-contain rounded-r-2xl border-r border-[var(--glass-edge)]"
      >
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-7">
          <img src="/logo.png" alt="Creazy" width={36} height={36} className="h-9 w-9 shrink-0" />
          <div className="leading-tight">
            <div className="text-[1.0625rem] font-bold tracking-[-0.01em]">Creazy</div>
            <div className="text-[0.6875rem] text-gray-500">데일리 바이럴 카드</div>
          </div>
          <button
            ref={closeBtn}
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="press ml-auto grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-900/5 hover:text-gray-800"
          >
            <X size={17} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3" aria-label="페이지">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" || path.startsWith("/cards") : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                draggable={false}
                className={clsx(
                  "press flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active ? "bg-blue-600/10 text-blue-700" : "text-gray-700 hover:bg-gray-900/5 hover:text-gray-900",
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto m-4 rounded-xl bg-white/60 p-3 text-xs leading-relaxed text-gray-600">
          {cardSource === "supabase" ? (
            <>
              <span className="font-semibold text-gray-800">실제 데이터만 표시 중</span>
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
            <span className="font-semibold text-gray-800">데이터 불러오는 중…</span>
          ) : (
            <>
              <span className="font-semibold text-gray-800">데이터 연결 전</span>
              <br />
              Supabase를 연결하면 실제 데이터가 나타나요.
            </>
          )}
        </div>
      </motion.aside>

      <main className="min-h-screen px-4 pt-6 pb-8 sm:px-10">
        <div className="mx-auto max-w-[1200px]">{ready ? children : <div className="h-96" />}</div>
      </main>

      {/* 알림: 아래에서 올라와 같은 길로 내려간다. 되돌리기 같은 단추를 함께 보일 수 있다 */}
      {/* 새 알림은 같은 자리에서 이전 알림과 겹쳐 바뀐다(나란히 서지 않게) */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] h-0">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={spring}
              className="pointer-events-auto absolute bottom-0 left-1/2 flex w-max max-w-[min(92vw,34rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-gray-900 py-2.5 pr-2.5 pl-4 text-sm font-medium text-white shadow-[0_12px_32px_-10px_rgba(15,23,42,0.5)]"
            >
              <span className="min-w-0">{toast.text}</span>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => toast.action?.run()}
                  className="press shrink-0 rounded-xl bg-white/12 px-3 py-1.5 text-[0.8125rem] font-semibold text-white hover:bg-white/20"
                >
                  {toast.action.label}
                </button>
              ) : (
                <button type="button" aria-label="알림 닫기" onClick={dismissToast} className="press shrink-0 rounded-full p-1 text-white/70 hover:text-white">
                  <X size={15} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
