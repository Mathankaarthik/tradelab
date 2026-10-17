import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { calculatePnL, calculatePnLPct } from '../utils/pnl';
import { fmtINR, fmtNum, fmtPct, fmtSigned, pnlClass } from '../utils/format';
import ExitModal from './ExitModal';
import { Empty, Hint, Stat } from './ui';

export default function Holdings({ compact = false }: { compact?: boolean }) {
  const { state, engine, select, openTicket, setMobileTab } = useApp();
  const [exitFor, setExitFor] = useState<string | null>(null);
  const inv = state.holdings.reduce((a, h) => a + h.qty * h.avgPrice, 0);
  const cur = state.holdings.reduce((a, h) => a + h.qty * engine.price(h.symbol), 0);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {state.holdings.length > 0 && (
        <div className={`grid grid-cols-3 divide-x divide-line ${compact ? 'border-b border-line' : 'mb-3 rounded border border-line bg-panel'}`}>
          <Stat label="Investment" value={fmtINR(inv)} /><Stat label="Current value" value={fmtINR(cur)} />
          <Stat label="Total P&L" value={`${fmtSigned(cur - inv)} (${fmtPct(calculatePnLPct(cur - inv, inv))})`} tone={cur - inv} />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {state.holdings.length === 0 ? <Empty>No holdings. Shares bought with the Delivery (CNC) product are kept here until you sell them.</Empty> : (
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead><tr>{['Symbol', 'Qty', 'Avg. price', 'Current price', 'Investment', 'Current value', 'P&L', 'P&L %', 'Actions'].map((h, i) => <th key={h} className={`th ${i >= 1 && i <= 7 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>
              {state.holdings.map((h) => {
                const ltp = engine.price(h.symbol); const pnl = calculatePnL(h.qty, h.avgPrice, ltp);
                return (
                  <tr key={h.symbol} className="hover:bg-panel2/50">
                    <td className="td"><button className="font-semibold hover:underline" onClick={() => { select(h.symbol); setMobileTab('chart'); }}>{h.symbol}</button></td>
                    <td className="td text-right">{h.qty}</td><td className="td text-right">{fmtNum(h.avgPrice)}</td><td className="td text-right">{fmtNum(ltp)}</td>
                    <td className="td text-right">{fmtINR(h.qty * h.avgPrice)}</td><td className="td text-right">{fmtINR(h.qty * ltp)}</td>
                    <td className={`td text-right font-medium ${pnlClass(pnl)}`}>{fmtSigned(pnl)}</td>
                    <td className={`td text-right ${pnlClass(pnl)}`}>{fmtPct(calculatePnLPct(pnl, h.qty * h.avgPrice))}</td>
                    <td className="td"><div className="flex gap-1">
                      <button className="btn btn-sm" onClick={() => setExitFor(h.symbol)}>Target/SL</button>
                      <button className="btn btn-sm" onClick={() => openTicket('BUY', { symbol: h.symbol, product: 'CNC' })}>Buy more</button>
                      <button className="btn btn-danger btn-sm" onClick={() => openTicket('SELL', { symbol: h.symbol, product: 'CNC', qty: h.qty })}>Sell</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!compact && <div className="mt-3"><Hint>Holdings only show Delivery (CNC) shares. You paid the full price, so there is no leverage and they are not auto-sold at the end of the day.</Hint></div>}
      {exitFor && <ExitModal symbol={exitFor} product="CNC" onClose={() => setExitFor(null)} />}
    </div>
  );
}
