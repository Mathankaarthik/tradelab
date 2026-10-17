import { CHARGE_CONFIG, ChargeConfig } from '../config/charges';
import type { ChargeBreakdown, Product, Side } from '../types';
import { round2 } from './price';

export const emptyCharges = (): ChargeBreakdown =>
  ({ turnover: 0, brokerage: 0, stt: 0, exchange: 0, gst: 0, sebi: 0, stamp: 0, total: 0 });

/** Estimated charges for ONE executed order. All rates come from config/charges.ts. */
export function calculateCharges(
  o: { side: Side; product: Product; price: number; qty: number },
  cfg: ChargeConfig = CHARGE_CONFIG,
): ChargeBreakdown {
  const turnover = o.price * o.qty;
  const intraday = o.product === 'MIS';
  const b = intraday ? cfg.brokerage.intraday : cfg.brokerage.delivery;
  const brokerage = Math.min(b.max, turnover * b.pct);
  const sttRate = intraday ? (o.side === 'SELL' ? cfg.stt.intradaySell : 0) : o.side === 'BUY' ? cfg.stt.deliveryBuy : cfg.stt.deliverySell;
  const stt = turnover * sttRate;
  const exchange = turnover * cfg.exchange;
  const sebi = turnover * cfg.sebi;
  const gst = (brokerage + exchange + sebi) * cfg.gst;
  const stamp = o.side === 'BUY' ? turnover * (intraday ? cfg.stamp.intradayBuy : cfg.stamp.deliveryBuy) : 0;
  const r = { brokerage: round2(brokerage), stt: round2(stt), exchange: round2(exchange), gst: round2(gst), sebi: round2(sebi), stamp: round2(stamp) };
  return { turnover: round2(turnover), ...r, total: round2(r.brokerage + r.stt + r.exchange + r.gst + r.sebi + r.stamp) };
}

export function sumCharges(list: ChargeBreakdown[]): ChargeBreakdown {
  const t = emptyCharges();
  for (const c of list) {
    t.turnover += c.turnover; t.brokerage += c.brokerage; t.stt += c.stt; t.exchange += c.exchange;
    t.gst += c.gst; t.sebi += c.sebi; t.stamp += c.stamp; t.total += c.total;
  }
  return t;
}
