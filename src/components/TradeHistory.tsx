import { Fragment, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { CHARGES_DISCLAIMER } from '../config/charges';
import { fmtINR, fmtNum, fmtSigned, pnlClass } from '../utils/format';
import { DAY_MS, fmtClock, fmtDate, startOfDay } from '../utils/marketTime';
import { Empty, SideBadge } from './ui';

const FILTERS = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All']] as const;

export default function TradeHistory({ compact = false }: { compact?: boolean }) {
  const { state, engine } = useApp();
  const [f, setF] = useState<'today' | 'week' | 'month' | 'all'>('all'); const [open, setOpen] = useState<string | null>(null);
  const today = startOfDay(engine.time);
  const rows = useMemo(() => {
    const from = f === 'today' ? today : f === 'week' ? today - 6 * DAY_MS : f === 'month' ? today - 29 * DAY_MS : 0;
    return state.trades.filter((t) => t.time >= from).slice().reverse();
  }, [state.trades, f, today]);
  const totalCh = rows.reduce((a, t) => a + t.charges, 0); const totalPnl = rows.reduce((a, t) => a + t.pnl, 0);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {FILTERS.map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)} className={`rounded-full border px-2.5 py-0.5 text-[11.5px] ${f === k ? 'border-buy bg-buy/15 text-buy' : 'border-line text-mute hover:text-ink'}`}>{l}</button>)}
        <span className="ml-auto text-[11.5px] text-mute">{rows.length} trades · Realized <b className={pnlClass(totalPnl)}>{fmtSigned(totalPnl)}</b> · Charges <b className="text-ink">{fmtINR(totalCh)}</b></span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? <Empty>No trades in this period. Executed orders appear here with their charges and realized P&L.</Empty> : (
          <table className="w-full min-w-[820px] text-[12.5px]">
            <thead><tr>{['Date', 'Time', 'Symbol', 'Side', 'Qty', 'Exec. price', ...(state.settings.showCharges ? ['Charges'] : []), 'Realized P&L', 'Product', ''].map((h, i) => <th key={h + i} className={`th ${i >= 4 && i <= 7 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((t) => (
                <Fragment key={t.id}>
                  <tr className="hover:bg-panel2/50">
                    <td className="td text-mute">{fmtDate(t.time)}</td><td className="td text-mute">{fmtClock(t.time)}</td>
                    <td className="td font-semibold">{t.symbol}</td><td className="td"><SideBadge side={t.side} /></td>
                    <td className="td text-right">{t.qty}</td><td className="td text-right">{fmtNum(t.price)}</td>
                    {state.settings.showCharges && <td className="td text-right">{fmtINR(t.charges)}</td>}
                    <td className={`td text-right font-medium ${t.closing ? pnlClass(t.pnl) : 'text-mute'}`}>{t.closing ? fmtSigned(t.pnl) : '-'}</td>
                    <td className="td">{t.product}</td>
                    <td className="td"><button className="btn btn-ghost btn-sm" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? 'Hide' : 'Charges'}</button></td>
                  </tr>
                  {open === t.id && (
                    <tr><td colSpan={10} className="border-b border-line/60 bg-app px-4 py-2">
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
                        <span className="text-mute">Trade value <b className="text-ink">{fmtINR(t.breakdown.turnover)}</b></span>
                        {(['brokerage', 'stt', 'exchange', 'gst', 'sebi', 'stamp'] as const).map((k) => <span key={k} className="text-mute">{{ brokerage: 'Brokerage', stt: 'STT', exchange: 'Exchange', gst: 'GST', sebi: 'SEBI', stamp: 'Stamp duty' }[k]} <b className="text-ink">{fmtINR(t.breakdown[k])}</b></span>)}
                        <span className="text-mute">Total <b className="text-ink">{fmtINR(t.charges)}</b></span>
                      </div>
                      <p className="mt-1 text-[10.5px] text-mute">{CHARGES_DISCLAIMER}</p>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
