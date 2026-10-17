import { useApp } from '../store/AppContext';
import { unrealizedPnl } from '../engine/trading';
import { fmtSigned } from '../utils/format';
import { Hint } from './ui';

export default function PnlSummary({ compact = false }: { compact?: boolean }) {
  const { state, ctx } = useApp();
  const unreal = unrealizedPnl(state, ctx).mis;
  const real = state.positions.reduce((a, p) => a + p.realized, 0);
  const total = real + unreal;
  const items: [string, number, string][] = [
    ['Total P&L', total, 'Realized + unrealized profit/loss on today\'s intraday positions (before charges).'],
    ['Realized P&L', real, 'Profit or loss you have locked in by closing positions.'],
    ['Unrealized P&L', unreal, 'Profit or loss on positions that are still open. It changes with the price.'],
  ];
  return (
    <div data-tour="pnl">
      <div className={`grid grid-cols-3 divide-x divide-line ${compact ? '' : 'rounded border border-line bg-panel'}`}>
        {items.map(([k, v, t]) => (
          <div key={k} className="px-3 py-1.5" title={t}>
            <div className="text-[11px] text-mute">{k}</div>
            <div className={`text-[15px] font-semibold ${v > 0.004 ? 'text-gain' : v < -0.004 ? 'text-loss' : ''}`}>{fmtSigned(v)}</div>
          </div>
        ))}
      </div>
      {!compact && <div className="mt-2"><Hint>P&L means profit and loss. <b className="text-gain">Green = profit</b>. <b className="text-loss">Red = loss</b>. Unrealized P&L only becomes real when you close the position.</Hint></div>}
    </div>
  );
}
