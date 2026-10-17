import { ReactNode, useState } from 'react';
import { CHARGE_CONFIG } from '../config/charges';
import { SIM } from '../config/sim';
import { calculateCharges } from '../utils/charges';
import { calculatePositionSize } from '../utils/pnl';
import { fmtINR, fmtSigned, pnlClass } from '../utils/format';

function Slider({ label, value, set, min, max, step = 1, fmt = (n: number) => String(n) }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step?: number; fmt?: (n: number) => string }) {
  return (
    <label className="block text-[12px]">
      <span className="flex justify-between text-mute"><span>{label}</span><b className="text-ink">{fmt(value)}</b></span>
      <input type="range" className="w-full accent-[rgb(var(--c-buy))]" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}
const Out = ({ children, tone }: { children: ReactNode; tone?: number }) => <div className={`rounded border border-line bg-app px-3 py-2 text-[13px] ${tone === undefined ? '' : pnlClass(tone)}`}>{children}</div>;
const inr = (n: number) => fmtINR(n);

function DemoStock() {
  const [sh, setSh] = useState(1000);
  const total = 10_000_000;
  return <div className="space-y-2"><Slider label="Shares you own (company has 1 crore shares)" value={sh} set={setSh} min={100} max={500000} step={100} fmt={(n) => n.toLocaleString('en-IN')} /><Out>You own {((sh / total) * 100).toFixed(4)}% of this company. If the company is valued at ₹500 per share, your stake is worth {inr(sh * 500)}.</Out></div>;
}
function DemoBuy() {
  const [p, setP] = useState(105);
  const pnl = (p - 100) * 10;
  return <div className="space-y-2"><p className="text-[12px] text-mute">You BUY 10 shares at ₹100. Drag the price.</p><Slider label="Price later" value={p} set={setP} min={90} max={110} step={0.5} fmt={inr} /><Out tone={pnl}>P&L = ({p} − 100) × 10 = <b>{fmtSigned(pnl)}</b>. Buying profits when the price rises.</Out></div>;
}
function DemoSell() {
  const [p, setP] = useState(95);
  const pnl = (100 - p) * 10;
  return <div className="space-y-2"><p className="text-[12px] text-mute">Short sell: you SELL 10 shares first at ₹100, then buy back later.</p><Slider label="Buy-back price" value={p} set={setP} min={90} max={110} step={0.5} fmt={inr} /><Out tone={pnl}>P&L = (100 − {p}) × 10 = <b>{fmtSigned(pnl)}</b>. Selling first profits when the price falls. Selling shares you already own simply books your result.</Out></div>;
}
function DemoIntraday() {
  const [m, setM] = useState(14 * 60);
  const t = `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`;
  const closed = m >= 15 * 60 + 30;
  return <div className="space-y-2"><Slider label="Clock" value={m} set={setM} min={9 * 60 + 15} max={15 * 60 + 30} step={15} fmt={() => t} /><Out>{closed ? 'It is 3:30 PM. Your intraday (MIS) position is closed automatically at the market price.' : 'Your intraday position is open. You must close it before 3:30 PM or it will be closed for you.'}</Out></div>;
}
function DemoDelivery() {
  const [d, setD] = useState(3);
  return <div className="space-y-2"><Slider label="Days since you bought (Delivery / CNC)" value={d} set={setD} min={0} max={30} fmt={(n) => `${n} days`} /><Out>Still in your Holdings after {d} day{d === 1 ? '' : 's'}. Delivery shares are paid in full and are never auto-sold.</Out></div>;
}
function DemoMarket() {
  const [p, setP] = useState(500);
  const buy = Math.round(p * (1 + SIM.slippagePct) * 20) / 20;
  return <div className="space-y-2"><Slider label="Current price" value={p} set={setP} min={100} max={1000} step={5} fmt={inr} /><Out>A market BUY fills near the current price, here about <b>{inr(buy)}</b>. You get speed, not a guaranteed price.</Out></div>;
}
function DemoLimit() {
  const [lim, setLim] = useState(495); const [mkt, setMkt] = useState(500);
  const filled = mkt <= lim;
  return <div className="space-y-2"><Slider label="Your BUY limit price" value={lim} set={setLim} min={480} max={520} step={1} fmt={inr} /><Slider label="Market price" value={mkt} set={setMkt} min={480} max={520} step={1} fmt={inr} /><Out tone={filled ? 1 : 0}>{filled ? `Price reached ${inr(lim)} or lower: your order is executed.` : `Market ${inr(mkt)} is above your limit ${inr(lim)}: the order stays pending.`}</Out></div>;
}
function DemoSL() {
  const [sl, setSl] = useState(490); const [p, setP] = useState(495);
  const hit = p <= sl;
  return <div className="space-y-2"><p className="text-[12px] text-mute">You bought 10 shares at ₹500.</p><Slider label="Stop-loss" value={sl} set={setSl} min={470} max={499} fmt={inr} /><Slider label="Market price" value={p} set={setP} min={470} max={520} fmt={inr} /><Out tone={hit ? -1 : 0}>{hit ? `STOP-LOSS HIT. Position closed near ${inr(sl)}: loss ${fmtSigned((sl - 500) * 10)}.` : `Price is above the stop-loss, position open. Maximum planned loss: ${fmtSigned((sl - 500) * 10)}.`}</Out></div>;
}
function DemoTarget() {
  const [tg, setTg] = useState(510); const [p, setP] = useState(505);
  const hit = p >= tg;
  return <div className="space-y-2"><p className="text-[12px] text-mute">You bought 10 shares at ₹500.</p><Slider label="Target" value={tg} set={setTg} min={501} max={540} fmt={inr} /><Slider label="Market price" value={p} set={setP} min={480} max={540} fmt={inr} /><Out tone={hit ? 1 : 0}>{hit ? `TARGET HIT. Profit locked in: ${fmtSigned((tg - 500) * 10)}.` : 'Target not reached yet, position stays open.'}</Out></div>;
}
function DemoLeverage() {
  const [lev, setLev] = useState(5); const own = 20000;
  const pos = own * lev; const pnl = pos * 0.01;
  return <div className="space-y-2"><Slider label="Leverage" value={lev} set={setLev} min={1} max={5} fmt={(n) => `${n}x`} /><Out>With {inr(own)} you control {inr(pos)} of shares. A 1% move changes your result by <b className={pnlClass(1)}>±{inr(pnl)}</b>, which is {((pnl / own) * 100).toFixed(0)}% of your own money. Leverage magnifies losses too.</Out></div>;
}
function DemoMargin() {
  const [v, setV] = useState(100000);
  return <div className="space-y-2"><Slider label="Value of shares you want to hold" value={v} set={setV} min={10000} max={500000} step={5000} fmt={inr} /><Out>Intraday (5x): margin needed <b>{inr(v / SIM.leverage.MIS)}</b>. Delivery: <b>{inr(v)}</b>. Margin is blocked, not spent, and returns when you close.</Out></div>;
}
function DemoBrokerage() {
  const [v, setV] = useState(50000); const c = calculateCharges({ side: 'BUY', product: 'MIS', price: v / 100, qty: 100 });
  return <div className="space-y-2"><Slider label="Trade value" value={v} set={setV} min={5000} max={500000} step={5000} fmt={inr} /><Out>Brokerage is the lower of {(CHARGE_CONFIG.brokerage.intraday.pct * 100).toFixed(2)}% or {inr(CHARGE_CONFIG.brokerage.intraday.max)} per order: <b>{inr(c.brokerage)}</b>. Charges apply on both the buy and the sell.</Out></div>;
}
function DemoSTT() {
  const [v, setV] = useState(100000);
  const mk = (side: 'BUY' | 'SELL', product: 'MIS' | 'CNC') => calculateCharges({ side, product, price: v / 100, qty: 100 }).stt;
  return <div className="space-y-2"><Slider label="Trade value" value={v} set={setV} min={10000} max={500000} step={10000} fmt={inr} /><Out>Intraday: STT on sell only = {inr(mk('SELL', 'MIS'))}. Delivery: on buy {inr(mk('BUY', 'CNC'))} and on sell {inr(mk('SELL', 'CNC'))}. STT is a government tax on securities transactions.</Out></div>;
}
function DemoPnl() {
  const [b, setB] = useState(500); const [s, setS] = useState(510);
  const g = (s - b) * 100; const ch = calculateCharges({ side: 'BUY', product: 'MIS', price: b, qty: 100 }).total + calculateCharges({ side: 'SELL', product: 'MIS', price: s, qty: 100 }).total;
  return <div className="space-y-2"><p className="text-[12px] text-mute">100 shares, intraday.</p><Slider label="Buy price" value={b} set={setB} min={480} max={520} fmt={inr} /><Slider label="Sell price" value={s} set={setS} min={480} max={520} fmt={inr} /><Out tone={g - ch}>Gross P&L {fmtSigned(g)} − charges {inr(ch)} = <b>{fmtSigned(g - ch)}</b> net. Small moves can be eaten by charges.</Out></div>;
}
function DemoRisk() {
  const [cap, setCap] = useState(100000); const [r, setR] = useState(1);
  const x = calculatePositionSize(cap, r, 500, 490);
  return <div className="space-y-2"><Slider label="Capital" value={cap} set={setCap} min={25000} max={500000} step={5000} fmt={inr} /><Slider label="Risk per trade" value={r} set={setR} min={0.25} max={5} step={0.25} fmt={(n) => `${n}%`} /><Out>Entry ₹500, stop ₹490. Risk budget {inr(x.maxRisk)} ÷ ₹10 per share = <b>{x.qty} shares</b>. If the stop-loss hits you lose about {inr(x.maxRisk)}.</Out></div>;
}

const LESSONS: { title: string; body: string; Demo: () => JSX.Element }[] = [
  { title: 'What is a stock?', body: 'A stock is a small piece of ownership in a company. When the company does well, other people may pay more for its shares, and the price rises. When it does badly, the price can fall.', Demo: DemoStock },
  { title: 'What is BUY?', body: 'BUY means you purchase shares because you expect the price to increase. You profit if you later sell at a higher price and lose if the price falls.', Demo: DemoBuy },
  { title: 'What is SELL?', body: 'SELL means you give up shares. You can sell shares you own to book profit or loss. In intraday trading you can also sell first (short selling) and buy back later, hoping the price falls.', Demo: DemoSell },
  { title: 'What is intraday trading?', body: 'Intraday (MIS) means you open and close the position on the same day. You get leverage, but positions not closed by 3:30 PM are closed automatically.', Demo: DemoIntraday },
  { title: 'What is delivery trading?', body: 'Delivery (CNC) means you pay the full price and the shares are kept in your holdings. You can hold them for days, months or years.', Demo: DemoDelivery },
  { title: 'What is a market order?', body: 'A market order executes right away at roughly the current price. It is fast, but the exact price can differ slightly (slippage).', Demo: DemoMarket },
  { title: 'What is a limit order?', body: 'A limit order executes only at your chosen price or better. A BUY limit below the market waits until the price falls to it. It may never execute.', Demo: DemoLimit },
  { title: 'What is stop-loss?', body: 'A stop-loss is an order designed to limit your loss if the price moves against you. When the price touches your stop-loss level, your position is closed automatically. It does not guarantee the exact exit price.', Demo: DemoSL },
  { title: 'What is a target?', body: 'A target is the profit level where you plan to exit. When the price touches it, the position is closed and the profit is locked in. Targets and stop-losses together define your risk and reward before you enter.', Demo: DemoTarget },
  { title: 'What is leverage?', body: 'Leverage lets you hold a larger position than your cash alone allows. It magnifies both profits and losses, so it is the fastest way for beginners to lose money.', Demo: DemoLeverage },
  { title: 'What is margin?', body: 'Margin is the amount set aside from your balance to hold a leveraged position. It is a deposit, not a fee, and is released when you close the position.', Demo: DemoMargin },
  { title: 'What is brokerage?', body: 'Brokerage is the fee a broker charges per executed order. Together with other charges it is paid on every trade, win or lose.', Demo: DemoBrokerage },
  { title: 'What is STT?', body: 'Securities Transaction Tax (STT) is a tax collected on trades. The rate depends on whether the trade is intraday or delivery, and on the buy or sell side. Rates here are configurable estimates.', Demo: DemoSTT },
  { title: 'How P&L works', body: 'For a long position P&L = (current price − average buy price) × quantity. For a short position P&L = (average sell price − current price) × quantity. Charges are then subtracted. Green is profit, red is loss.', Demo: DemoPnl },
  { title: 'Basic risk management', body: 'Decide how much you can afford to lose before entering. Many traders risk about 1% of capital per trade, always use a stop-loss, and size the position from the stop distance. Surviving losing streaks matters more than any single win.', Demo: DemoRisk },
];

export default function EducationPanel() {
  const [i, setI] = useState(0); const L = LESSONS[i]; const Demo = L.Demo;
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-3 sm:p-5 md:grid-cols-[250px_1fr]">
      <nav aria-label="Lessons" className="panel max-h-[70vh] overflow-auto md:max-h-none">
        <h1 className="border-b border-line px-3 py-2 text-[14px] font-semibold">Learn</h1>
        <ol>{LESSONS.map((l, k) => <li key={l.title}><button onClick={() => setI(k)} aria-current={k === i} className={`flex w-full gap-2 px-3 py-2 text-left text-[12.5px] ${k === i ? 'bg-panel2 font-medium' : 'text-mute hover:text-ink'}`}><span className="w-5 text-mute">{k + 1}.</span>{l.title}</button></li>)}</ol>
      </nav>
      <article className="panel p-4 sm:p-5">
        <div className="text-[11.5px] text-mute">Lesson {i + 1} of {LESSONS.length}</div>
        <h2 className="mt-0.5 text-[18px] font-semibold">{L.title}</h2>
        <p className="mt-2 max-w-prose text-[13.5px] leading-relaxed">{L.body}</p>
        <div className="mt-4 max-w-md rounded border border-line bg-panel2 p-3"><div className="mb-2 text-[12px] font-medium">Try it</div><Demo key={i} /></div>
        <div className="mt-5 flex justify-between">
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
          <button className="btn btn-buy" disabled={i === LESSONS.length - 1} onClick={() => setI(i + 1)}>Next lesson</button>
        </div>
        <p className="mt-4 text-[11px] text-mute">Educational content only. Not investment advice. Numbers are simplified examples.</p>
      </article>
    </div>
  );
}
