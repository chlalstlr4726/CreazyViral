// 피드 영상 주소가 아직 쓸 수 있는지 보는 규칙(서버·브라우저 둘 다 씀). 서버 열쇠를 다루는 코드는 넣지 않는다.

/** 영상 주소가 만료되기 이만큼 전부터는 퍼가기 창으로 돌린다(재생 도중 끊기지 않게). */
export const VIDEO_EXPIRY_MARGIN_MS = 10 * 60_000;

/** 영상 주소가 지금(now) 기준으로 아직 살아 있나. 만료 시각을 모르면 쓰지 않는다. */
export function isVideoAlive(videoUrl: string | null, expiresAt: string | null, now = Date.now()) {
  if (!videoUrl || !expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t - VIDEO_EXPIRY_MARGIN_MS > now;
}
