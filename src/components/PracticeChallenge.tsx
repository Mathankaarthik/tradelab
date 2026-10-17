import { useEffect, useMemo, useRef, useState } from 'react';
import { Rng } from '../utils/rng';
import { fmtINR, fmtSigned, pnlClass } from '../utils/format';
import { roundTick } from '../utils/price';
import { Hint } from './ui';

interface Scenario { id: string; title: string; story: string; price: number; side: 'BUY' | 'SELL'; segments: { n: number; drift: number; vol: number }[]; defQty: number; defSl: number; defTg: number }
const SCENARIOS: Scenario[] = [
  { id: 'trend', title: 'Steady uptrend', story: 'ABC is trading at ₹100. Buy 100 shares, set a stop-loss at ₹98 and a target at ₹104.', price: 100, side: 'BUY', segments: [{ n: 40, drift: 0.0006, vol: 0.004 }, { n: 60, drift: 0.0012, vol: 0.004 }, { n: 50, drift: -0.0003, vol: 0.005 }], defQty: 100, defSl: 98, defTg: 104 },
  { id: 'chop', title: 'Choppy sideways day', story: 'ABC is at ₹100 and drifts without a clear direction. Can your stop-loss survive the noise?', price: 100, side: 'BUY', segments: [{ n: 150, drift: 0, vol: 0.0065 }], defQty: 100, defSl: 99, defTg: 102 },
  { id: 'reversal', title: 'Sharp reversal', story: 'ABC rallies and then falls hard. A stop-loss is the difference between a small and a large loss.', price: 100, side: 'BUY', segments: [{ n: 50, drift: 0.0009, vol: 0.004 }, { n: 100, drift: -0.0016, vol: 0.006 }], defQty: 100, defSl: 98, defTg: 106 },
  { id: 'short', title: 'Short-selling a falling stock', story: 'ABC is at ₹100 and weakening. You SELL first (short) and plan to buy back lower.', price: 100, side: 'SELL', segments: [{ n: 70, drift: -0.0010, vol: 0.004 }, { n: 80, drift: 0.0002, vol: 0.005 }], defQty: 100, defSl: 102, defTg: 96 },
];
const CAPITAL = 100000;
const STEPS = 150;

function makePath(s: Scenario, seed: number): number[] {
  const rng = new Rng(seed * 7919 + s.id.length * 104729); const out = [s.price]; let p = s.price;
  for (const seg of s.segments) for (let i = 0; i < seg.n && out.length <= STEPS; i++) { p = roundTick(p * (1 + seg.drift + seg.vol * rng.gauss())); out.push(p); }
  return out;
}
interface Outcome { exitIdx: number; exit: number; reason: 'stoploss' | 'target' | 'end' | 'manual' }

function score(s: Scenario, qty: number, sl: number | null, tg: number | null, o: Outcome) {
  const dir = s.side === 'BUY' ? 1 : -1; const pnl = (o.exit - s.price) * qty * dir;
  const value = qty * s.price; const riskPct = sl ? (Math.abs(s.price - sl) * qty) / CAPITAL * 100 : 100;
  const slDist = sl ? Math.abs(s.price - sl) / s.price * 100 : 100;
  const risk = !sl ? 0 : riskPct <= 1 ? 25 : riskPct <= 2 ? 20 : riskPct <= 5 ? 10 : 0;
  const size = value / CAPITAL <= 0.25 ? 20 : value / CAPITAL <= 0.5 ? 12 : value / CAPITAL <= 1 ? 6 : 0;
  const stop = !sl ? 0 : slDist <= 3 ? 20 : slDist <= 6 ? 12 : 6;
  const planned = sl ? -Math.abs(s.price - sl) * qty : -Infinity;
  const result = pnl > 0 ? 25 : pnl >= planned ? 15 : 5;
  const trades = o.reason === 'manual' ? 6 : 10;
  const tips: string[] = [];
  if (!sl) tips.push('You traded without a stop-loss. This is the biggest risk-management mistake.');
  else if (riskPct > 2) tips.push(`Your stop-loss risked ${riskPct.toFixed(1)}% of capital. Many traders keep it at 1-2% or less.`);
  if (value / CAPITAL > 0.5) tips.push('The position was more than half of your capital. Consider a smaller size.');
  if (tg && sl && Math.abs(tg - s.price) < Math.abs(s.price - sl)) tips.push('Your target was closer than your stop-loss, so you risked more than you could gain.');
  if (o.reason === 'manual') tips.push('Exiting early by hand costs points here. Plan your exit before entering and stick to it.');
  if (!tips.length) tips.push('Sensible plan: small risk, reasonable size, defined exits.');
  return { pnl, parts: [['Risk management', risk, 25], ['Position sizing', size, 20], ['Stop-loss usage', stop, 20], ['Profit / loss', result, 25], ['Unnecessary trades', trades, 10]] as [string, number, number][], total: risk + size + stop + result + trades, tips };
}

export default function PracticeChallenge() {
  const [sid, setSid] = useState(SCENARIOS[0].id); const sc = SCENARIOS.find((x) => x.id === sid)!;
  const [seed, setSeed] = useState(1);
  const [qty, setQty] = useState(String(sc.defQty)); const [sl, setSl] = useState(String(sc.defSl)); const [tg, setTg] = useState(String(sc.defTg));
  const [err, setErr] = useState(''); const [idx, setIdx] = useState(-1); const [outcome, setOutcome] = useState<Outcome | null>(null);
  const path = useMemo(() => makePath(sc, seed), [sc, seed]);
  const plan = useRef<{ q: number; sl: number | null; tg: number | null }>({ q: 0, sl: null, tg: null });
  useEffect(() => { setQty(String(sc.defQty)); setSl(String(sc.defSl)); setTg(String(sc.defTg)); setIdx(-1); setOutcome(null); setErr(''); }, [sid, sc]);
  useEffect(() => { setIdx(-1); setOutcome(null); }, [seed]);

  const running = idx >= 0 && !outcome;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setIdx((i) => {
      const n = i + 1; const p = path[Math.min(n, path.length - 1)]; const { sl: s, tg: t } = plan.current; const long = sc.side === 'BUY';
      if (s !== null && (long ? p <= s : p >= s)) { setOutcome({ exitIdx: n, exit: s, reason: 'stoploss' }); return n; }
      if (t !== null && (long ? p >= t : p <= t)) { setOutcome({ exitIdx: n, exit: t, reason: 'target' }); return n; }
      if (n >= path.length - 1) { setOutcome({ exitIdx: n, exit: p, reason: 'end' }); return n; }
      return n;
    }), 45);
    return () => clearInterval(id);
  }, [running, path, sc.side]);

  const run = () => {
    const q = Number(qty); const s = sl.trim() ? Number(sl) : null; const t = tg.trim() ? Number(tg) : null; const long = sc.side === 'BUY';
    if (!Number.isInteger(q) || q <= 0) return setErr('Quantity must be a whole number greater than 0.');
    if (q * sc.price > CAPITAL * 5) return setErr('Position exceeds your intraday buying power (5x capital).');
    if (s !== null && (!(s > 0) || (long ? s >= sc.price : s <= sc.price))) return setErr(long ? 'Stop-loss must be below the entry price for a BUY.' : 'Stop-loss must be above the entry price for a SELL.');
    if (t !== null && (!(t > 0) || (long ? t <= sc.price : t >= sc.price))) return setErr(long ? 'Target must be above the entry price for a BUY.' : 'Target must be below the entry price for a SELL.');
    setErr(''); plan.current = { q, sl: s, tg: t }; setOutcome(null); setIdx(0);
  };
  const exitNow = () => setOutcome({ exitIdx: idx, exit: path[idx], reason: 'manual' });
  const skip = () => { // fast-forward to the end using the same rules
    const { sl: s, tg: t } = plan.current; const long = sc.side === 'BUY';
    for (let n = idx + 1; n < path.length; n++) { const p = path[n];
      if (s !== null && (long ? p <= s : p >= s)) return setOutcome({ exitIdx: n, exit: s, reason: 'stoploss' }), setIdx(n);
      if (t !== null && (long ? p >= t : p <= t)) return setOutcome({ exitIdx: n, exit: t, reason: 'target' }), setIdx(n); }
    setOutcome({ exitIdx: path.length - 1, exit: path[path.length - 1], reason: 'end' }); setIdx(path.length - 1);
  };
  const res = outcome ? score(sc, plan.current.q, plan.current.sl, plan.current.tg, outcome) : null;
  const shown = path.slice(0, Math.max(idx, 0) + 1);
  const W = 560, H = 200; const all = path; const lo = Math.min(...all, plan.current.sl ?? sc.defSl, sc.defTg) - 0.5; const hi = Math.max(...all, plan.current.sl ?? sc.defSl, sc.defTg) + 0.5;
  const x = (i: number) => (i / (path.length - 1)) * W; const y = (p: number) => H - ((p - lo) / (hi - lo)) * H;
  const cur = idx >= 0 ? path[Math.min(idx, path.length - 1)] : sc.price; const livePnl = (cur - sc.price) * plan.current.q * (sc.side === 'BUY' ? 1 : -1);
  const slN = Number(sl), tgN = Number(tg);
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-5">
      <h1 className="text-[18px] font-semibold">Practice challenges</h1>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Scenarios">{SCENARIOS.map((s) => <button key={s.id} role="tab" aria-selected={sid === s.id} onClick={() => setSid(s.id)} className={`rounded-full border px-3 py-1 text-[12px] ${sid === s.id ? 'border-buy bg-buy/15 text-buy' : 'border-line text-mute hover:text-ink'}`}>{s.title}</button>)}</div>
      <div className="panel p-4">
        <p className="text-[13.5px]">You have ₹1,00,000 virtual capital. {sc.story}</p>
        <div className="mt-3 grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="space-y-2.5">
            <div className="text-[12px] text-mute">Direction: <b className={sc.side === 'BUY' ? 'text-buy' : 'text-sell'}>{sc.side}</b> at {fmtINR(sc.price)}</div>
            {([['Quantity', qty, setQty, 'pc-q'], ['Stop-loss (₹)', sl, setSl, 'pc-s'], ['Target (₹)', tg, setTg, 'pc-t']] as const).map(([l, v, set, id]) => <div key={id}><label className="label" htmlFor={id}>{l}</label><input id={id} className="input" inputMode="decimal" value={v} disabled={idx >= 0} onChange={(e) => set(e.target.value)} /></div>)}
            <p className="text-[11.5px] text-mute">Position value {fmtINR((Number(qty) || 0) * sc.price, 0)} · Max loss at stop {fmtINR(Math.abs(sc.price - slN) * (Number(qty) || 0), 0)}</p>
            {err && <p role="alert" className="text-[12px] text-loss">{err}</p>}
            <div className="flex flex-wrap gap-2">
              {idx < 0 && <button className="btn btn-buy" onClick={run}>Start simulation</button>}
              {running && <><button className="btn btn-danger" onClick={exitNow}>Exit now</button><button className="btn" onClick={skip}>Skip to end</button></>}
              {outcome && <><button className="btn" onClick={() => { setIdx(-1); setOutcome(null); }}>Change plan</button><button className="btn" onClick={() => setSeed((s) => s + 1)}>New market path</button></>}
            </div>
          </div>
          <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-line bg-app" role="img" aria-label="Simulated price path for the challenge">
              {Number.isFinite(slN) && sl.trim() && <g><line x1="0" x2={W} y1={y(slN)} y2={y(slN)} stroke="rgb(var(--c-loss))" strokeDasharray="4 4" /><text x="4" y={y(slN) - 3} fontSize="10" fill="rgb(var(--c-loss))">Stop-loss {slN}</text></g>}
              {Number.isFinite(tgN) && tg.trim() && <g><line x1="0" x2={W} y1={y(tgN)} y2={y(tgN)} stroke="rgb(var(--c-gain))" strokeDasharray="4 4" /><text x="4" y={y(tgN) - 3} fontSize="10" fill="rgb(var(--c-gain))">Target {tgN}</text></g>}
              <line x1="0" x2={W} y1={y(sc.price)} y2={y(sc.price)} stroke="rgb(var(--c-mute))" strokeOpacity=".5" strokeDasharray="2 4" />
              <polyline fill="none" stroke="rgb(var(--c-buy))" strokeWidth="2" points={shown.map((p, i) => `${x(i)},${y(p)}`).join(' ')} />
            </svg>
            <div className="mt-1.5 flex justify-between text-[12px]"><span className="text-mute">Price <b className="text-ink">{fmtINR(cur)}</b></span><span>{idx >= 0 && <>Live P&L <b className={pnlClass(livePnl)}>{fmtSigned(outcome ? res!.pnl : livePnl)}</b></>}</span></div>
          </div>
        </div>
      </div>
      {res && outcome && (
        <div className="panel p-4" role="status">
          <h2 className="text-[15px] font-semibold">{outcome.reason === 'stoploss' ? 'STOP-LOSS HIT' : outcome.reason === 'target' ? 'TARGET HIT' : outcome.reason === 'manual' ? 'You exited manually' : 'Session ended'} · P&L <span className={pnlClass(res.pnl)}>{fmtSigned(res.pnl)}</span></h2>
          <div className="mt-1 text-[24px] font-semibold">{res.total}<span className="text-[13px] font-normal text-mute"> / 100</span></div>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">{res.parts.map(([k, v, m]) => <li key={k} className="flex items-center justify-between rounded bg-app px-2.5 py-1.5 text-[12.5px]"><span>{k}</span><b>{v} / {m}</b></li>)}</ul>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[12.5px]">{res.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="mt-3 text-[11px] text-mute">The score rewards planning and discipline, not just profit. A lucky win with no stop-loss still scores poorly. Simulation for education only.</p>
        </div>
      )}
      <Hint>Good habits score higher: risk about 1% of capital, always use a stop-loss, size the position from the stop distance, and avoid unplanned exits. The price path is random and is not a prediction of any real stock.</Hint>
    </div>
  );
}
