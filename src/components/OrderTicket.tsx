import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { OrderInput, availableMargin, estimateOrder, posKey, validateOrder } from '../engine/trading';
import type { OrderType, Product, Side } from '../types';
import { CHARGES_DISCLAIMER } from '../config/charges';
import { fmtINR, fmtNum } from '../utils/format';
import { roundTick } from '../utils/price';
import ConfirmationModal from './ConfirmationModal';
import { Hint } from './ui';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const optNum = (s: string) => (s.trim() === '' ? undefined : Number(s));
const TYPES: { id: OrderType; label: string; hint: string }[] = [
  { id: 'MARKET', label: 'Market', hint: 'Executes around the current market price.' },
  { id: 'LIMIT', label: 'Limit', hint: 'Executes only at your chosen price or better.' },
  { id: 'SL', label: 'SL', hint: 'Stop-loss: an order designed to limit your loss if price moves against you. It activates at the trigger price, then works as a limit order.' },
  { id: 'SL-M', label: 'SL-M', hint: 'Stop-loss market: activates at the trigger price, then executes at the market price. More likely to fill, price may slip.' },
];

export default function OrderTicket() {
  const { state, ctx, engine, ticketSide, ticketPreset, ticketNonce, closeTicket, place, toast, setBottomTab, setMobileTab } = useApp();
  const sym = state.selected;
  const [side, setSide] = useState<Side>(ticketSide);
  const [product, setProduct] = useState<Product>('MIS');
  const [type, setType] = useState<OrderType>('MARKET');
  const [qty, setQty] = useState('1'); const [price, setPrice] = useState(''); const [trigger, setTrigger] = useState('');
  const [target, setTarget] = useState(''); const [sl, setSl] = useState('');
  const [exitsOpen, setExitsOpen] = useState(false); const [chargesOpen, setChargesOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false); const [confirm, setConfirm] = useState(false);
  const ltp = engine.price(sym);

  useEffect(() => { setSide(ticketSide); }, [ticketSide, ticketNonce]);
  useEffect(() => {
    if (ticketPreset?.qty) setQty(String(ticketPreset.qty));
    if (ticketPreset?.product) setProduct(ticketPreset.product);
    setSubmitted(false);
  }, [ticketNonce, ticketPreset]);
  useEffect(() => { setPrice(ltp.toFixed(2)); setTrigger(''); setTarget(''); setSl(''); setSubmitted(false); /* eslint-disable-next-line */ }, [sym]);
  useEffect(() => { if (type !== 'MARKET' && !price) setPrice(ltp.toFixed(2)); /* eslint-disable-next-line */ }, [type]);

  const needsPrice = type === 'LIMIT' || type === 'SL'; const needsTrigger = type === 'SL' || type === 'SL-M';
  const input: OrderInput = useMemo(() => ({
    symbol: sym, side, product, type, qty: num(qty),
    price: needsPrice ? num(price) : undefined, trigger: needsTrigger ? num(trigger) : undefined,
    target: optNum(target), stopLoss: optNum(sl),
  }), [sym, side, product, type, qty, price, trigger, target, sl, needsPrice, needsTrigger]);

  const issues = validateOrder(state, input, ctx);
  const est = estimateOrder(state, input, ctx);
  const avail = availableMargin(state);
  const pos = state.positions.find((p) => p.symbol === sym && p.product === 'MIS');
  const held = state.holdings.find((h) => h.symbol === sym)?.qty ?? 0;
  const isShort = side === 'SELL' && product === 'MIS' && (!pos || pos.qty <= 0 || (Number.isFinite(input.qty) && input.qty > pos.qty));
  const fieldErr = (f: string) => issues.find((i) => i.field === f && (submitted || !(f === 'qty' && qty === '')));
  const generalErrs = issues.filter((i) => ['funds', 'market', 'holding', 'general'].includes(i.field));
  const riskAmt = Number.isFinite(input.qty) && input.stopLoss ? Math.abs(est.price - input.stopLoss) * input.qty : 0;
  const key = posKey(sym, product); void key;

  const submit = () => {
    setSubmitted(true);
    const hard = issues.filter((i) => !i.reject);
    if (hard.length) { toast({ kind: 'error', title: hard[0].message }); return; }
    if (issues.length) { place(input); return; } // records a REJECTED order + toast (funds / market closed / holdings)
    setConfirm(true);
  };
  const doPlace = () => {
    setConfirm(false);
    const r = place(input);
    if (r.ok) { closeTicket(); setBottomTab(input.type === 'MARKET' ? 'positions' : 'orders'); setMobileTab('portfolio'); }
  };
  const col = side === 'BUY' ? 'buy' : 'sell';

  return (
    <form className="flex flex-col gap-2.5 px-3 pb-3" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Order ticket" noValidate>
      <div className="grid grid-cols-2 gap-1 rounded bg-app p-1" role="group" aria-label="Side">
        {(['BUY', 'SELL'] as Side[]).map((s) => (
          <button type="button" key={s} aria-pressed={side === s} onClick={() => setSide(s)}
            className={`rounded py-1.5 text-[13px] font-semibold ${side === s ? (s === 'BUY' ? 'bg-buy text-white' : 'bg-sell text-white') : 'text-mute hover:text-ink'}`}>{s}</button>
        ))}
      </div>
      <Hint>{side === 'BUY' ? 'You are buying shares because you expect the price to increase.' : 'You are selling shares you own.'}</Hint>
      {isShort && <Hint tone="warn">Short selling means selling first with the intention of buying back later at a lower price. If the price rises instead, you lose money. Intraday positions are auto closed at 3:30 PM.</Hint>}

      <fieldset>
        <legend className="label">Product</legend>
        <div className="grid grid-cols-2 gap-1">
          {([['MIS', 'Intraday', 'MIS'], ['CNC', 'Delivery', 'CNC']] as const).map(([p, l, c]) => (
            <label key={p} className={`cursor-pointer rounded border px-2 py-1.5 text-center text-[12.5px] ${product === p ? 'border-buy bg-buy/10 font-medium' : 'border-line text-mute hover:text-ink'}`}>
              <input type="radio" className="sr-only" name="product" checked={product === p} onChange={() => setProduct(p)} />{l} <span className="text-[10.5px] opacity-70">{c}</span>
            </label>
          ))}
        </div>
        <Hint className="mt-1.5">{product === 'MIS' ? 'Intraday (MIS): uses margin and must be closed the same day. Open positions are squared off automatically at 3:30 PM.' : 'Delivery (CNC): you pay the full amount and the shares stay in your holdings until you sell.'}</Hint>
      </fieldset>

      <fieldset>
        <legend className="label">Order type</legend>
        <div className="grid grid-cols-4 gap-1">
          {TYPES.map((t) => (
            <label key={t.id} title={t.hint} className={`cursor-pointer rounded border px-1 py-1.5 text-center text-[12px] ${type === t.id ? 'border-buy bg-buy/10 font-medium' : 'border-line text-mute hover:text-ink'}`}>
              <input type="radio" className="sr-only" name="otype" checked={type === t.id} onChange={() => setType(t.id)} />{t.label}
            </label>
          ))}
        </div>
        <Hint className="mt-1.5">{TYPES.find((t) => t.id === type)!.hint}</Hint>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="qty">Quantity</label>
          <div className="flex">
            <button type="button" className="btn btn-sm rounded-r-none" aria-label="Decrease quantity" onClick={() => setQty(String(Math.max(1, (num(qty) || 1) - 1)))}>−</button>
            <input id="qty" className="input rounded-none text-center" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={!!fieldErr('qty')} aria-describedby="qty-err" />
            <button type="button" className="btn btn-sm rounded-l-none" aria-label="Increase quantity" onClick={() => setQty(String((num(qty) || 0) + 1))}>+</button>
          </div>
          <div id="qty-err" className="mt-0.5 min-h-[14px] text-[11px] text-loss">{fieldErr('qty')?.message}</div>
        </div>
        <div>
          <label className="label" htmlFor="price">Price</label>
          <input id="price" className="input" inputMode="decimal" disabled={!needsPrice} value={needsPrice ? price : ''} placeholder={needsPrice ? '' : 'At market'} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!fieldErr('price')} />
          <div className="mt-0.5 min-h-[14px] text-[11px] text-loss">{fieldErr('price')?.message}</div>
        </div>
        {needsTrigger && (
          <div className="col-span-2">
            <label className="label" htmlFor="trigger">Trigger price</label>
            <input id="trigger" className="input" inputMode="decimal" value={trigger} placeholder={side === 'SELL' ? `Below ${fmtNum(ltp)}` : `Above ${fmtNum(ltp)}`} onChange={(e) => setTrigger(e.target.value)} aria-invalid={!!fieldErr('trigger')} />
            <div className="mt-0.5 min-h-[14px] text-[11px] text-loss">{fieldErr('trigger')?.message}</div>
          </div>
        )}
      </div>
      {type === 'MARKET' && <div className="flex flex-wrap gap-1 text-[11px] text-mute" aria-label="Quick price">
        <button type="button" className="btn btn-sm" onClick={() => { setType('LIMIT'); setPrice(roundTick(ltp * (side === 'BUY' ? 0.995 : 1.005)).toFixed(2)); }}>Limit 0.5% {side === 'BUY' ? 'below' : 'above'}</button>
      </div>}

      <div>
        <button type="button" className="text-[12px] text-buy hover:underline" aria-expanded={exitsOpen} onClick={() => setExitsOpen((o) => !o)}>{exitsOpen ? '▾' : '▸'} Target & stop-loss (optional)</button>
        {exitsOpen && (
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="sl">Stop-loss price</label>
              <input id="sl" className="input" inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} placeholder={side === 'BUY' ? 'Below entry' : 'Above entry'} aria-invalid={!!fieldErr('stopLoss')} />
              <div className="mt-0.5 min-h-[14px] text-[11px] text-loss">{fieldErr('stopLoss')?.message}</div>
            </div>
            <div>
              <label className="label" htmlFor="target">Target price</label>
              <input id="target" className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={side === 'BUY' ? 'Above entry' : 'Below entry'} aria-invalid={!!fieldErr('target')} />
              <div className="mt-0.5 min-h-[14px] text-[11px] text-loss">{fieldErr('target')?.message}</div>
            </div>
            <div className="col-span-2"><Hint>Once your order executes, the position is closed automatically when the price touches the stop-loss (STOP-LOSS HIT) or the target (TARGET HIT).</Hint></div>
          </div>
        )}
        {state.settings.beginnerMode && !exitsOpen && !input.stopLoss && side === 'BUY' && (
          <Hint tone="warn" className="mt-1.5">No stop-loss set. Setting one before you trade is a good habit.</Hint>
        )}
        {riskAmt > 0 && <p className="mt-1.5 text-[11.5px] text-mute">If your stop-loss is hit you lose about <b className="text-loss">{fmtINR(riskAmt)}</b> ({((riskAmt / state.account.startingCapital) * 100).toFixed(2)}% of starting capital).</p>}
      </div>

      <dl className="space-y-1 rounded border border-line bg-app px-2.5 py-2 text-[12px]">
        <Row k={type === 'MARKET' ? 'Estimated price' : 'Order price'} v={fmtINR(est.price)} />
        <Row k="Estimated order value" v={fmtINR(est.value)} />
        {state.settings.showCharges && <Row k={<button type="button" className="underline decoration-dotted" onClick={() => setChargesOpen((o) => !o)} aria-expanded={chargesOpen}>Estimated charges</button>} v={fmtINR(est.charges.total)} />}
        {state.settings.showCharges && chargesOpen && (
          <div className="ml-2 space-y-0.5 border-l border-line pl-2 text-[11.5px] text-mute">
            {(['brokerage', 'stt', 'exchange', 'gst', 'sebi', 'stamp'] as const).map((k) => <Row key={k} k={{ brokerage: 'Brokerage', stt: 'STT', exchange: 'Exchange charges', gst: 'GST', sebi: 'SEBI charges', stamp: 'Stamp duty' }[k]} v={fmtINR(est.charges[k])} />)}
            <p className="pt-1 text-[10.5px]">{CHARGES_DISCLAIMER}</p>
          </div>
        )}
        <Row k={side === 'BUY' ? 'Estimated total' : 'Estimated proceeds'} v={fmtINR(est.net)} strong />
        <Row k="Required margin" v={fmtINR(est.requiredMargin)} />
        <Row k="Available funds" v={fmtINR(avail)} />
        {side === 'SELL' && product === 'CNC' && <Row k="In your holdings" v={`${held} shares`} />}
      </dl>
      <Hint>Margin is the money held back from your balance to keep this position open. {product === 'MIS' ? 'Intraday gives 5x leverage here, so ₹10,000 of margin controls ₹50,000 of shares. Leverage magnifies losses as well as profits.' : 'Delivery needs the full order value.'}</Hint>

      {generalErrs.length > 0 && (
        <div role="alert" className="space-y-0.5 rounded border border-loss/50 bg-loss/10 px-2.5 py-1.5 text-[12px] text-loss">{generalErrs.map((g) => <div key={g.message}>{g.message}</div>)}</div>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn flex-1" onClick={closeTicket}>Cancel</button>
        <button type="submit" className={`btn flex-[2] py-2 text-[13px] font-semibold ${side === 'BUY' ? 'btn-buy' : 'btn-sell'}`}>{side} {sym}</button>
      </div>
      <p className="text-center text-[10.5px] text-mute">Virtual money only. Shortcuts: <kbd>B</kbd> buy · <kbd>S</kbd> sell · <kbd>Esc</kbd> close</p>

      {confirm && (
        <ConfirmationModal title={`${side} ${sym}`} tone={col as 'buy' | 'sell'} confirmLabel={`Confirm ${side}`} onCancel={() => setConfirm(false)} onConfirm={doPlace}>
          <dl className="space-y-1.5 text-[13px]">
            <Row k="Quantity" v={String(input.qty)} />
            <Row k="Product" v={product === 'MIS' ? 'Intraday (MIS)' : 'Delivery (CNC)'} />
            <Row k="Order type" v={type === 'SL-M' ? 'Stop-loss market' : type === 'SL' ? 'Stop-loss' : type[0] + type.slice(1).toLowerCase()} />
            {needsTrigger && <Row k="Trigger price" v={fmtINR(input.trigger ?? 0)} />}
            <Row k={type === 'MARKET' ? 'Estimated price' : 'Price'} v={fmtINR(est.price)} />
            <Row k="Estimated value" v={fmtINR(est.value)} />
            {state.settings.showCharges && <Row k="Estimated charges" v={fmtINR(est.charges.total)} />}
            <Row k={side === 'BUY' ? 'Estimated total' : 'Estimated proceeds'} v={fmtINR(est.net)} strong />
            {input.stopLoss && <Row k="Stop-loss" v={fmtINR(input.stopLoss)} />}
            {input.target && <Row k="Target" v={fmtINR(input.target)} />}
          </dl>
          <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-2 py-1.5 text-[11.5px] text-warn">PAPER TRADING — VIRTUAL MONEY. No real order is placed.</p>
        </ConfirmationModal>
      )}
    </form>
  );
}

function Row({ k, v, strong }: { k: React.ReactNode; v: string; strong?: boolean }) {
  return <div className="flex items-baseline justify-between gap-3"><dt className="text-mute">{k}</dt><dd className={strong ? 'font-semibold' : ''}>{v}</dd></div>;
}
