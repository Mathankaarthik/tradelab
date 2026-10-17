import { useApp } from '../store/AppContext';
import { fmtINR, fmtPct, fmtSigned, fmtVol, pnlClass } from '../utils/format';
import OrderTicket from './OrderTicket';
import { Hint } from './ui';

/** Right-hand panel: quote + order ticket. On mobile it becomes a bottom sheet while the ticket is open. */
export default function OrderPanel() {
  const { state, engine, ticketOpen, openTicket, closeTicket } = useApp();
  const sym = state.selected; const q = engine.quote(sym);
  const range = q.high - q.low; const pos = range > 0 ? ((q.ltp - q.low) / range) * 100 : 50;
  const mobileHidden = ticketOpen ? '' : 'hidden';
  return (
    <>
      {ticketOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={closeTicket} aria-hidden="true" />}
      <aside aria-label="Order panel"
        className={`${mobileHidden} fixed inset-x-0 bottom-0 z-40 max-h-[92vh] flex-col overflow-auto rounded-t-xl border border-line bg-panel shadow-2xl lg:static lg:z-auto lg:flex lg:max-h-none lg:rounded-none lg:border-0 lg:border-l lg:shadow-none ${ticketOpen ? 'flex' : ''}`}>
        <div className="border-b border-line px-3 py-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">{sym}</h2>
            <span className="text-[10.5px] text-mute">{engine.info(sym)?.sector} · simulated</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[22px] font-semibold leading-tight">{fmtINR(q.ltp)}</span>
            <span className={`text-[12.5px] ${pnlClass(q.change)}`}>{fmtSigned(q.change)} ({fmtPct(q.changePct)})</span>
          </div>
          <div className="mt-2" aria-label="Day range">
            <div className="relative h-1 rounded bg-panel2"><span className="absolute top-1/2 h-2.5 w-1 -translate-y-1/2 rounded bg-buy" style={{ left: `calc(${pos}% - 2px)` }} /></div>
            <div className="mt-1 flex justify-between text-[10.5px] text-mute"><span>Low {fmtINR(q.low)}</span><span>High {fmtINR(q.high)}</span></div>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11.5px]">
            {[['Open', fmtINR(q.open)], ['Prev. close', fmtINR(q.prevClose)], ['Volume', fmtVol(q.volume)], ['Circuit', `${fmtNum(q.lowerCircuit)} - ${fmtNum(q.upperCircuit)}`]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2"><dt className="text-mute">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>
        {ticketOpen ? (
          <div className="pt-2.5"><OrderTicket /></div>
        ) : (
          <div className="flex flex-col gap-2.5 p-3">
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-buy py-2.5 text-[14px] font-semibold" onClick={() => openTicket('BUY')}>BUY</button>
              <button className="btn btn-sell py-2.5 text-[14px] font-semibold" onClick={() => openTicket('SELL')}>SELL</button>
            </div>
            <Hint><b>BUY</b> means you expect the price to rise. <b>SELL</b> means you are selling shares you own, or short selling an intraday position.</Hint>
            <Workflow />
            <p className="text-[11px] text-mute">Shortcuts: <kbd>B</kbd> buy, <kbd>S</kbd> sell, <kbd>Esc</kbd> close the order panel. Everything here uses virtual money.</p>
          </div>
        )}
      </aside>
    </>
  );
}
const fmtNum = (n: number) => n.toFixed(2);

function Workflow() {
  const { state } = useApp();
  if (!state.settings.beginnerMode) return null;
  const hasPos = state.positions.some((p) => p.qty !== 0) || state.holdings.length > 0;
  const hasOrder = state.orders.length > 0;
  const steps = ['Select a stock', 'Look at price and chart', 'Choose BUY or SELL', 'Enter quantity', 'Place the order', 'Watch your position', 'Watch your P&L', 'Close the position'];
  const current = hasPos ? 5 : hasOrder ? 6 : 2;
  return (
    <ol className="space-y-0.5 rounded border border-line bg-app p-2 text-[11.5px]" aria-label="How to trade, step by step">
      {steps.map((s, i) => (
        <li key={s} className={`flex items-center gap-2 ${i < current ? 'text-mute' : i === current ? 'font-medium text-ink' : 'text-mute/70'}`}>
          <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${i < current ? 'bg-gain/20 text-gain' : i === current ? 'bg-buy text-white' : 'bg-panel2'}`}>{i < current ? '✓' : i + 1}</span>{s}
        </li>
      ))}
    </ol>
  );
}
