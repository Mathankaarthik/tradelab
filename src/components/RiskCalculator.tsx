import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { accountValue } from '../engine/trading';
import { SIM } from '../config/sim';
import { calculatePositionSize } from '../utils/pnl';
import { fmtINR, fmtNum } from '../utils/format';
import { Hint } from './ui';

export default function RiskCalculator() {
  const { state, ctx, engine, openTicket } = useApp();
  const [cap, setCap] = useState(String(Math.round(accountValue(state, ctx))));
  const [risk, setRisk] = useState('1');
  const [entry, setEntry] = useState(engine.price(state.selected).toFixed(2));
  const [stop, setStop] = useState((engine.price(state.selected) * 0.98).toFixed(2));
  const [target, setTarget] = useState('');
  const c = Number(cap), r = Number(risk), e = Number(entry), s = Number(stop), t = target.trim() ? Number(target) : NaN;
  const valid = c > 0 && r > 0 && e > 0 && s > 0 && e !== s;
  const res = valid ? calculatePositionSize(c, r, e, s) : null;
  const buyingCap = valid ? Math.floor((c * SIM.leverage.MIS) / e) : 0;
  const qty = res ? Math.min(res.qty, buyingCap) : 0;
  const long = e > s;
  const rr = Number.isFinite(t) && res && res.riskPerShare > 0 ? Math.abs(t - e) / res.riskPerShare : null;
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-5">
      <h1 className="text-[18px] font-semibold">Risk calculator</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel space-y-3 p-4">
          {([['Account balance (₹)', cap, setCap, 'rc-cap'], ['Risk per trade (%)', risk, setRisk, 'rc-risk'], ['Entry price (₹)', entry, setEntry, 'rc-entry'], ['Stop-loss price (₹)', stop, setStop, 'rc-stop'], ['Target price (₹, optional)', target, setTarget, 'rc-tg']] as const).map(([l, v, set, id]) => (
            <div key={id}><label className="label" htmlFor={id}>{l}</label><input id={id} className="input" inputMode="decimal" value={v} onChange={(ev) => set(ev.target.value)} /></div>
          ))}
          <p className="text-[11.5px] text-mute">Prefilled from {state.selected}'s simulated price. Change any value.</p>
        </div>
        <div className="space-y-3">
          {!res ? <div className="panel p-4 text-[12.5px] text-mute">Enter positive numbers. The entry price and stop-loss must be different.</div> : (
            <div className="panel p-4">
              <h2 className="mb-2 text-[13px] font-semibold">Result</h2>
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex justify-between"><dt className="text-mute">Maximum money to risk</dt><dd className="font-semibold">{fmtINR(res.maxRisk)}</dd></div>
                <div className="flex justify-between"><dt className="text-mute">Risk per share</dt><dd>{fmtINR(res.riskPerShare)}</dd></div>
                <div className="flex justify-between"><dt className="text-mute">Maximum quantity</dt><dd className="font-semibold">{res.qty} shares</dd></div>
                <div className="flex justify-between"><dt className="text-mute">Position value</dt><dd>{fmtINR(res.qty * e)} ({((res.qty * e / c) * 100).toFixed(1)}% of balance)</dd></div>
                {rr !== null && <div className="flex justify-between"><dt className="text-mute">Reward : risk</dt><dd>{fmtNum(rr)} : 1</dd></div>}
              </dl>
              {res.qty > buyingCap && <p className="mt-2 text-[12px] text-warn">Your balance limits you to {buyingCap} shares with 5x intraday leverage, so use {buyingCap}.</p>}
              <div className="mt-3 flex gap-2"><button className="btn btn-buy" disabled={qty < 1} onClick={() => openTicket(long ? 'BUY' : 'SELL', { qty })}>Use {qty} shares in order ticket</button></div>
            </div>
          )}
          <div className="panel space-y-2 p-4 text-[12.5px] leading-relaxed">
            <h2 className="text-[13px] font-semibold">How this works</h2>
            <p>1. Decide how much of your balance you accept losing if you are wrong. Here that is {r || 0}% of {fmtINR(c || 0, 0)}, which is <b>{fmtINR(res?.maxRisk ?? 0)}</b>.</p>
            <p>2. Your stop-loss is the exit if the trade goes wrong. The distance from entry to stop-loss is <b>{fmtINR(res?.riskPerShare ?? 0)}</b> per share.</p>
            <p>3. Divide the money you can lose by the loss per share: {fmtINR(res?.maxRisk ?? 0)} ÷ {fmtINR(res?.riskPerShare ?? 0)} = <b>{res?.qty ?? 0} shares</b> (rounded down).</p>
            <p>Example: ₹1,00,000 capital, 1% risk, entry ₹500, stop-loss ₹490 gives ₹1,000 ÷ ₹10 = 100 shares.</p>
            <Hint>Many traders risk 1% or less per trade so that a string of losses cannot wipe out the account. Slippage and charges mean the real loss can be slightly higher.</Hint>
          </div>
        </div>
      </div>
    </div>
  );
}
