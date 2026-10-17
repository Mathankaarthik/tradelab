const f2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const fmtNum = (n: number, dp = 2) => (dp === 0 ? f0 : f2).format(n);
export const fmtINR = (n: number, dp = 2) => {
  const v = Math.abs(n) < 0.005 && dp === 2 ? 0 : n;
  return `${v < 0 ? '-' : ''}₹${fmtNum(Math.abs(v), dp)}`;
};
/** Signed money: +₹750.00 / -₹750.00 / ₹0.00 */
export const fmtSigned = (n: number) => (Math.abs(n) < 0.005 ? fmtINR(0) : `${n > 0 ? '+' : '-'}₹${fmtNum(Math.abs(n))}`);
export const fmtPct = (n: number) => (Math.abs(n) < 0.005 ? '0.00%' : `${n > 0 ? '+' : '-'}${Math.abs(n).toFixed(2)}%`);
export const pnlClass = (n: number) => (n > 0.004 ? 'text-gain' : n < -0.004 ? 'text-loss' : 'text-mute');
export const fmtVol = (n: number) =>
  n >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(2)} L` : f0.format(n);
