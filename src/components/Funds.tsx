import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { CHARGES_DISCLAIMER } from '../config/charges';
import { accountValue, availableMargin, unrealizedPnl, usedMargin } from '../engine/trading';
import { sumCharges } from '../utils/charges';
import { fmtINR, fmtSigned, pnlClass } from '../utils/format';
import { startOfDay } from '../utils/marketTime';
import ConfirmationModal from './ConfirmationModal';
import { Hint } from './ui';

export default function Funds({ compact = false }: { compact?: boolean }) {
  const { state, ctx, engine, resetAccount } = useApp();
  const [confirm, setConfirm] = useState(false);
  const a = state.account; const un = unrealizedPnl(state, ctx);
  const used = usedMargin(state); const avail = availableMargin(state); const value = accountValue(state, ctx);
  const today = sumCharges(state.trades.filter((t) => t.time >= startOfDay(engine.time)).map((t) => t.breakdown));
  const rows: [string, string, string?, string?][] = [
    ['Opening balance', fmtINR(a.startingCapital), undefined, 'Your virtual starting capital.'],
    ['Available cash', fmtINR(a.cash), undefined, 'Cash balance after realized P&L, charges and delivery purchases.'],
    ['Used margin', fmtINR(used), undefined, 'Money blocked to hold your open intraday positions.'],
    ['Available margin', fmtINR(avail), undefined, 'Cash minus used margin: what you can use for new orders.'],
    ['Realized P&L (all time)', fmtSigned(a.realizedPnl), pnlClass(a.realizedPnl), 'Gross profit/loss from closed trades, before charges.'],
    ['Unrealized P&L', fmtSigned(un.total), pnlClass(un.total), 'Profit/loss on open positions and holdings.'],
    ["Today's charges", fmtINR(a.dayCharges), undefined, CHARGES_DISCLAIMER],
    ['Total charges paid', fmtINR(a.chargesTotal)],
    ['Total account value', fmtINR(value), pnlClass(value - a.startingCapital), 'Cash + holdings value + unrealized intraday P&L.'],
  ];
  return (
    <div className={compact ? 'h-full overflow-auto' : ''}>
      <div className={`grid gap-4 ${compact ? 'p-3 md:grid-cols-2' : 'lg:grid-cols-2'}`}>
        <div className="panel">
          <dl className="divide-y divide-line">
            {rows.map(([k, v, c, t]) => (
              <div key={k} className="flex items-center justify-between px-3 py-2" title={t}>
                <dt className="text-mute">{k}</dt><dd className={`text-[13.5px] ${k === 'Total account value' ? 'font-semibold' : 'font-medium'} ${c ?? ''}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-3">
          <div className="panel p-3">
            <h3 className="mb-2 text-[13px] font-semibold">Today's charges breakdown</h3>
            <dl className="space-y-1 text-[12.5px]">
              {([['Trade value', today.turnover], ['Brokerage', today.brokerage], ['STT', today.stt], ['Exchange transaction charges', today.exchange], ['GST', today.gst], ['SEBI charges', today.sebi], ['Stamp duty', today.stamp]] as [string, number][]).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-mute">{k}</dt><dd>{fmtINR(v)}</dd></div>)}
              <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Total charges</dt><dd>{fmtINR(today.total)}</dd></div>
            </dl>
            <p className="mt-2 text-[10.5px] text-mute">{CHARGES_DISCLAIMER}</p>
          </div>
          <div className="panel p-3">
            <h3 className="text-[13px] font-semibold">Reset account</h3>
            <p className="mb-2 mt-1 text-[12px] text-mute">Start again with {fmtINR(state.settings.startingCapital, 0)} of virtual capital. Positions, orders, holdings and history are deleted.</p>
            <button className="btn btn-danger" onClick={() => setConfirm(true)}>Reset Account</button>
          </div>
        </div>
      </div>
      {!compact && <div className="mt-3"><Hint>Margin is a deposit, not a cost. With Intraday (MIS) you get 5x leverage, so you can hold more shares than your cash alone could buy. That also means losses can be large compared with your balance.</Hint></div>}
      {confirm && (
        <ConfirmationModal title="Reset account" confirmLabel="Reset Account" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); resetAccount(); }}>
          <p className="text-[13.5px] font-medium">Are you sure? This will delete your paper-trading history.</p>
          <p className="mt-2 text-[12.5px] text-mute">Your account returns to {fmtINR(state.settings.startingCapital, 0)} of virtual money and the simulated market restarts.</p>
        </ConfirmationModal>
      )}
    </div>
  );
}
