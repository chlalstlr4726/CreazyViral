"use client";

import clsx from "clsx";
import type { CardType } from "@/lib/types";

export function TypeBadge({ type }: { type: CardType }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        type === "dummy" ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600",
      )}
    >
      {type === "dummy" ? "Dummy 바이럴" : "서비스 소개"}
    </span>
  );
}

export function Chip({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "blue" | "green" | "amber" | "red" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
  };
  return <span className={clsx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[13px]",
        variant === "primary" && "bg-blue-500 text-gray-50 shadow-sm hover:bg-blue-600",
        variant === "secondary" && "border border-gray-200 bg-white text-gray-900 shadow-xs hover:bg-gray-50",
        variant === "ghost" && "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
        className,
      )}
    />
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={clsx("rounded-xl border border-gray-200 bg-white shadow-xs", className)}>{children}</section>;
}

export function SectionTitle({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-gray-500">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Difficulty({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`제작 난이도 ${level}/3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={clsx("h-1.5 w-4 rounded-full", i <= level ? "bg-blue-500" : "bg-gray-200")} />
      ))}
    </span>
  );
}
