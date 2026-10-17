import { DEFAULT_WATCHLIST, STOCK_MAP } from '../config/stocks';
import { SIM } from '../config/sim';
import type {
  AppEvent, AppState, ChargeBreakdown, EodLine, ExitRule, Order, OrderTag, OrderType, Position, Product, Settings,
  Side, TickBar, Trade,
} from '../types';
import { calculateCharges } from '../utils/charges';
import { fmtINR, fmtSigned } from '../utils/format';
import { calculateMargin } from '../utils/margin';
import { calculateAveragePrice, calculatePnL } from '../utils/pnl';
import { isOnTick, round2, roundTick } from '../utils/price';

/** Everything the pure trading functions need to know about the outside world. */
export interface Ctx {
  price: (symbol: string) => number;
  prevClose: (symbol: string) => number;
  time: number;
  isOpen: boolean;
}
export interface OrderInput {
  symbol: string; side: Side; qty: number; product: Product; type: OrderType;
  price?: number; trigger?: number; target?: number; stopLoss?: number;
}
export interface Issue { field: 'qty' | 'price' | 'trigger' | 'target' | 'stopLoss' | 'funds' | 'market' | 'holding' | 'general'; message: string; reject?: boolean }
export interface Result { state: AppState; events: AppEvent[]; issues?: Issue[]; ok?: boolean; orderId?: string }

export const DEFAULT_SETTINGS: Settings = {
  startingCapital: SIM.defaultCapital, theme: 'dark', beginnerMode: true, speed: 1,
  chartType: 'candles', showCharges: true, showExplanations: true,
};
export const posKey = (symbol: string, product: Product) => `${symbol}:${product}`;
const pad = (n: number, w: number) => String(n).padStart(w, '0');

export function createInitialState(capital: number, startDay: number, keep?: Partial<AppState>): AppState {
  return {
    version: 1,
    account: { startingCapital: capital, cash: capital, realizedPnl: 0, chargesTotal: 0, dayStartValue: capital, dayRealized: 0, dayCharges: 0 },
    positions: [], holdings: [], orders: [], trades: [], exits: {},
    watchlist: [...DEFAULT_WATCHLIST], settings: { ...DEFAULT_SETTINGS, startingCapital: capital },
    equity: [{ t: startDay + 9 * 3600_000, v: capital }],
    seq: { order: 0, trade: 0 }, tutorialDone: false, startDay, selected: 'RELIANCE', lastEod: null,
    ...keep,
  };
}

function cloneState(s: AppState): AppState {
  return {
    ...s, account: { ...s.account }, positions: s.positions.map((p) => ({ ...p })), holdings: s.holdings.map((h) => ({ ...h })),
    orders: s.orders.map((o) => ({ ...o })), exits: { ...s.exits }, seq: { ...s.seq },
  };
}

// ---------------------------------------------------------------- account maths
export function usedMargin(s: AppState): number {
  return s.positions.reduce((a, p) => a + (p.qty !== 0 ? calculateMargin(Math.abs(p.qty) * p.avgPrice, 'MIS') : 0), 0);
}
export const availableMargin = (s: AppState) => s.account.cash - usedMargin(s);
export function unrealizedPnl(s: AppState, ctx: Ctx) {
  const mis = s.positions.reduce((a, p) => a + (p.qty !== 0 ? calculatePnL(p.qty, p.avgPrice, ctx.price(p.symbol)) : 0), 0);
  const cnc = s.holdings.reduce((a, h) => a + calculatePnL(h.qty, h.avgPrice, ctx.price(h.symbol)), 0);
  return { mis, cnc, total: mis + cnc };
}
export function holdingsValue(s: AppState, ctx: Ctx) { return s.holdings.reduce((a, h) => a + h.qty * ctx.price(h.symbol), 0); }
export function accountValue(s: AppState, ctx: Ctx) { return s.account.cash + holdingsValue(s, ctx) + unrealizedPnl(s, ctx).mis; }

/** Extra margin needed if this order were filled at `price` (0 when it only reduces an existing position). */
export function calculateRequiredMargin(s: AppState, side: Side, product: Product, symbol: string, qty: number, price: number): number {
  if (product === 'CNC') return side === 'BUY' ? qty * price : 0;
  const pos = s.positions.find((p) => p.symbol === symbol && p.product === 'MIS');
  const cur = pos?.qty ?? 0; const avg = pos?.avgPrice ?? 0;
  const signed = side === 'BUY' ? qty : -qty;
  const before = calculateMargin(Math.abs(cur) * avg, 'MIS');
  let afterNotional: number;
  if (cur === 0 || Math.sign(cur) === Math.sign(signed)) afterNotional = Math.abs(cur) * avg + qty * price;
  else if (qty <= Math.abs(cur)) afterNotional = (Math.abs(cur) - qty) * avg;
  else afterNotional = (qty - Math.abs(cur)) * price;
  return Math.max(0, calculateMargin(afterNotional, 'MIS') - before);
}

const fundsShort = (s: AppState, side: Side, product: Product, symbol: string, qty: number, price: number) => {
  const need = calculateRequiredMargin(s, side, product, symbol, qty, price);
  if (need <= 0) return false;
  return need + calculateCharges({ side, product, price, qty }).total > availableMargin(s) + 1e-9;
};

// ---------------------------------------------------------------- estimates & validation
export interface Estimate { price: number; value: number; charges: ChargeBreakdown; requiredMargin: number; net: number }
export function estimateOrder(s: AppState, i: OrderInput, ctx: Ctx): Estimate {
  const ltp = ctx.price(i.symbol);
  const slip = i.side === 'BUY' ? 1 + SIM.slippagePct : 1 - SIM.slippagePct;
  const raw = i.type === 'MARKET' ? roundTick(ltp * slip) : i.type === 'SL-M' ? roundTick((i.trigger || ltp) * slip) : i.price || ltp;
  const price = Number.isFinite(raw) && raw > 0 ? raw : ltp;
  const qty = Number.isFinite(i.qty) && i.qty > 0 ? i.qty : 0;
  const charges = calculateCharges({ side: i.side, product: i.product, price, qty });
  const value = price * qty;
  return {
    price, value, charges,
    requiredMargin: calculateRequiredMargin(s, i.side, i.product, i.symbol, qty, price),
    net: i.side === 'BUY' ? value + charges.total : value - charges.total,
  };
}

const pendingCncSell = (s: AppState, symbol: string, excludeId?: string) =>
  s.orders.filter((o) => o.status === 'OPEN' && o.side === 'SELL' && o.product === 'CNC' && o.symbol === symbol && o.id !== excludeId).reduce((a, o) => a + o.qty, 0);

export function validateOrder(s: AppState, i: OrderInput, ctx: Ctx, opts: { excludeOrderId?: string } = {}): Issue[] {
  const out: Issue[] = [];
  if (!STOCK_MAP[i.symbol]) { out.push({ field: 'general', message: 'Select a valid stock.' }); return out; }
  const ltp = ctx.price(i.symbol);
  const needsPrice = i.type === 'LIMIT' || i.type === 'SL';
  const needsTrigger = i.type === 'SL' || i.type === 'SL-M';
  const lo = roundTick(ctx.prevClose(i.symbol) * (1 - SIM.circuitPct)); const hi = roundTick(ctx.prevClose(i.symbol) * (1 + SIM.circuitPct));

  if (!Number.isFinite(i.qty)) out.push({ field: 'qty', message: 'Enter a quantity.' });
  else if (i.qty < 0) out.push({ field: 'qty', message: 'Quantity cannot be negative.' });
  else if (i.qty === 0) out.push({ field: 'qty', message: 'Quantity cannot be 0.' });
  else if (!Number.isInteger(i.qty)) out.push({ field: 'qty', message: 'Quantity must be a whole number.' });

  const price = i.price ?? NaN; const trig = i.trigger ?? NaN;
  if (needsPrice) {
    if (!Number.isFinite(price) || price <= 0) out.push({ field: 'price', message: 'Enter a valid price greater than 0.' });
    else if (!isOnTick(price)) out.push({ field: 'price', message: `Price must be a multiple of the tick size (${fmtINR(SIM.tickSize)}).` });
    else if (price < lo || price > hi) out.push({ field: 'price', message: `Price must be within circuit limits (${fmtINR(lo)} - ${fmtINR(hi)}).` });
  }
  if (needsTrigger) {
    if (!Number.isFinite(trig) || trig <= 0) out.push({ field: 'trigger', message: 'Enter a valid trigger price greater than 0.' });
    else if (!isOnTick(trig)) out.push({ field: 'trigger', message: `Trigger must be a multiple of the tick size (${fmtINR(SIM.tickSize)}).` });
    else if (i.side === 'SELL' && trig >= ltp) out.push({ field: 'trigger', message: `Stop-loss SELL trigger must be below the current price (${fmtINR(ltp)}).` });
    else if (i.side === 'BUY' && trig <= ltp) out.push({ field: 'trigger', message: `Stop-loss BUY trigger must be above the current price (${fmtINR(ltp)}).` });
    else if (i.type === 'SL' && Number.isFinite(price) && i.side === 'SELL' && price > trig) out.push({ field: 'price', message: 'For a SELL stop-loss, the limit price must be at or below the trigger.' });
    else if (i.type === 'SL' && Number.isFinite(price) && i.side === 'BUY' && price < trig) out.push({ field: 'price', message: 'For a BUY stop-loss, the limit price must be at or above the trigger.' });
  }

  // Exit rules: target / stop-loss attached to the entry
  const ref = i.type === 'MARKET' ? ltp : i.type === 'LIMIT' ? price : i.type === 'SL' ? (Number.isFinite(trig) ? trig : price) : trig;
  if (Number.isFinite(ref) && ref > 0) {
    const sl = i.stopLoss; const tg = i.target;
    if (sl !== undefined) {
      if (!Number.isFinite(sl) || sl <= 0) out.push({ field: 'stopLoss', message: 'Enter a valid stop-loss price.' });
      else if (!isOnTick(sl)) out.push({ field: 'stopLoss', message: 'Stop-loss must be a multiple of ₹0.05.' });
      else if (i.side === 'BUY' && sl >= ref) out.push({ field: 'stopLoss', message: 'For a BUY, stop-loss must be below your entry price.' });
      else if (i.side === 'SELL' && sl <= ref) out.push({ field: 'stopLoss', message: 'For a SELL (short), stop-loss must be above your entry price.' });
    }
    if (tg !== undefined) {
      if (!Number.isFinite(tg) || tg <= 0) out.push({ field: 'target', message: 'Enter a valid target price.' });
      else if (!isOnTick(tg)) out.push({ field: 'target', message: 'Target must be a multiple of ₹0.05.' });
      else if (i.side === 'BUY' && tg <= ref) out.push({ field: 'target', message: 'For a BUY, target must be above your entry price.' });
      else if (i.side === 'SELL' && tg >= ref) out.push({ field: 'target', message: 'For a SELL (short), target must be below your entry price.' });
    }
    if (i.product === 'CNC' && i.side === 'SELL' && (sl !== undefined || tg !== undefined)) out.push({ field: 'general', message: 'Target / stop-loss are set when you buy. Remove them for a delivery SELL.' });
  }

  if (!ctx.isOpen) out.push({ field: 'market', reject: true, message: 'Market is closed. Orders are accepted 9:15 AM - 3:30 PM (simulated clock).' });

  if (i.product === 'CNC' && i.side === 'SELL' && Number.isFinite(i.qty) && i.qty > 0) {
    const held = s.holdings.find((h) => h.symbol === i.symbol)?.qty ?? 0;
    const free = held - pendingCncSell(s, i.symbol, opts.excludeOrderId);
    if (i.qty > free) out.push({ field: 'holding', reject: true, message: free <= 0 ? `You have no ${i.symbol} shares in delivery (CNC) to sell. Short selling is only available for Intraday (MIS).` : `You can only sell ${free} ${i.symbol} share${free === 1 ? '' : 's'} from delivery (CNC).` });
  }

  if (out.every((x) => x.field !== 'qty' && x.field !== 'price' && x.field !== 'trigger') && Number.isFinite(i.qty) && i.qty > 0) {
    const est = estimateOrder(s, i, ctx);
    if (fundsShort(s, i.side, i.product, i.symbol, i.qty, est.price)) out.push({ field: 'funds', reject: true, message: 'Insufficient virtual funds.' });
  }
  return out;
}

// ---------------------------------------------------------------- core fill
function newOrder(s: AppState, i: OrderInput, ctx: Ctx, tag: OrderTag = 'MANUAL'): Order {
  s.seq.order += 1;
  return {
    id: `ORD${pad(s.seq.order, 5)}`, time: ctx.time, symbol: i.symbol, side: i.side, qty: i.qty, product: i.product, type: i.type,
    price: i.price ?? 0, trigger: i.trigger ?? 0, status: 'OPEN', avgPrice: 0, message: '', triggered: false,
    target: i.target, stopLoss: i.stopLoss, tag,
  };
}

/**
 * Applies an execution to the account. Mutates the (already cloned) draft state.
 * Returns false (and marks the order REJECTED) when funds are short and `force` is not set.
 */
function fillOrder(s: AppState, o: Order, rawPrice: number, ctx: Ctx, force = false): boolean {
  const price = round2(rawPrice);
  if (!force && fundsShort(s, o.side, o.product, o.symbol, o.qty, price)) {
    o.status = 'REJECTED'; o.message = 'Insufficient virtual funds.'; return false;
  }
  const sign = o.side === 'BUY' ? 1 : -1;
  const value = price * o.qty;
  const ch = calculateCharges({ side: o.side, product: o.product, price, qty: o.qty });
  const key = posKey(o.symbol, o.product);
  let pnl = 0; let closing = false;

  if (o.product === 'CNC') {
    let h = s.holdings.find((x) => x.symbol === o.symbol);
    if (o.side === 'BUY') {
      if (h) { h.avgPrice = calculateAveragePrice(h.qty, h.avgPrice, o.qty, price); h.qty += o.qty; }
      else { h = { symbol: o.symbol, qty: o.qty, avgPrice: price }; s.holdings.push(h); }
      s.account.cash -= value;
      if (o.target !== undefined || o.stopLoss !== undefined) s.exits[key] = { target: o.target, stopLoss: o.stopLoss };
    } else if (h) {
      pnl = calculatePnL(o.qty, h.avgPrice, price); closing = true;
      h.qty -= o.qty; s.account.cash += value;
      if (h.qty <= 0) { s.holdings = s.holdings.filter((x) => x !== h); delete s.exits[key]; }
    }
  } else {
    let p = s.positions.find((x) => x.symbol === o.symbol && x.product === 'MIS');
    if (!p) { p = { symbol: o.symbol, product: 'MIS', qty: 0, avgPrice: 0, realized: 0, maxInvested: 0 }; s.positions.push(p); }
    if (p.qty === 0 || Math.sign(p.qty) === sign) {
      p.avgPrice = calculateAveragePrice(Math.abs(p.qty), p.avgPrice, o.qty, price);
      p.qty += sign * o.qty;
      if (o.target !== undefined || o.stopLoss !== undefined) s.exits[key] = { target: o.target, stopLoss: o.stopLoss };
    } else {
      const closeQty = Math.min(o.qty, Math.abs(p.qty));
      pnl = calculatePnL(p.qty > 0 ? closeQty : -closeQty, p.avgPrice, price); closing = true;
      p.realized += pnl; s.account.cash += pnl;
      const remaining = o.qty - closeQty;
      p.qty += sign * closeQty;
      if (p.qty === 0) delete s.exits[key];
      if (remaining > 0) {
        p.qty = sign * remaining; p.avgPrice = price;
        s.exits[key] = { target: o.target, stopLoss: o.stopLoss };
        if (o.target === undefined && o.stopLoss === undefined) delete s.exits[key];
      }
    }
    p.maxInvested = Math.max(p.maxInvested, Math.abs(p.qty) * p.avgPrice);
  }

  s.account.cash -= ch.total; s.account.chargesTotal += ch.total; s.account.dayCharges += ch.total;
  s.account.realizedPnl += pnl; s.account.dayRealized += pnl;
  s.seq.trade += 1;
  const trade: Trade = {
    id: `TRD${pad(s.seq.trade, 5)}`, orderId: o.id, time: ctx.time, symbol: o.symbol, side: o.side, qty: o.qty, price,
    product: o.product, charges: ch.total, breakdown: ch, pnl, closing, tag: o.tag,
  };
  s.trades = [...s.trades, trade];
  o.status = 'EXECUTED'; o.avgPrice = price; o.execTime = ctx.time;
  return true;
}

const slipPrice = (ltp: number, side: Side) => roundTick(ltp * (side === 'BUY' ? 1 + SIM.slippagePct : 1 - SIM.slippagePct));
const sideWord = (o: Order) => `${o.side} ${o.qty} ${o.symbol}`;

/** Market order: executes near the current simulated price with small slippage. */
export function executeMarketOrder(s: AppState, o: Order, ctx: Ctx, events: AppEvent[], force = false): boolean {
  const px = slipPrice(ctx.price(o.symbol), o.side);
  const ok = fillOrder(s, o, px, ctx, force);
  if (ok) { o.message = `Executed at ${fmtINR(px)}`; events.push({ kind: 'success', title: 'Order executed', message: `${sideWord(o)} @ ${fmtINR(px)}` }); }
  else events.push({ kind: 'error', title: o.message, message: sideWord(o) });
  return ok;
}

/** Limit order that is already marketable fills at the (better) current price. */
export function executeLimitOrder(s: AppState, o: Order, price: number, ctx: Ctx, events: AppEvent[]): boolean {
  const ok = fillOrder(s, o, price, ctx);
  if (ok) { o.message = `Executed at ${fmtINR(price)}`; events.push({ kind: 'success', title: 'Limit order executed.', message: `${sideWord(o)} @ ${fmtINR(price)}` }); }
  else events.push({ kind: 'error', title: o.message, message: sideWord(o) });
  return ok;
}

/** Fires a stop-loss (or target) exit for an open position / holding. Never blocked by funds. */
export function executeStopLoss(s: AppState, key: string, level: number, ctx: Ctx, events: AppEvent[], kind: 'STOPLOSS' | 'TARGET' = 'STOPLOSS'): boolean {
  const [symbol, product] = key.split(':') as [string, Product];
  let qty = 0; let side: Side = 'SELL';
  if (product === 'CNC') qty = s.holdings.find((h) => h.symbol === symbol)?.qty ?? 0;
  else { const p = s.positions.find((x) => x.symbol === symbol && x.product === 'MIS'); qty = Math.abs(p?.qty ?? 0); side = (p?.qty ?? 0) > 0 ? 'SELL' : 'BUY'; }
  if (qty <= 0) { delete s.exits[key]; return false; }
  const o = newOrder(s, { symbol, side, qty, product, type: kind === 'STOPLOSS' ? 'SL-M' : 'LIMIT', price: kind === 'TARGET' ? level : undefined, trigger: kind === 'STOPLOSS' ? level : undefined }, ctx, kind);
  s.orders.push(o);
  const before = s.account.realizedPnl;
  fillOrder(s, o, level, ctx, true);
  const pnl = s.account.realizedPnl - before;
  o.message = kind === 'STOPLOSS' ? `STOP-LOSS HIT at ${fmtINR(level)}` : `TARGET HIT at ${fmtINR(level)}`;
  events.push(kind === 'STOPLOSS'
    ? { kind: 'warning', title: 'STOP-LOSS HIT', message: `Stop-loss triggered. ${sideWord(o)} @ ${fmtINR(level)} (${fmtSigned(pnl)})` }
    : { kind: 'success', title: 'TARGET HIT', message: `${sideWord(o)} @ ${fmtINR(level)} (${fmtSigned(pnl)})` });
  return true;
}

// ---------------------------------------------------------------- public actions
export function placeOrder(state: AppState, input: OrderInput, ctx: Ctx): Result {
  const issues = validateOrder(state, input, ctx);
  const hard = issues.filter((x) => !x.reject);
  if (hard.length) return { state, events: [{ kind: 'error', title: hard[0].message }], issues, ok: false };
  const s = cloneState(state); const events: AppEvent[] = [];
  const o = newOrder(s, input, ctx);
  s.orders.push(o);
  if (issues.length) { // business-rule rejection (funds / market closed / holdings): record it, never execute
    o.status = 'REJECTED'; o.message = issues[0].message;
    events.push({ kind: 'error', title: issues[0].message, message: `${sideWord(o)} was rejected` });
    return { state: s, events, issues, ok: false, orderId: o.id };
  }
  routeNew(s, o, ctx, events);
  return { state: s, events, ok: true, orderId: o.id };
}

/** Decide what happens to a freshly placed (or modified) order. */
function routeNew(s: AppState, o: Order, ctx: Ctx, events: AppEvent[]) {
  const ltp = ctx.price(o.symbol);
  if (o.type === 'MARKET') { executeMarketOrder(s, o, ctx, events); return; }
  if (o.type === 'LIMIT') {
    const marketable = o.side === 'BUY' ? o.price >= ltp : o.price <= ltp;
    if (marketable) { executeLimitOrder(s, o, o.side === 'BUY' ? Math.min(o.price, ltp) : Math.max(o.price, ltp), ctx, events); return; }
    events.push({ kind: 'info', title: `${o.side} order placed`, message: `Limit ${fmtINR(o.price)} is pending until the price reaches it.` }); return;
  }
  events.push({ kind: 'info', title: `${o.side} order placed`, message: `${o.type === 'SL' ? 'Stop-loss' : 'Stop-loss market'} order waits for trigger ${fmtINR(o.trigger)}.` });
}

export function cancelOrder(state: AppState, id: string): Result {
  const s = cloneState(state); const o = s.orders.find((x) => x.id === id);
  if (!o || o.status !== 'OPEN') return { state, events: [{ kind: 'error', title: 'Only open orders can be cancelled.' }], ok: false };
  o.status = 'CANCELLED'; o.message = 'Cancelled by you';
  return { state: s, events: [{ kind: 'info', title: 'Order cancelled', message: sideWord(o) }], ok: true };
}

export function modifyOrder(state: AppState, id: string, ch: { qty?: number; price?: number; trigger?: number }, ctx: Ctx): Result {
  const o0 = state.orders.find((x) => x.id === id);
  if (!o0 || o0.status !== 'OPEN') return { state, events: [{ kind: 'error', title: 'Only open orders can be modified.' }], ok: false };
  const input: OrderInput = {
    symbol: o0.symbol, side: o0.side, product: o0.product, type: o0.type, qty: ch.qty ?? o0.qty,
    price: o0.type === 'LIMIT' || o0.type === 'SL' ? ch.price ?? o0.price : undefined,
    trigger: o0.type === 'SL' || o0.type === 'SL-M' ? ch.trigger ?? o0.trigger : undefined,
    target: o0.target, stopLoss: o0.stopLoss,
  };
  const issues = validateOrder(state, input, ctx, { excludeOrderId: id });
  if (issues.length) return { state, events: [{ kind: 'error', title: issues[0].message }], issues, ok: false };
  const s = cloneState(state); const o = s.orders.find((x) => x.id === id)!; const events: AppEvent[] = [];
  o.qty = input.qty; o.price = input.price ?? 0; o.trigger = input.trigger ?? 0; o.triggered = false;
  events.push({ kind: 'info', title: 'Order modified', message: sideWord(o) });
  if (o.type === 'LIMIT') { const marketable = o.side === 'BUY' ? o.price >= ctx.price(o.symbol) : o.price <= ctx.price(o.symbol); if (marketable) routeNew(s, o, ctx, events); }
  return { state: s, events, ok: true };
}

/** Close a MIS position (or sell a whole CNC holding) at market. */
export function closePosition(state: AppState, symbol: string, product: Product, ctx: Ctx): Result {
  let qty = 0; let side: Side = 'SELL';
  if (product === 'CNC') qty = state.holdings.find((h) => h.symbol === symbol)?.qty ?? 0;
  else { const p = state.positions.find((x) => x.symbol === symbol && x.product === 'MIS'); qty = Math.abs(p?.qty ?? 0); side = (p?.qty ?? 0) > 0 ? 'SELL' : 'BUY'; }
  if (qty <= 0) return { state, events: [{ kind: 'error', title: 'Nothing to close.' }], ok: false };
  if (!ctx.isOpen) return { state, events: [{ kind: 'error', title: 'Market is closed. Positions can only be closed between 9:15 AM and 3:30 PM.' }], ok: false };
  const s = cloneState(state); const events: AppEvent[] = [];
  // Cancel pending orders on this instrument so a stray order cannot re-open the position.
  for (const x of s.orders) if (x.status === 'OPEN' && x.symbol === symbol && x.product === product) { x.status = 'CANCELLED'; x.message = 'Cancelled because the position was closed'; }
  const o = newOrder(s, { symbol, side, qty, product, type: 'MARKET' }, ctx, 'CLOSE'); s.orders.push(o);
  const before = s.account.realizedPnl;
  const ok = executeMarketOrder(s, o, ctx, [], true);
  const pnl = s.account.realizedPnl - before;
  if (ok) events.push({ kind: 'success', title: 'Position closed', message: `${symbol}: ${fmtSigned(pnl)} realized` });
  return { state: s, events, ok };
}

export function setExit(state: AppState, key: string, rule: ExitRule, ctx: Ctx): Result {
  const [symbol, product] = key.split(':') as [string, Product];
  const p = product === 'CNC' ? state.holdings.find((h) => h.symbol === symbol) : state.positions.find((x) => x.symbol === symbol && x.product === 'MIS');
  const qty = p?.qty ?? 0;
  if (!p || qty === 0) return { state, events: [{ kind: 'error', title: 'No open position to protect.' }], ok: false };
  const ltp = ctx.price(symbol); const long = qty > 0;
  const { stopLoss: sl, target: tg } = rule;
  if (sl !== undefined && (!(sl > 0) || (long ? sl >= ltp : sl <= ltp))) return { state, events: [{ kind: 'error', title: long ? `Stop-loss must be below the current price (${fmtINR(ltp)}).` : `Stop-loss must be above the current price (${fmtINR(ltp)}).` }], ok: false };
  if (tg !== undefined && (!(tg > 0) || (long ? tg <= ltp : tg >= ltp))) return { state, events: [{ kind: 'error', title: long ? `Target must be above the current price (${fmtINR(ltp)}).` : `Target must be below the current price (${fmtINR(ltp)}).` }], ok: false };
  const s = cloneState(state);
  if (sl === undefined && tg === undefined) delete s.exits[key]; else s.exits[key] = { stopLoss: sl, target: tg };
  return { state: s, events: [{ kind: 'info', title: 'Exit rules saved', message: `${symbol}: stop-loss ${sl ? fmtINR(sl) : '-'}, target ${tg ? fmtINR(tg) : '-'}` }], ok: true };
}

// ---------------------------------------------------------------- tick processing
function processPending(s: AppState, o: Order, bar: TickBar, ctx: Ctx, events: AppEvent[]): boolean {
  const buy = o.side === 'BUY'; let fillAt: number | null = null; let label = 'Order executed'; let changed = false;
  if (o.type === 'LIMIT') {
    if (buy && bar.low <= o.price) fillAt = Math.min(o.price, bar.open);
    if (!buy && bar.high >= o.price) fillAt = Math.max(o.price, bar.open);
    label = 'Limit order executed.';
  } else if (o.type === 'SL-M') {
    if (buy && bar.high >= o.trigger) fillAt = roundTick(Math.max(o.trigger, bar.open) * (1 + SIM.slippagePct));
    if (!buy && bar.low <= o.trigger) fillAt = roundTick(Math.min(o.trigger, bar.open) * (1 - SIM.slippagePct));
    label = 'Stop-loss triggered.';
  } else if (o.type === 'SL') {
    label = 'Stop-loss triggered.';
    if (!o.triggered) {
      if (buy ? bar.high >= o.trigger : bar.low <= o.trigger) {
        o.triggered = true; changed = true;
        const cand = buy ? Math.max(o.trigger, bar.open) : Math.min(o.trigger, bar.open);
        if (buy ? cand <= o.price : cand >= o.price) fillAt = cand;
        else events.push({ kind: 'warning', title: 'Stop-loss triggered.', message: `${o.symbol}: trigger hit, now waiting for limit ${fmtINR(o.price)}.` });
      }
    } else if (buy ? bar.low <= o.price : bar.high >= o.price) fillAt = buy ? Math.min(o.price, bar.open) : Math.max(o.price, bar.open);
  }
  if (fillAt === null) return changed;
  const ok = fillOrder(s, o, fillAt, ctx);
  if (ok) {
    o.message = `Executed at ${fmtINR(fillAt)}`;
    events.push({ kind: o.type === 'LIMIT' ? 'success' : 'warning', title: label, message: `${sideWord(o)} @ ${fmtINR(fillAt)}` });
  } else events.push({ kind: 'error', title: o.message, message: `${sideWord(o)} could not be executed` });
  return true;
}

/** Called for every simulated tick: fills pending orders, fires target / stop-loss, records equity. */
export function processTick(state: AppState, ticks: Record<string, TickBar>, ctx: Ctx): Result {
  const s = cloneState(state); const events: AppEvent[] = []; let changed = false;
  for (const o of s.orders) {
    if (o.status !== 'OPEN') continue;
    const bar = ticks[o.symbol]; if (!bar) continue;
    if (processPending(s, o, bar, ctx, events)) changed = true;
  }
  for (const key of Object.keys(s.exits)) {
    const [symbol, product] = key.split(':') as [string, Product];
    const bar = ticks[symbol]; if (!bar) continue;
    const rule = s.exits[key];
    const qty = product === 'CNC' ? s.holdings.find((h) => h.symbol === symbol)?.qty ?? 0 : s.positions.find((p) => p.symbol === symbol && p.product === 'MIS')?.qty ?? 0;
    if (qty === 0) { delete s.exits[key]; changed = true; continue; }
    const long = qty > 0;
    const slHit = rule.stopLoss !== undefined && (long ? bar.low <= rule.stopLoss : bar.high >= rule.stopLoss);
    const tgHit = rule.target !== undefined && (long ? bar.high >= rule.target : bar.low <= rule.target);
    if (slHit) { executeStopLoss(s, key, rule.stopLoss!, ctx, events, 'STOPLOSS'); changed = true; }
    else if (tgHit) { executeStopLoss(s, key, rule.target!, ctx, events, 'TARGET'); changed = true; }
  }
  const last = s.equity[s.equity.length - 1];
  if (changed || !last || ctx.time - last.t >= 5 * 60_000) { s.equity = pushEquity(s.equity, ctx.time, accountValue(s, ctx)); changed = true; }
  return changed ? { state: s, events } : { state, events };
}

export function pushEquity(eq: { t: number; v: number }[], t: number, v: number) {
  let out = eq.length && eq[eq.length - 1].t === t ? [...eq.slice(0, -1), { t, v: round2(v) }] : [...eq, { t, v: round2(v) }];
  if (out.length > 700) out = out.filter((_, i) => i % 2 === 0 || i === out.length - 1);
  return out;
}

// ---------------------------------------------------------------- end of day
/** 3:30 PM: auto square-off every MIS position, expire open orders, build the summary. */
export function endOfDay(state: AppState, ctx: Ctx): Result {
  const s = cloneState(state); const events: AppEvent[] = []; const squared: EodLine[] = [];
  let cancelled = 0;
  for (const o of s.orders) if (o.status === 'OPEN') { o.status = 'CANCELLED'; o.message = 'Day order expired at market close'; cancelled++; }
  for (const p of [...s.positions]) {
    if (p.qty === 0) continue;
    const ltp = roundTick(ctx.price(p.symbol)); const side: Side = p.qty > 0 ? 'SELL' : 'BUY'; const qty = Math.abs(p.qty);
    const o = newOrder(s, { symbol: p.symbol, side, qty, product: 'MIS', type: 'MARKET' }, ctx, 'SQUAREOFF'); s.orders.push(o);
    const before = s.account.realizedPnl;
    fillOrder(s, o, ltp, ctx, true); o.message = `Auto square-off at ${fmtINR(ltp)}`;
    squared.push({ symbol: p.symbol, qty: p.qty, price: ltp, pnl: s.account.realizedPnl - before });
    delete s.exits[posKey(p.symbol, 'MIS')];
  }
  const value = accountValue(s, ctx);
  const dayStart = startOfDayMs(ctx.time);
  s.lastEod = {
    date: ctx.time, squaredOff: squared, realizedToday: s.account.dayRealized, chargesToday: s.account.dayCharges,
    accountValue: value, dayPnl: value - s.account.dayStartValue, tradesToday: s.trades.filter((t) => t.time >= dayStart).length, cancelledOrders: cancelled,
  };
  s.equity = pushEquity(s.equity, ctx.time, value);
  events.push({ kind: 'info', title: 'Market Closed', message: squared.length ? `${squared.length} intraday position(s) auto squared-off.` : 'End-of-day summary is ready.' });
  return { state: s, events, ok: true };
}
const startOfDayMs = (ms: number) => Math.floor(ms / 86_400_000) * 86_400_000;

export function startNewDay(state: AppState, ctx: Ctx): Result {
  const s = cloneState(state);
  s.positions = s.positions.filter((p) => p.qty !== 0);
  s.account.dayStartValue = accountValue(s, ctx); s.account.dayRealized = 0; s.account.dayCharges = 0; s.lastEod = null;
  s.equity = pushEquity(s.equity, ctx.time, s.account.dayStartValue);
  return { state: s, events: [{ kind: 'info', title: 'New trading day', message: 'Intraday positions were cleared. Delivery holdings carry over.' }], ok: true };
}

// ---------------------------------------------------------------- stats
export function computeStats(trades: Trade[]) {
  const closed = trades.filter((t) => t.closing).map((t) => t.pnl - t.charges);
  const wins = closed.filter((x) => x > 0); const losses = closed.filter((x) => x < 0);
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  return {
    trades: trades.length, closedTrades: closed.length, winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    avgWin, avgLoss, largestWin: wins.length ? Math.max(...wins) : 0, largestLoss: losses.length ? Math.min(...losses) : 0,
    riskReward: avgLoss < 0 ? avgWin / Math.abs(avgLoss) : 0,
  };
}

export type { Position };
