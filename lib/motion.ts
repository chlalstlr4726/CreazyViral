// 애플식 움직임 기본값(2026-11-18, apple-design 적용). 모든 화면이 같은 스프링을 쓴다.
// - 기본은 튕김 없음(감쇠 1.0): 메뉴, 알림, 카드처럼 손으로 던지지 않은 움직임.
// - 살짝 튕김(감쇠 약 0.8)은 손으로 끌다 놓았을 때처럼 힘이 실린 움직임에만 쓴다.
// - 스프링은 움직이는 도중에 새 목표가 오면 지금 위치·속도에서 이어 간다(중간에 잡아 되돌릴 수 있다).
// '움직임 줄이기' 설정은 Shell의 MotionConfig(reducedMotion="user")가 받아서, 위치·크기 움직임을 끄고 흐려짐만 남긴다.

export const spring = { type: "spring", bounce: 0, visualDuration: 0.35 } as const;
export const springSnappy = { type: "spring", bounce: 0, visualDuration: 0.22 } as const;
export const springGentle = { type: "spring", bounce: 0, visualDuration: 0.5 } as const;
/** 손으로 끌다 놓은 뒤에만: 살짝 튕김 */
export const springFlick = { type: "spring", bounce: 0.2, visualDuration: 0.35 } as const;

/**
 * 손을 뗀 속도로 '어디까지 갈지' 미리 계산한다(애플 Designing Fluid Interfaces의 감속 투영).
 * velocity는 px/초, 반환값은 px. 이 값을 지금 위치에 더한 곳에서 가장 가까운 멈춤 자리를 고른다.
 */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
