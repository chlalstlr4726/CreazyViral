"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { isVideoAlive } from "@/lib/feedVideo";
import type { FeedItem } from "@/lib/feed";

type Media = Pick<FeedItem, "shortcode" | "username" | "videoUrl" | "videoExpiresAt" | "thumbnailUrl" | "embedUrl">;
export type MediaMode = "video" | "embed";

/**
 * 릴스 한 편의 영상 칸(C안, 도하 결정 2026-11-17).
 * - 영상 주소가 살아 있으면 우리 화면 안에서 <video>로 재생한다.
 * - 주소가 없거나, 만료됐거나, 재생이 실패하면 인스타 공식 퍼가기 창(iframe)을 보인다.
 * - 영상 파일은 저장하지 않는다. 인스타 주소를 그대로 쓴다.
 * 모양(크기, 모서리, 버튼)은 바깥에서 정한다. 이 칸은 부모를 꽉 채운다.
 */
export function FeedMedia({
  item,
  active,
  muted = true,
  onMode,
  className,
}: {
  item: Media;
  /** 지금 화면에 보이는 편이면 true: 재생한다. false면 멈춘다. */
  active: boolean;
  muted?: boolean;
  onMode?: (mode: MediaMode) => void;
  className?: string;
}) {
  // 서버가 읽을 때 이미 만료된 주소는 null로 보냈다. 첫 화면은 그것만 보고 정한다(서버·브라우저 화면이 같게).
  const [mode, setMode] = useState<MediaMode>(item.videoUrl ? "video" : "embed");
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => onMode?.(mode), [mode, onMode]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted, mode]);

  // 보이는 편만 재생하고 지나간 편은 멈춘다. 재생 직전에 만료를 한 번 더 본다.
  useEffect(() => {
    const v = ref.current;
    if (mode !== "video" || !v) return;
    if (!active) {
      v.pause();
      return;
    }
    if (!isVideoAlive(item.videoUrl, item.videoExpiresAt)) {
      setMode("embed");
      return;
    }
    v.play().then(
      () => setPaused(false),
      () => setPaused(true), // 브라우저가 자동 재생을 막으면 눌러서 재생
    );
  }, [active, mode, item.videoUrl, item.videoExpiresAt]);

  if (mode === "embed") {
    return (
      <iframe
        src={item.embedUrl}
        title={`@${item.username} 릴스 (인스타그램 퍼가기 창)`}
        loading="lazy"
        allow="encrypted-media; picture-in-picture; web-share"
        className={clsx("h-full w-full border-0 bg-white", className)}
      />
    );
  }

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setPaused(false), () => setMode("embed"));
    else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <video
      ref={ref}
      src={item.videoUrl ?? undefined}
      poster={item.thumbnailUrl ?? undefined}
      muted={muted}
      loop
      playsInline
      preload={active ? "auto" : "metadata"}
      onError={() => setMode("embed")}
      onClick={toggle}
      aria-label={`@${item.username} 릴스 영상${paused ? " (멈춤, 누르면 재생)" : ""}`}
      className={clsx("h-full w-full cursor-pointer bg-black object-contain", className)}
    />
  );
}
