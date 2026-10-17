import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { calculatePnL, calculatePnLPct } from '../utils/pnl';
import { fmtINR, fmtNum, fmtPct, fmtSigned, pnlClass } from '../utils/format';
import ConfirmationModal from './ConfirmationModal';
import ExitModal from './ExitModal';
import PnlSummary from './PnlSummary';
import { Empty, Hint } from './ui';

export default function Positions({ compact = false }: { compact?: boolean }) {
  const { state, engine, select, close, openTicket, setMobileTab } = useApp();
  const [exitFor, setExitFor] = useState<string | null>(null); const [closing, setClosing] = useState<string | null>(null);
  const rows = state.positions.slice().sort((a, b) => Number(b.qty !== 0) - Number(a.qty !== 0));
  const closingPos = closing ? state.positions.find((p) => p.symbol === closing) : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={compact ? 'border-b border-line' : 'mb-3'}><PnlSummary compact={compact} /></div>
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <Empty>No positions yet. Pick a stock, press BUY or SELL, and your position will appear here.</Empty>
        ) : (
          <table className="w-full min-w-[860px] text-[12.5px]">
            <thead><tr>
              {['Symbol', 'Product', 'Qty', 'Avg. price', 'LTP', 'Invested', 'Current value', 'P&L', 'P&L %', 'Target / SL', 'Actions'].map((h, i) => <th key={h} className={`th ${i >= 2 && i <= 8 ? 'text-right' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((p) => {
                const ltp = engine.price(p.symbol); const open = p.qty !== 0;
                const unreal = open ? calculatePnL(p.qty, p.avgPrice, ltp) : 0; const pnl = p.realized + unreal;
                const invested = Math.abs(p.qty) * p.avgPrice; const base = open ? invested : p.maxInvested;
                const ex = state.exits[`${p.symbol}:MIS`];
                return (
                  <tr key={p.symbol} className={`hover:bg-panel2/50 ${open ? '' : 'opacity-70'}`}>
                    <td className="td"><button className="font-semibold hover:underline" onClick={() => { select(p.symbol); setMobileTab('chart'); }}>{p.symbol}</button>{p.qty < 0 && <span className="ml-1.5 rounded bg-sell/15 px-1 text-[10px] text-sell">SHORT</span>}</td>
                    <td className="td">{p.product}</td>
                    <td className={`td text-right ${p.qty < 0 ? 'text-sell' : ''}`}>{p.qty}</td>
                    <td className="td text-right">{open ? fmtNum(p.avgPrice) : '-'}</td>
                    <td className="td text-right">{fmtNum(ltp)}</td>
                    <td className="td text-right">{open ? fmtINR(invested) : '-'}</td>
                    <td className="td text-right">{open ? fmtINR(Math.abs(p.qty) * ltp) : '-'}</td>
                    <td className={`td text-right font-medium ${pnlClass(pnl)}`}>{fmtSigned(pnl)}</td>
                    <td className={`td text-right ${pnlClass(pnl)}`}>{fmtPct(calculatePnLPct(pnl, base))}</td>
                    <td className="td text-[11.5px] text-mute">{open ? (ex ? `${ex.target ? fmtNum(ex.target) : '-'} / ${ex.stopLoss ? fmtNum(ex.stopLoss) : '-'}` : 'Not set') : '-'}</td>
                    <td className="td">
                      {open ? (
                        <div className="flex gap-1" data-tour="close">
                          <button className="btn btn-sm" onClick={() => setExitFor(p.symbol)}>Target/SL</button>
                          <button className="btn btn-sm" onClick={() => openTicket(p.qty > 0 ? 'BUY' : 'SELL', { symbol: p.symbol, product: 'MIS' })}>Add</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setClosing(p.symbol)}>Close position</button>
                        </div>
                      ) : <span className="text-[11.5px] text-mute">Closed</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!compact && <div className="mt-3"><Hint>Quantity in <b>red SHORT</b> means you sold first and must buy back later. A <b>Close position</b> button places the opposite market order for you. Intraday (MIS) positions close automatically at 3:30 PM.</Hint></div>}
      {exitFor && <ExitModal symbol={exitFor} product="MIS" onClose={() => setExitFor(null)} />}
      {closingPos && (
        <ConfirmationModal title={`Close ${closingPos.symbol}`} confirmLabel="Close position" tone="sell" onCancel={() => setClosing(null)} onConfirm={() => { close(closingPos.symbol, 'MIS'); setClosing(null); }}>
          <p className="text-[13px]">{closingPos.qty > 0 ? `Sell ${closingPos.qty}` : `Buy back ${Math.abs(closingPos.qty)}`} {closingPos.symbol} at the market price to close this position.</p>
          <p className="mt-2 text-[13px]">Estimated P&L: <b className={pnlClass(calculatePnL(closingPos.qty, closingPos.avgPrice, engine.price(closingPos.symbol)))}>{fmtSigned(calculatePnL(closingPos.qty, closingPos.avgPrice, engine.price(closingPos.symbol)))}</b> (before charges)</p>
        </ConfirmationModal>
      )}
    </div>
  );
}
