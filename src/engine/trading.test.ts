import { describe, expect, it } from 'vitest';
import { calculateCharges } from '../utils/charges';
import { calculatePositionSize, calculatePnL } from '../utils/pnl';
import {
  Ctx, OrderInput, accountValue, availableMargin, cancelOrder, closePosition, createInitialState, endOfDay, modifyOrder,
  placeOrder, processTick, setExit, unrealizedPnl, usedMargin, validateOrder,
} from './trading';
import type { AppState, TickBar } from '../types';

const SYM = 'TCS';
const mk = (price = 500, open = true) => {
  const px = { v: price };
  const ctx = (): Ctx => ({ price: () => px.v, prevClose: () => 500, time: 1_000_000, isOpen: open });
  return { px, ctx };
};
const bar = (open: number, close: number): TickBar => ({ open, close, high: Math.max(open, close), low: Math.min(open, close) });
const base = (): AppState => createInitialState(100000, 0);
const input = (o: Partial<OrderInput>): OrderInput => ({ symbol: SYM, side: 'BUY', qty: 10, product: 'MIS', type: 'MARKET', ...o });

describe('calculations', () => {
  it('position sizing matches the worked example', () => {
    const r = calculatePositionSize(100000, 1, 500, 490);
    expect(r.maxRisk).toBe(1000); expect(r.riskPerShare).toBe(10); expect(r.qty).toBe(100);
  });
  it('P&L signs', () => {
    expect(calculatePnL(10, 500, 575)).toBe(750);
    expect(calculatePnL(-10, 500, 490)).toBe(100);
  });
  it('charges: intraday sell has STT, buy has stamp duty, GST on brokerage+exchange+sebi', () => {
    const sell = calculateCharges({ side: 'SELL', product: 'MIS', price: 500, qty: 100 });
    expect(sell.stt).toBe(12.5); expect(sell.stamp).toBe(0); expect(sell.brokerage).toBe(15);
    const buy = calculateCharges({ side: 'BUY', product: 'MIS', price: 500, qty: 100 });
    expect(buy.stt).toBe(0); expect(buy.stamp).toBeGreaterThan(0);
    expect(sell.total).toBeCloseTo(sell.brokerage + sell.stt + sell.exchange + sell.gst + sell.sebi + sell.stamp, 2);
    const big = calculateCharges({ side: 'BUY', product: 'MIS', price: 500, qty: 1000 });
    expect(big.brokerage).toBe(20); // capped at Rs 20
  });
});

describe('orders', () => {
  it('market BUY fills with slippage (500 -> 500.15) and creates a position', () => {
    const { ctx } = mk(500); const r = placeOrder(base(), input({}), ctx());
    expect(r.ok).toBe(true);
    expect(r.state.orders[0].status).toBe('EXECUTED'); expect(r.state.orders[0].avgPrice).toBe(500.15);
    expect(r.state.positions[0].qty).toBe(10);
    expect(r.events[0].title).toBe('Order executed');
  });
  it('rejects bad input without executing', () => {
    const { ctx } = mk(500);
    for (const qty of [0, -5, 1.5, NaN]) { const r = placeOrder(base(), input({ qty }), ctx()); expect(r.ok).toBe(false); expect(r.state.orders.length).toBe(0); }
    expect(placeOrder(base(), input({ type: 'LIMIT', price: 0 }), ctx()).ok).toBe(false);
    expect(placeOrder(base(), input({ type: 'SL-M', side: 'SELL', trigger: 510 }), ctx()).ok).toBe(false);
  });
  it('insufficient funds is rejected and recorded as REJECTED', () => {
    const { ctx } = mk(500); const r = placeOrder(base(), input({ qty: 10000 }), ctx());
    expect(r.ok).toBe(false); expect(r.state.orders[0].status).toBe('REJECTED');
    expect(r.events[0].title).toBe('Insufficient virtual funds.'); expect(r.state.positions.length).toBe(0);
  });
  it('rejects orders when the market is closed', () => {
    const { ctx } = mk(500, false); const r = placeOrder(base(), input({}), ctx());
    expect(r.state.orders[0].status).toBe('REJECTED');
  });
  it('limit BUY stays pending, then executes when price reaches it; modify + cancel work', () => {
    const { ctx } = mk(500);
    let s = placeOrder(base(), input({ type: 'LIMIT', price: 495 }), ctx()).state;
    expect(s.orders[0].status).toBe('OPEN');
    s = processTick(s, { [SYM]: bar(500, 497) }, ctx()).state; expect(s.orders[0].status).toBe('OPEN');
    s = modifyOrder(s, s.orders[0].id, { price: 497, qty: 5 }, ctx()).state;
    expect(s.orders[0].price).toBe(497); expect(s.orders[0].qty).toBe(5);
    const t = processTick(s, { [SYM]: bar(497, 496) }, ctx());
    expect(t.state.orders[0].status).toBe('EXECUTED'); expect(t.state.orders[0].avgPrice).toBe(497);
    expect(t.events[0].title).toBe('Limit order executed.');
    const c = cancelOrder(placeOrder(base(), input({ type: 'LIMIT', price: 480 }), ctx()).state, 'ORD00001');
    expect(c.state.orders[0].status).toBe('CANCELLED');
  });
  it('stop-loss order triggers (SELL SL-M) and target/SL exits close a long position', () => {
    const { ctx, px } = mk(500);
    let s = placeOrder(base(), input({ stopLoss: 490, target: 510 }), ctx()).state;
    expect(s.exits['TCS:MIS']).toEqual({ target: 510, stopLoss: 490 });
    px.v = 489; let r = processTick(s, { [SYM]: bar(500, 489) }, ctx());
    expect(r.state.positions[0].qty).toBe(0); expect(r.events[0].title).toBe('STOP-LOSS HIT');
    expect(r.state.positions[0].realized).toBeCloseTo((490 - 500.15) * 10, 2);
    px.v = 500; s = placeOrder(base(), input({ stopLoss: 490, target: 510 }), ctx()).state;
    r = processTick(s, { [SYM]: bar(500, 511) }, ctx()); expect(r.events[0].title).toBe('TARGET HIT');
    expect(r.state.account.realizedPnl).toBeCloseTo((510 - 500.15) * 10, 2);
    px.v = 500; s = placeOrder(base(), input({ side: 'SELL', type: 'SL-M', trigger: 490 }), ctx()).state;
    r = processTick(s, { [SYM]: bar(500, 489) }, ctx()); expect(r.state.orders[0].status).toBe('EXECUTED');
  });
  it('short selling (MIS) profits when price falls and can be bought back', () => {
    const { ctx, px } = mk(500);
    let s = placeOrder(base(), input({ side: 'SELL' }), ctx()).state;
    expect(s.positions[0].qty).toBe(-10);
    px.v = 490; expect(unrealizedPnl(s, ctx()).total).toBeCloseTo((499.85 - 490) * 10, 2);
    s = closePosition(s, SYM, 'MIS', ctx()).state;
    expect(s.positions[0].qty).toBe(0); expect(s.account.realizedPnl).toBeGreaterThan(90);
  });
  it('CNC: cannot sell what you do not own; buy goes to holdings; funds are deducted', () => {
    const { ctx } = mk(500);
    expect(placeOrder(base(), input({ side: 'SELL', product: 'CNC' }), ctx()).ok).toBe(false);
    const s = placeOrder(base(), input({ product: 'CNC' }), ctx()).state;
    expect(s.holdings[0].qty).toBe(10); expect(s.account.cash).toBeLessThan(100000 - 5000);
    expect(placeOrder(s, input({ side: 'SELL', product: 'CNC', qty: 11 }), ctx()).ok).toBe(false);
    expect(placeOrder(s, input({ side: 'SELL', product: 'CNC', qty: 10 }), ctx()).ok).toBe(true);
  });
  it('MIS uses 5x leverage margin and account value is conserved (minus charges)', () => {
    const { ctx } = mk(500); const s = placeOrder(base(), input({ qty: 100 }), ctx()).state;
    expect(usedMargin(s)).toBeCloseTo((100 * 500.15) / 5, 2);
    expect(availableMargin(s)).toBeLessThan(100000 - 10000);
    expect(accountValue(s, ctx())).toBeCloseTo(100000 - s.account.chargesTotal + (500 - 500.15) * 100, 2);
  });
  it('end of day squares off MIS and expires open orders; CNC stays', () => {
    const { ctx } = mk(500);
    let s = placeOrder(base(), input({}), ctx()).state;
    s = placeOrder(s, input({ product: 'CNC', symbol: 'INFY', type: 'LIMIT', price: 450 }), { ...ctx(), price: () => 500 }).state;
    s = placeOrder(s, input({ product: 'CNC', qty: 2 }), ctx()).state;
    const r = endOfDay(s, ctx());
    expect(r.state.positions[0].qty).toBe(0); expect(r.state.holdings.length).toBe(1);
    expect(r.state.orders.filter((o) => o.status === 'OPEN').length).toBe(0);
    expect(r.state.lastEod?.squaredOff.length).toBe(1);
  });
  it('exit rule editing validates direction', () => {
    const { ctx } = mk(500); const s = placeOrder(base(), input({}), ctx()).state;
    expect(setExit(s, 'TCS:MIS', { stopLoss: 510 }, ctx()).ok).toBe(false);
    expect(setExit(s, 'TCS:MIS', { stopLoss: 490, target: 520 }, ctx()).ok).toBe(true);
  });
  it('validateOrder flags stop-loss on the wrong side of entry', () => {
    const { ctx } = mk(500);
    const issues = validateOrder(base(), input({ stopLoss: 505 }), ctx());
    expect(issues.some((i) => i.field === 'stopLoss')).toBe(true);
  });
});
