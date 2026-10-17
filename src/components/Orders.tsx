import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { Order, OrderStatus } from '../types';
import { fmtINR, fmtNum } from '../utils/format';
import { fmtClock, fmtDate } from '../utils/marketTime';
import { Empty, Hint, Modal, SideBadge } from './ui';

const typeLabel = (t: Order['type']) => ({ MARKET: 'Market', LIMIT: 'Limit', SL: 'Stop-loss', 'SL-M': 'SL-Market' }[t]);
const statusCls: Record<OrderStatus, string> = { OPEN: 'bg-buy/15 text-buy', EXECUTED: 'bg-gain/15 text-gain', CANCELLED: 'bg-mute/20 text-mute', REJECTED: 'bg-loss/15 text-loss' };
const tagLabel = (o: Order) => ({ MANUAL: '', CLOSE: 'Position close', TARGET: 'Target hit', STOPLOSS: 'Stop-loss hit', SQUAREOFF: 'Auto square-off' }[o.tag]);

export default function Orders({ compact = false }: { compact?: boolean }) {
  const { state, cancel } = useApp();
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [mod, setMod] = useState<Order | null>(null); const [detail, setDetail] = useState<Order | null>(null);
  const rows = state.orders.filter((o) => filter === 'ALL' || o.status === filter).slice().reverse();
  const openCount = state.orders.filter((o) => o.status === 'OPEN').length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 px-0.5">
        {(['ALL', 'OPEN', 'EXECUTED', 'CANCELLED', 'REJECTED'] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-full border px-2.5 py-0.5 text-[11.5px] ${filter === f ? 'border-buy bg-buy/15 text-buy' : 'border-line text-mute hover:text-ink'}`}>
            {f === 'ALL' ? 'All' : f[0] + f.slice(1).toLowerCase()}{f === 'OPEN' && openCount ? ` (${openCount})` : ''}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? <Empty>{filter === 'ALL' ? 'No orders yet. Orders you place will be listed here with their status.' : `No ${filter.toLowerCase()} orders.`}</Empty> : (
          <table className="w-full min-w-[820px] text-[12.5px]">
            <thead><tr>{['Time', 'Symbol', 'Type', 'Side', 'Qty', 'Price', 'Status', 'Product', 'Actions'].map((h, i) => <th key={h} className={`th ${i === 4 || i === 5 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-panel2/50">
                  <td className="td text-mute">{fmtClock(o.time, true)}</td>
                  <td className="td font-semibold">{o.symbol}</td>
                  <td className="td">{typeLabel(o.type)}{o.type === 'SL' || o.type === 'SL-M' ? <span className="ml-1 text-[11px] text-mute">@{fmtNum(o.trigger)}</span> : null}</td>
                  <td className="td"><SideBadge side={o.side} /></td>
                  <td className="td text-right">{o.qty}</td>
                  <td className="td text-right">{o.status === 'EXECUTED' ? fmtNum(o.avgPrice) : o.type === 'MARKET' || o.type === 'SL-M' ? 'Market' : fmtNum(o.price)}</td>
                  <td className="td"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${statusCls[o.status]}`}>{o.status}</span></td>
                  <td className="td">{o.product}</td>
                  <td className="td"><div className="flex gap-1">
                    {o.status === 'OPEN' && o.type !== 'MARKET' && <button className="btn btn-sm" onClick={() => setMod(o)}>Modify</button>}
                    {o.status === 'OPEN' && <button className="btn btn-danger btn-sm" onClick={() => cancel(o.id)}>Cancel</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetail(o)}>Details</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!compact && <div className="mt-3"><Hint><b>OPEN</b> orders are waiting for the price. <b>EXECUTED</b> orders have been filled. <b>REJECTED</b> orders failed a check, such as not enough virtual funds. Pending orders expire at 3:30 PM.</Hint></div>}
      {mod && <ModifyModal order={mod} onClose={() => setMod(null)} />}
      {detail && <DetailsModal order={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ModifyModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { modify } = useApp();
  const [qty, setQty] = useState(String(order.qty)); const [price, setPrice] = useState(order.price ? order.price.toFixed(2) : '');
  const [trigger, setTrigger] = useState(order.trigger ? order.trigger.toFixed(2) : ''); const [err, setErr] = useState('');
  const hasPrice = order.type === 'LIMIT' || order.type === 'SL'; const hasTrig = order.type === 'SL' || order.type === 'SL-M';
  const save = () => {
    const r = modify(order.id, { qty: Number(qty), price: hasPrice ? Number(price) : undefined, trigger: hasTrig ? Number(trigger) : undefined });
    if (r.ok) onClose(); else setErr(r.events[0]?.title ?? 'Could not modify the order.');
  };
  return (
    <Modal title={`Modify ${order.side} ${order.symbol}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-buy" onClick={save}>Save changes</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="m-q">Quantity</label><input id="m-q" data-autofocus className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        {hasPrice && <div><label className="label" htmlFor="m-p">Price</label><input id="m-p" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>}
        {hasTrig && <div><label className="label" htmlFor="m-t">Trigger price</label><input id="m-t" className="input" inputMode="decimal" value={trigger} onChange={(e) => setTrigger(e.target.value)} /></div>}
      </div>
      {err && <p role="alert" className="mt-2 text-[12px] text-loss">{err}</p>}
    </Modal>
  );
}

function DetailsModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { state } = useApp();
  const trade = state.trades.find((t) => t.orderId === order.id);
  const rows: [string, string][] = [
    ['Order ID', order.id], ['Placed', `${fmtDate(order.time)}, ${fmtClock(order.time)}`], ['Instrument', `${order.symbol} (simulated)`], ['Side', order.side],
    ['Product', order.product === 'MIS' ? 'Intraday (MIS)' : 'Delivery (CNC)'], ['Order type', typeLabel(order.type)], ['Quantity', String(order.qty)],
    ...(order.type === 'LIMIT' || order.type === 'SL' ? [['Limit price', fmtINR(order.price)] as [string, string]] : []),
    ...(order.type === 'SL' || order.type === 'SL-M' ? [['Trigger price', fmtINR(order.trigger)] as [string, string]] : []),
    ...(order.stopLoss ? [['Attached stop-loss', fmtINR(order.stopLoss)] as [string, string]] : []),
    ...(order.target ? [['Attached target', fmtINR(order.target)] as [string, string]] : []),
    ['Status', order.status], ...(order.status === 'EXECUTED' ? [['Average price', fmtINR(order.avgPrice)] as [string, string]] : []),
    ...(tagLabel(order) ? [['Reason', tagLabel(order)] as [string, string]] : []), ['Note', order.message || '-'],
  ];
  return (
    <Modal title="Order details" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <dl className="space-y-1 text-[12.5px]">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-mute">{k}</dt><dd className="text-right">{v}</dd></div>)}</dl>
      {trade && (
        <div className="mt-3 border-t border-line pt-2 text-[12.5px]">
          <div className="mb-1 font-medium">Charges (simulated estimate)</div>
          {(['brokerage', 'stt', 'exchange', 'gst', 'sebi', 'stamp'] as const).map((k) => <div key={k} className="flex justify-between"><span className="text-mute">{{ brokerage: 'Brokerage', stt: 'STT', exchange: 'Exchange charges', gst: 'GST', sebi: 'SEBI charges', stamp: 'Stamp duty' }[k]}</span><span>{fmtINR(trade.breakdown[k])}</span></div>)}
          <div className="mt-1 flex justify-between font-semibold"><span>Total charges</span><span>{fmtINR(trade.charges)}</span></div>
        </div>
      )}
    </Modal>
  );
}
