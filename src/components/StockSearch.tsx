import { useEffect, useMemo, useRef, useState } from 'react';
import { STOCKS } from '../config/stocks';
import { useApp } from '../store/AppContext';
import { fmtINR, fmtPct, pnlClass } from '../utils/format';

export default function StockSearch({ onPicked }: { onPicked?: () => void }) {
  const { state, engine, select, toggleWatch, setView, setMobileTab } = useApp();
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [idx, setIdx] = useState(0);
  const box = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return [];
    return STOCKS.filter((x) => x.symbol.toLowerCase().includes(s) || x.name.toLowerCase().includes(s))
      .sort((a, b) => Number(b.symbol.toLowerCase().startsWith(s)) - Number(a.symbol.toLowerCase().startsWith(s))).slice(0, 8);
  }, [q]);
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  // "/" focuses search (when not typing)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, []);
  const pick = (sym: string) => { select(sym); setView('terminal'); setMobileTab('chart'); setQ(''); setOpen(false); onPicked?.(); input.current?.blur(); };

  return (
    <div ref={box} className="relative w-full">
      <input ref={input} className="input pr-6" type="search" role="combobox" aria-expanded={open && results.length > 0} aria-controls="search-results" aria-label="Search stocks"
        placeholder="Search stocks, e.g. TCS   ( / )" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && results[idx]) pick(results[idx].symbol);
          else if (e.key === 'Escape') { setOpen(false); (e.target as HTMLElement).blur(); }
        }} />
      {open && q.trim() !== '' && (
        <ul id="search-results" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded border border-line bg-panel shadow-xl">
          {results.length === 0 && <li className="px-3 py-3 text-[12.5px] text-mute">No stock matches “{q}”. Try a symbol like INFY or SBIN.</li>}
          {results.map((r, i) => {
            const qt = engine.quote(r.symbol); const inWl = state.watchlist.includes(r.symbol);
            return (
              <li key={r.symbol} role="option" aria-selected={i === idx} className={`flex items-center gap-2 px-3 py-2 ${i === idx ? 'bg-panel2' : ''}`} onMouseEnter={() => setIdx(i)}>
                <button className="min-w-0 flex-1 text-left" onClick={() => pick(r.symbol)}>
                  <div className="flex items-baseline gap-2"><span className="font-semibold">{r.symbol}</span><span className="truncate text-[11.5px] text-mute">{r.name}</span></div>
                  <div className="text-[11.5px]">{fmtINR(qt.ltp)} <span className={pnlClass(qt.change)}>{fmtPct(qt.changePct)}</span></div>
                </button>
                <button className="btn btn-sm" aria-pressed={inWl} aria-label={inWl ? `Remove ${r.symbol} from watchlist` : `Add ${r.symbol} to watchlist`} onClick={() => toggleWatch(r.symbol)}>{inWl ? '★ Added' : '☆ Watch'}</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
