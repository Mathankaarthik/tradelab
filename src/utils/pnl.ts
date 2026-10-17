/**
 * P&L helpers. Quantity is SIGNED: positive = long (bought first), negative = short (sold first).
 *   long : (price - avg) x qty
 *   short: (avg - price) x qty  ==  (price - avg) x (-qty)
 */
export const calculatePnL = (signedQty: number, avgPrice: number, price: number) => (price - avgPrice) * signedQty;
export const calculatePnLPct = (pnl: number, invested: number) => (invested > 0 ? (pnl / invested) * 100 : 0);

/** Weighted average price when adding to a position (both quantities positive). */
export function calculateAveragePrice(oldQty: number, oldAvg: number, addQty: number, addPrice: number) {
  const total = oldQty + addQty;
  return total === 0 ? 0 : (oldQty * oldAvg + addQty * addPrice) / total;
}

/** Position sizing from a fixed risk budget. */
export function calculatePositionSize(capital: number, riskPct: number, entry: number, stop: number) {
  const maxRisk = (capital * riskPct) / 100;
  const riskPerShare = Math.abs(entry - stop);
  const qty = riskPerShare > 0 ? Math.floor(maxRisk / riskPerShare) : 0;
  return { maxRisk, riskPerShare, qty, positionValue: qty * entry };
}
