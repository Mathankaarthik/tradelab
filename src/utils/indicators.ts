import type { Candle } from '../types';

export function sma(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = []; let sum = 0;
  values.forEach((v, i) => { sum += v; if (i >= n) sum -= values[i - n]; out.push(i >= n - 1 ? sum / n : null); });
  return out;
}
export function ema(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = []; const k = 2 / (n + 1); let prev: number | null = null;
  values.forEach((v, i) => {
    if (i < n - 1) { out.push(null); return; }
    prev = prev === null ? values.slice(0, n).reduce((a, b) => a + b, 0) / n : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}
/** VWAP that restarts every trading day. */
export function vwap(c: Candle[]): (number | null)[] {
  let day = -1, pv = 0, vv = 0;
  return c.map((x) => {
    const d = Math.floor(x.time / 86400);
    if (d !== day) { day = d; pv = 0; vv = 0; }
    const tp = (x.high + x.low + x.close) / 3; pv += tp * x.volume; vv += x.volume;
    return vv > 0 ? pv / vv : null;
  });
}
export function rsi(values: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  if (values.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = values[i] - values[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= n; l /= n; out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
