"use client";

import { useState } from "react";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "./ui";

/** 게시 후 인스타 URL을 붙여넣어 카드 ↔ 게시물을 연결 (피드백 루프의 시작점) */
export function LinkPost({ cardId, compact = false }: { cardId: string; compact?: boolean }) {
  const s = useStore();
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const linked = s.linkedUrlOf(cardId);
  const post = s.posts.find((p) => p.card_id === cardId);

  if (linked) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {post ? <CheckCircle2 size={16} className="shrink-0 text-emerald-500" /> : <Loader2 size={16} className="shrink-0 animate-spin text-gray-400" />}
        <a href={linked} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">
          {linked.replace("https://www.instagram.com", "instagram.com")}
        </a>
        <span className="shrink-0 text-xs text-gray-500">{post ? "연결됨" : "성과 수집 대기"}</span>
      </div>
    );
  }

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!/instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]+/.test(url)) {
            setErr("인스타 릴스/게시물 URL을 붙여넣어 주세요");
            return;
          }
          setErr("");
          s.linkPost(cardId, url.trim());
          setUrl("");
        }}
      >
        <div className="relative flex-1">
          <Link2 size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="게시한 인스타 URL 붙여넣기"
            className="h-10 w-full rounded-md border border-gray-200 bg-gray-50 pr-3 pl-8 text-sm outline-none placeholder:text-gray-500 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <Button type="submit" size={compact ? "sm" : "md"} className={compact ? "h-10" : ""}>
          연결
        </Button>
      </form>
      {err && <p className="mt-1.5 text-xs text-red-500">{err}</p>}
    </div>
  );
}
