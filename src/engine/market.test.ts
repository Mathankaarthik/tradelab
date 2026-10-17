import { describe, expect, it } from 'vitest';
import { MarketEngine } from './market';
import { CLOSE_MIN, fmtClock, minuteOfDay } from '../utils/marketTime';

const START = Date.UTC(2026, 9, 14); // Wed 14 Oct 2026

describe('market engine', () => {
  it('starts closed at 9:00, opens at 9:15, runs a full day and ends at 3:30 PM', () => {
    const m = new MarketEngine(START);
    expect(fmtClock(m.time)).toBe('09:00:00 AM');
    m.skipToOpen(); expect(fmtClock(m.time)).toBe('09:15:00 AM');
    let ticks = 0, ended = false; const start = m.price('RELIANCE');
    while (!ended) { const r = m.step(); if (r.ticks) ticks++; ended = r.dayEnded; }
    expect(ticks).toBe(4500); expect(minuteOfDay(m.time)).toBe(CLOSE_MIN);
    const q = m.quote('RELIANCE');
    expect(q.high).toBeGreaterThanOrEqual(q.ltp); expect(q.low).toBeLessThanOrEqual(q.ltp);
    expect(Math.abs(q.ltp / start - 1)).toBeLessThan(0.2);
    const c1 = m.getCandles('RELIANCE', '1m'); const today = c1.slice(-375);
    expect(today.length).toBe(375);
    for (const c of today) { expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close)); expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close)); }
    expect(m.getCandles('RELIANCE', '15m').slice(-25).length).toBe(25);
    expect(m.getCandles('RELIANCE', '1D').length).toBe(181);
    m.startNextDay(); expect(fmtClock(m.time, false)).toBe('09:00 AM');
    expect(new Date(m.time).getUTCDay()).toBe(4);
  });
  it('history is deterministic and continues from the simulated price', () => {
    const a = new MarketEngine(START); const b = new MarketEngine(START);
    expect(a.getCandles('TCS', '1D')[10]).toEqual(b.getCandles('TCS', '1D')[10]);
    const last = a.getCandles('TCS', '1m').slice(-1)[0];
    expect(Math.abs(last.close - a.price('TCS'))).toBeLessThan(0.06);
  });
  it('snapshot restores prices and live candles', () => {
    const a = new MarketEngine(START); a.skipToOpen(); for (let i = 0; i < 500; i++) a.step();
    const b = new MarketEngine(START, JSON.parse(JSON.stringify(a.snapshot())));
    expect(b.price('INFY')).toBe(a.price('INFY')); expect(b.time).toBe(a.time);
    expect(b.getCandles('INFY', '5m').length).toBe(a.getCandles('INFY', '5m').length);
    a.step(); b.step(); expect(b.price('INFY')).toBe(a.price('INFY'));
  });
  it('nudge moves price by the requested amount only while open', () => {
    const m = new MarketEngine(START); expect(m.nudge('TCS', 1)).toBeNull();
    m.skipToOpen(); const p = m.price('TCS'); const bar = m.nudge('TCS', 0.5)!;
    expect(bar.close).toBeCloseTo(p + 0.5, 2); expect(m.price('TCS')).toBeCloseTo(p + 0.5, 2);
  });
});
