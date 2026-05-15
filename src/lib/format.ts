// 통화/날짜 포맷 유틸

const krw = new Intl.NumberFormat("ko-KR");

export function fmtWon(n: number): string {
  return `${krw.format(Math.round(n))}원`;
}

export function fmtWonShort(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  return krw.format(n);
}

export function fmtMonth(yearMonth: string): string {
  // YYYY-MM → "2026년 5월"
  const [y, m] = yearMonth.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}

export function fmtDate(date: string): string {
  // YYYY-MM-DD → "5/14 (목)"
  const d = new Date(date);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

export function todayKST(): string {
  // YYYY-MM-DD KST
  const now = new Date();
  const tz = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

export function thisMonthKST(): string {
  return todayKST().slice(0, 7);
}

// 'YYYY-MM' 에서 N개월치 (현재 포함, 과거로) 배열 반환 — 오래된 것 → 최신 순
export function lastNMonths(yearMonth: string, n: number): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    result.push(`${yyyy}-${mm}`);
  }
  return result;
}
