/** 한국 시간(KST) 기준 오늘 날짜 YYYY-MM-DD. 서버는 UTC로 돌기 때문에 직접 계산한다. */
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export const koDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${DOW[dt.getDay()]})`;
};

export const shortDate = (s: string) => {
  const [, m, d] = s.split("-").map(Number);
  return `${m}/${d}`;
};

export const compact = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}만`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천`;
  return String(Math.round(n));
};

export const mult = (n: number) => `${n.toFixed(n >= 10 ? 0 : 1)}x`;

export const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
