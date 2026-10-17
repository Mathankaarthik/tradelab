/**
 * Simulated time is stored as "naive IST": a millisecond value whose UTC fields equal the
 * Indian wall-clock time. That keeps everything independent of the browser's timezone.
 */
export const DAY_MS = 86_400_000;
export const OPEN_MIN = 9 * 60 + 15; // 9:15 AM
export const CLOSE_MIN = 15 * 60 + 30; // 3:30 PM
export const SESSION_MIN = CLOSE_MIN - OPEN_MIN; // 375

export const startOfDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;
export const minuteOfDay = (ms: number) => Math.floor((ms - startOfDay(ms)) / 60000);
export const isTradingDay = (ms: number) => { const d = new Date(ms).getUTCDay(); return d !== 0 && d !== 6; };
export const isMarketOpen = (ms: number) => { const m = minuteOfDay(ms); return isTradingDay(ms) && m >= OPEN_MIN && m < CLOSE_MIN; };
export const nextTradingDay = (dayStart: number) => { let d = startOfDay(dayStart) + DAY_MS; while (!isTradingDay(d)) d += DAY_MS; return d; };
export const currentIstDay = () => { let d = startOfDay(Date.now() + 5.5 * 3600_000); while (!isTradingDay(d)) d += DAY_MS; return d; };

export function marketStatus(ms: number): { open: boolean; label: string; detail: string } {
  const m = minuteOfDay(ms);
  if (isMarketOpen(ms)) return { open: true, label: 'Market Open', detail: 'Closes at 3:30 PM' };
  if (m < OPEN_MIN) return { open: false, label: 'Market Closed', detail: 'Opens at 9:15 AM' };
  return { open: false, label: 'Market Closed', detail: 'Closed at 3:30 PM' };
}

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function fmtClock(ms: number, seconds = true) {
  const d = new Date(ms); const h = d.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${pad(d.getUTCMinutes())}${seconds ? ':' + pad(d.getUTCSeconds()) : ''} ${h < 12 ? 'AM' : 'PM'}`;
}
export function fmtDate(ms: number) { const d = new Date(ms); return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
export function fmtDow(ms: number) { return DOW[new Date(ms).getUTCDay()]; }
