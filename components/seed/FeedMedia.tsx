"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { Play } from "lucide-react";
import { isVideoAlive } from "@/lib/feedVideo";
import type { FeedItem } from "@/lib/feed";

type Media = Pick<FeedItem, "shortcode" | "username" | "videoUrl" | "videoExpiresAt" | "thumbnailUrl" | "embedUrl">;
export type MediaMode = "video" | "embed";

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener?.("change", cb);
  return () => mq.removeEventListener?.("change", cb);
};
/** 기기의 '움직임 줄이기' 설정. 도중에 켜고 꺼도 바로 따라 바뀐다(motion의 useReducedMotion은 처음 한 번만 읽는다). */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
}

/**
 * 릴스 한 편의 영상 칸(C안, 도하 결정 2026-11-17).
 * - 영상 주소가 살아 있으면 우리 화면 안에서 <video>로 재생한다.
 * - 주소가 없거나, 만료됐거나, 재생이 실패하면 인스타 공식 퍼가기 창(iframe)을 보인다.
 * - 영상 파일은 저장하지 않는다. 인스타 주소를 그대로 쓴다.
 * - '움직임 줄이기'를 켜면 저절로 틀지 않는다: 첫 장면(표지 그림)과 재생 단추를 보이고, 눌러야 재생한다.
 *   브라우저가 자동 재생을 막았을 때도 같은 재생 단추를 보인다.
 * 모양(크기, 모서리, 버튼)은 바깥에서 정한다. 이 칸은 부모를 꽉 채운다(재생 단추는 부모 한가운데에 뜬다: 부모는 position이 있어야 한다).
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
  /** 저절로 재생되지 않고 누르기를 기다리는 중(움직임 줄이기, 또는 브라우저가 자동 재생을 막음) */
  const [waiting, setWaiting] = useState(false);
  const reduce = usePrefersReducedMotion();
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
    if (reduce) {
      // 움직임 줄이기: 저절로 틀지 않는다. 첫 장면과 재생 단추를 보인다.
      v.pause();
      setPaused(true);
      setWaiting(true);
      return;
    }
    v.play().then(
      () => {
        setPaused(false);
        setWaiting(false);
      },
      () => {
        setPaused(true); // 브라우저가 자동 재생을 막으면 눌러서 재생
        setWaiting(true);
      },
    );
  }, [active, mode, item.videoUrl, item.videoExpiresAt, reduce]);

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
    if (v.paused)
      v.play().then(
        () => {
          setPaused(false);
          setWaiting(false);
        },
        () => setMode("embed"),
      );
    else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <>
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
      {active && waiting && (
        <button type="button" className="seed-play press" onClick={toggle} aria-label={`@${item.username} 릴스 재생`}>
          <Play size={26} fill="currentColor" strokeWidth={0} aria-hidden="true" />
        </button>
      )}
    </>
  );
}
