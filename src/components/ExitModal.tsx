import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { fmtINR } from '../utils/format';
import { Hint, Modal } from './ui';

export default function ExitModal({ symbol, product, onClose }: { symbol: string; product: 'MIS' | 'CNC'; onClose: () => void }) {
  const { state, engine, saveExit } = useApp();
  const key = `${symbol}:${product}`; const cur = state.exits[key];
  const [sl, setSl] = useState(cur?.stopLoss?.toString() ?? ''); const [tg, setTg] = useState(cur?.target?.toString() ?? '');
  const [err, setErr] = useState('');
  const ltp = engine.price(symbol);
  const save = () => {
    const r = saveExit(key, { stopLoss: sl.trim() ? Number(sl) : undefined, target: tg.trim() ? Number(tg) : undefined });
    if (r.ok) onClose(); else setErr(r.events[0]?.title ?? 'Could not save.');
  };
  return (
    <Modal title={`Target & stop-loss · ${symbol}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-buy" onClick={save}>Save</button></>}>
      <p className="mb-3 text-[12.5px] text-mute">Current price {fmtINR(ltp)}. The position is closed automatically when either level is touched.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="x-sl">Stop-loss price</label><input id="x-sl" data-autofocus className="input" inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} /></div>
        <div><label className="label" htmlFor="x-tg">Target price</label><input id="x-tg" className="input" inputMode="decimal" value={tg} onChange={(e) => setTg(e.target.value)} /></div>
      </div>
      {err && <p role="alert" className="mt-2 text-[12px] text-loss">{err}</p>}
      <div className="mt-3"><Hint>Leave a field empty to remove it. For a long position the stop-loss sits below the price and the target above. For a short position it is the other way round.</Hint></div>
    </Modal>
  );
}
