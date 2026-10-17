import { STOCKS, StockInfo } from '../config/stocks';
import { SIM } from '../config/sim';
import type { Candle, TickBar, Timeframe } from '../types';
import { CLOSE_MIN, DAY_MS, OPEN_MIN, SESSION_MIN, isTradingDay, minuteOfDay, nextTradingDay, startOfDay } from '../utils/marketTime';
import { clamp, round2, roundTick } from '../utils/price';
import { Rng, hashStr } from '../utils/rng';

/**
 * Market simulation engine (framework independent).
 *
 *  - Every stock is a random walk with a hidden "regime" (up / down / sideways / calm / volatile).
 *    The regime changes every 12-75 simulated minutes and scales drift + volatility.
 *  - One tick = 5 simulated seconds. Each tick produces open/high/low/close/volume and is folded
 *    into the current 1-minute candle. Higher timeframes are aggregated from 1m candles.
 *  - Past history (180 trading days) is generated deterministically from a seed, so reloading the
 *    page rebuilds the same chart. Only today's live candles + a few numbers are persisted.
 *  - This is a toy model. It does NOT predict, mimic, or follow real markets.
 */

type Regime = 'UP' | 'DOWN' | 'SIDEWAYS' | 'CALM' | 'VOLATILE';
const REGIMES: Record<Regime, { drift: number; volMul: number; volumeMul: number; weight: number }> = {
  UP: { drift: 0.07, volMul: 1, volumeMul: 1.15, weight: 22 },
  DOWN: { drift: -0.07, volMul: 1, volumeMul: 1.15, weight: 22 },
  SIDEWAYS: { drift: 0, volMul: 0.65, volumeMul: 0.85, weight: 30 },
  CALM: { drift: 0, volMul: 0.45, volumeMul: 0.7, weight: 12 },
  VOLATILE: { drift: 0, volMul: 2.1, volumeMul: 1.6, weight: 14 },
};
const REGIME_KEYS = Object.keys(REGIMES) as Regime[];
const TICKS_PER_DAY = (SESSION_MIN * 60) / SIM.tickSeconds; // 4500
const HISTORY_DAYS = 180;
const INTRADAY_HISTORY_DAYS = 5;

export const TF_MINUTES: Record<Exclude<Timeframe, '1D'>, number> = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1H': 60 };

interface StockSim {
  info: StockInfo;
  price: number; prevClose: number; dayOpen: number; dayHigh: number; dayLow: number; dayVolume: number;
  regime: Regime; regimeLeft: number; rng: Rng;
  daily: Candle[]; baseDailyLen: number;
  intraday: Candle[]; // history of 1m candles (previous days)
  today: Candle[]; // 1m candles of the current simulated day
}

export interface Quote {
  symbol: string; ltp: number; open: number; high: number; low: number; prevClose: number;
  change: number; changePct: number; volume: number; lowerCircuit: number; upperCircuit: number;
}

export interface StepResult { ticks: Record<string, TickBar> | null; dayEnded: boolean }

export interface MarketSnapshot {
  v: 1; time: number;
  stocks: Record<string, {
    p: number; pc: number; o: number; h: number; l: number; vol: number; rg: Regime; rl: number; rs: number;
    today: number[][]; extra: number[][];
  }>;
}

const pickRegime = (rng: Rng): Regime => {
  const total = REGIME_KEYS.reduce((a, k) => a + REGIMES[k].weight, 0);
  let r = rng.next() * total;
  for (const k of REGIME_KEYS) { r -= REGIMES[k].weight; if (r <= 0) return k; }
  return 'SIDEWAYS';
};

const shape = (minSinceOpen: number) =>
  0.85 + 0.9 * Math.exp(-minSinceOpen / 30) + 0.5 * Math.exp(-(SESSION_MIN - minSinceOpen) / 30);

function fixCandle(c: Candle): Candle {
  c.high = Math.max(c.high, c.open, c.close); c.low = Math.min(c.low, c.open, c.close); return c;
}

/** Deterministic history: 175 daily candles + 5 days of 1-minute candles, rescaled to end at info.price. */
function generateHistory(info: StockInfo, startDay: number) {
  const rng = new Rng(hashStr(info.symbol) ^ 0x9e3779b9);
  const days: number[] = []; let d = startDay;
  while (days.length < HISTORY_DAYS) { d -= DAY_MS; if (isTradingDay(d)) days.unshift(d); }
  const dailyDays = days.slice(0, HISTORY_DAYS - INTRADAY_HISTORY_DAYS);
  const intraDays = days.slice(HISTORY_DAYS - INTRADAY_HISTORY_DAYS);
  let price = info.price * (0.85 + rng.next() * 0.3);
  const daily: Candle[] = []; const intraday: Candle[] = [];

  for (const day of dailyDays) {
    const o = price * (1 + rng.gauss() * 0.004);
    const c = o * (1 + 0.0003 + rng.gauss() * info.dailyVol);
    const hi = Math.max(o, c) * (1 + Math.abs(rng.gauss()) * info.dailyVol * 0.4);
    const lo = Math.min(o, c) * (1 - Math.abs(rng.gauss()) * info.dailyVol * 0.4);
    daily.push({ time: day / 1000, open: o, high: hi, low: lo, close: c, volume: Math.round(info.avgVolume * (0.6 + rng.next() * 0.8)) });
    price = c;
  }
  for (const day of intraDays) {
    price *= 1 + rng.gauss() * 0.003;
    let regimeLeft = 0; let drift = 0; let vm = 1;
    const first = intraday.length;
    for (let i = 0; i < SESSION_MIN; i++) {
      if (regimeLeft-- <= 0) { const rg = REGIMES[pickRegime(rng)]; drift = rg.drift; vm = rg.volMul; regimeLeft = 20 + Math.floor(rng.next() * 60); }
      const sigma = (info.dailyVol / Math.sqrt(SESSION_MIN)) * vm * shape(i);
      const o = price; const c = o * (1 + drift * sigma + sigma * rng.gauss());
      const wick = sigma * o * 0.6;
      intraday.push({
        time: (day + (OPEN_MIN + i) * 60000) / 1000, open: o, close: c,
        high: Math.max(o, c) + wick * rng.next(), low: Math.min(o, c) - wick * rng.next(),
        volume: Math.round((info.avgVolume / SESSION_MIN) * shape(i) * (0.5 + rng.next())),
      });
      price = c;
    }
    const sl = intraday.slice(first);
    daily.push({
      time: day / 1000, open: sl[0].open, close: sl[sl.length - 1].close,
      high: Math.max(...sl.map((x) => x.high)), low: Math.min(...sl.map((x) => x.low)),
      volume: sl.reduce((a, x) => a + x.volume, 0),
    });
  }
  const scale = info.price / price;
  const fix = (c: Candle) => {
    c.open = roundTick(c.open * scale); c.high = roundTick(c.high * scale); c.low = roundTick(c.low * scale); c.close = roundTick(c.close * scale);
    fixCandle(c);
  };
  daily.forEach(fix); intraday.forEach(fix);
  return { daily, intraday };
}

/** Aggregate 1m candles into N-minute candles (session aligned: 9:15, 9:20, ...). */
export function aggregateCandles(src: Candle[], tfMin: number): Candle[] {
  if (tfMin === 1) return src;
  const out: Candle[] = []; let lastKey = -1;
  for (const c of src) {
    const ms = c.time * 1000;
    const bucket = Math.floor((minuteOfDay(ms) - OPEN_MIN) / tfMin);
    const key = Math.floor(ms / DAY_MS) * 1000 + bucket;
    if (key !== lastKey) {
      lastKey = key;
      out.push({ time: (startOfDay(ms) + (OPEN_MIN + bucket * tfMin) * 60000) / 1000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    } else {
      const l = out[out.length - 1];
      l.high = Math.max(l.high, c.high); l.low = Math.min(l.low, c.low); l.close = c.close; l.volume += c.volume;
    }
  }
  return out;
}

const toArr = (c: Candle) => [c.time, round2(c.open), round2(c.high), round2(c.low), round2(c.close), c.volume];
const fromArr = (a: number[]): Candle => ({ time: a[0], open: a[1], high: a[2], low: a[3], close: a[4], volume: a[5] });

export class MarketEngine {
  /** Simulated clock (naive IST ms). */
  time: number;
  readonly startDay: number;
  private stocks: Record<string, StockSim> = {};

  constructor(startDay: number, snapshot?: MarketSnapshot | null) {
    this.startDay = startDay;
    this.time = startDay + 9 * 3600_000;
    this.build();
    if (snapshot && snapshot.v === 1) this.restore(snapshot);
  }

  /** Throw away all live data and return to the first simulated morning (used by Reset Account). */
  reset() { this.time = this.startDay + 9 * 3600_000; this.build(); }

  private build() {
    this.stocks = {};
    for (const info of STOCKS) {
      const h = generateHistory(info, this.startDay);
      const rng = new Rng(hashStr(info.symbol) ^ this.startDay);
      const price = roundTick(info.price);
      this.stocks[info.symbol] = {
        info, price, prevClose: price, dayOpen: price, dayHigh: price, dayLow: price, dayVolume: 0,
        regime: pickRegime(rng), regimeLeft: 200 + Math.floor(rng.next() * 600), rng,
        daily: h.daily, baseDailyLen: h.daily.length, intraday: h.intraday, today: [],
      };
    }
  }

  private restore(sn: MarketSnapshot) {
    this.time = sn.time;
    for (const sym of Object.keys(sn.stocks)) {
      const s = this.stocks[sym]; const d = sn.stocks[sym];
      if (!s) continue;
      s.price = d.p; s.prevClose = d.pc; s.dayOpen = d.o; s.dayHigh = d.h; s.dayLow = d.l; s.dayVolume = d.vol;
      s.regime = d.rg; s.regimeLeft = d.rl; s.rng = new Rng(d.rs);
      s.today = d.today.map(fromArr);
      for (const e of d.extra) s.daily.push(fromArr(e));
    }
  }

  snapshot(): MarketSnapshot {
    const stocks: MarketSnapshot['stocks'] = {};
    for (const sym of Object.keys(this.stocks)) {
      const s = this.stocks[sym];
      stocks[sym] = {
        p: s.price, pc: s.prevClose, o: s.dayOpen, h: s.dayHigh, l: s.dayLow, vol: s.dayVolume,
        rg: s.regime, rl: s.regimeLeft, rs: s.rng.s,
        today: s.today.map(toArr), extra: s.daily.slice(s.baseDailyLen).map(toArr),
      };
    }
    return { v: 1, time: this.time, stocks };
  }

  symbols() { return Object.keys(this.stocks); }
  info(sym: string) { return this.stocks[sym]?.info; }
  price(sym: string) { return this.stocks[sym]?.price ?? 0; }
  prevClose(sym: string) { return this.stocks[sym]?.prevClose ?? 0; }

  quote(sym: string): Quote {
    const s = this.stocks[sym];
    const change = s.price - s.prevClose;
    return {
      symbol: sym, ltp: s.price, open: s.dayOpen, high: s.dayHigh, low: s.dayLow, prevClose: s.prevClose,
      change, changePct: s.prevClose ? (change / s.prevClose) * 100 : 0, volume: s.dayVolume,
      lowerCircuit: roundTick(s.prevClose * (1 - SIM.circuitPct)), upperCircuit: roundTick(s.prevClose * (1 + SIM.circuitPct)),
    };
  }

  /** Candles for charting. Times are UTC seconds of the naive-IST clock. */
  getCandles(sym: string, tf: Timeframe): Candle[] {
    const s = this.stocks[sym];
    if (tf === '1D') {
      const out = s.daily.slice();
      if (s.today.length) {
        out.push({
          time: startOfDay(this.time) / 1000, open: s.dayOpen, high: s.dayHigh, low: s.dayLow,
          close: s.price, volume: s.dayVolume,
        });
      }
      return out;
    }
    return aggregateCandles(s.intraday.concat(s.today), TF_MINUTES[tf]);
  }

  /** Advance the simulation by one tick. Returns per-symbol tick bars while the market is open. */
  step(): StepResult {
    const m = minuteOfDay(this.time);
    if (m < OPEN_MIN) { this.time = Math.min(this.time + 60_000, startOfDay(this.time) + OPEN_MIN * 60_000); return { ticks: null, dayEnded: false }; }
    if (m >= CLOSE_MIN) return { ticks: null, dayEnded: false };
    const ticks: Record<string, TickBar> = {};
    for (const sym of Object.keys(this.stocks)) ticks[sym] = this.tickStock(this.stocks[sym], m);
    this.time += SIM.tickSeconds * 1000;
    const ended = minuteOfDay(this.time) >= CLOSE_MIN;
    if (ended) this.time = startOfDay(this.time) + CLOSE_MIN * 60_000;
    return { ticks, dayEnded: ended };
  }

  private tickStock(s: StockSim, m: number): TickBar {
    if (--s.regimeLeft <= 0) { s.regime = pickRegime(s.rng); s.regimeLeft = 150 + Math.floor(s.rng.next() * 750); }
    const rg = REGIMES[s.regime];
    const since = m - OPEN_MIN;
    const sh = shape(since);
    const sigma = (s.info.dailyVol / Math.sqrt(TICKS_PER_DAY)) * rg.volMul * sh;
    const revert = -SIM.meanRevert * Math.log(s.price / s.dayOpen);
    const ret = clamp(rg.drift * sigma + revert + sigma * s.rng.gauss(), -0.01, 0.01);
    const open = s.price;
    const close = clamp(roundTick(open * (1 + ret)), roundTick(s.prevClose * (1 - SIM.circuitPct)), roundTick(s.prevClose * (1 + SIM.circuitPct)));
    const wick = sigma * open * 0.5 * Math.abs(s.rng.gauss());
    const high = roundTick(Math.max(open, close) + wick * s.rng.next());
    const low = roundTick(Math.min(open, close) - wick * s.rng.next());
    const volume = Math.max(1, Math.round((s.info.avgVolume / TICKS_PER_DAY) * sh * rg.volumeMul * (0.5 + s.rng.next()) * (1 + (Math.abs(ret) / sigma) * 0.3)));
    return this.apply(s, { open, high, low, close }, volume);
  }

  /** Fold a tick into daily stats and the live 1-minute candle. */
  private apply(s: StockSim, bar: TickBar, volume: number): TickBar {
    s.price = bar.close;
    s.dayHigh = Math.max(s.dayHigh, bar.high); s.dayLow = Math.min(s.dayLow, bar.low); s.dayVolume += volume;
    const minuteStart = Math.floor(this.time / 60000) * 60;
    const last = s.today[s.today.length - 1];
    if (!last || last.time !== minuteStart) {
      s.today.push({ time: minuteStart, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume });
    } else {
      last.high = Math.max(last.high, bar.high); last.low = Math.min(last.low, bar.low); last.close = bar.close; last.volume += volume;
    }
    return bar;
  }

  /** Manually move a price (educational testing of stop-loss / target). Returns the tick, or null if market is closed. */
  nudge(sym: string, delta: number): TickBar | null {
    const m = minuteOfDay(this.time);
    if (!isTradingDay(this.time) || m < OPEN_MIN || m >= CLOSE_MIN) return null;
    const s = this.stocks[sym]; if (!s) return null;
    const lo = roundTick(s.prevClose * (1 - SIM.circuitPct)); const hi = roundTick(s.prevClose * (1 + SIM.circuitPct));
    const close = clamp(roundTick(s.price + delta), lo, hi);
    if (close === s.price) return null;
    const open = s.price;
    return this.apply(s, { open, high: Math.max(open, close), low: Math.min(open, close), close }, 0);
  }

  skipToOpen() {
    const open = startOfDay(this.time) + OPEN_MIN * 60_000;
    if (this.time < open) this.time = open;
  }

  isDayOver() { return minuteOfDay(this.time) >= CLOSE_MIN; }

  /** Finish the day: store the daily candle, apply an overnight gap, move the clock to the next trading day at 9:00. */
  startNextDay() {
    for (const s of Object.values(this.stocks)) {
      if (s.today.length) {
        s.daily.push({ time: startOfDay(this.time) / 1000, open: s.dayOpen, high: s.dayHigh, low: s.dayLow, close: s.price, volume: s.dayVolume });
        s.intraday = s.intraday.concat(s.today).slice(-SESSION_MIN * 6);
      }
      s.prevClose = s.price;
      const gap = clamp(s.rng.gauss() * s.info.dailyVol * 0.35, -0.03, 0.03);
      s.price = roundTick(s.prevClose * (1 + gap)); s.dayOpen = s.price; s.dayHigh = s.price; s.dayLow = s.price;
      s.dayVolume = 0; s.today = [];
      s.regime = pickRegime(s.rng); s.regimeLeft = 150 + Math.floor(s.rng.next() * 750);
    }
    this.time = nextTradingDay(this.time) + 9 * 3600_000;
  }
}
