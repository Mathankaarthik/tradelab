import { useRef } from 'react';
import { useApp } from '../store/AppContext';
import { fmtINR, fmtPct, fmtSigned, pnlClass } from '../utils/format';

export default function Watchlist() {
  const { state, engine, select, openTicket, toggleWatch, setMobileTab } = useApp();
  const prev = useRef<Record<string, { p: number; dir: number }>>({});
  return (
    <section className="flex h-full min-h-0 flex-col bg-panel" aria-label="Watchlist">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-[13px] font-semibold">Watchlist <span className="font-normal text-mute">({state.watchlist.length})</span></h2>
        <span className="chip border-warn/40 text-[10px] text-warn">SIMULATED MARKET DATA</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto">
        {state.watchlist.length === 0 && <li className="px-4 py-6 text-center text-[12.5px] text-mute">Your watchlist is empty. Use the search box to find a stock and add it.</li>}
        {state.watchlist.map((sym) => {
          const q = engine.quote(sym);
          const pr = prev.current[sym];
          let dir = pr?.dir ?? 0;
          if (pr && pr.p !== q.ltp) dir = q.ltp > pr.p ? 1 : -1;
          prev.current[sym] = { p: q.ltp, dir };
          const active = state.selected === sym;
          return (
            <li key={sym} className={`group relative border-b border-line/60 ${active ? 'bg-panel2' : 'hover:bg-panel2/60'}`}>
              <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => { select(sym); setMobileTab('chart'); }} aria-label={`${sym} ${fmtINR(q.ltp)} ${fmtPct(q.changePct)}. Select`} aria-current={active}>
                <span className="min-w-0">
                  <span className={`block truncate text-[13px] font-semibold ${q.change > 0 ? 'text-gain' : q.change < 0 ? 'text-loss' : ''}`}>{sym}</span>
                  <span className="block truncate text-[11px] text-mute">{engine.info(sym)?.name}</span>
                </span>
                <span className="text-right leading-tight">
                  <span key={q.ltp} className={`block rounded px-1 text-[13px] font-medium ${dir > 0 ? 'flash-up' : dir < 0 ? 'flash-down' : ''}`}>{fmtINR(q.ltp)}</span>
                  <span className={`block text-[11px] ${pnlClass(q.change)}`}>{fmtSigned(q.change)} {fmtPct(q.changePct)}</span>
                </span>
              </button>
              <div className="absolute right-[92px] top-1/2 hidden -translate-y-1/2 gap-1 group-hover:flex group-focus-within:flex">
                <button className="btn btn-buy btn-sm px-2" aria-label={`Buy ${sym}`} onClick={() => openTicket('BUY', { symbol: sym })}>B</button>
                <button className="btn btn-sell btn-sm px-2" aria-label={`Sell ${sym}`} onClick={() => openTicket('SELL', { symbol: sym })}>S</button>
                <button className="btn btn-sm px-2" aria-label={`Remove ${sym} from watchlist`} onClick={() => toggleWatch(sym)}>✕</button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-3 py-1.5 text-[10.5px] leading-snug text-mute">Prices come from a toy simulation, not real markets. Hover a row for quick Buy / Sell.</p>
    </section>
  );
}
