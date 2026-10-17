import { ReactNode, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { pnlClass } from '../utils/format';

export function Modal({ title, children, onClose, footer, width = 'max-w-md', labelledBy }: {
  title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; width?: string; labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const a = f[0], b = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={labelledBy ?? title}
        className={`animate-slide flex max-h-[92vh] w-full flex-col rounded-t-lg border border-line bg-panel shadow-2xl sm:rounded-lg ${width}`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <button data-close className="btn btn-ghost btn-sm" aria-label="Close dialog" onClick={onClose}>✕</button>
        </div>
        <div className="overflow-auto px-4 py-3">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Beginner explanation. Only visible when "Show educational explanations" is on. */
export function Hint({ children, tone = 'info', className = '' }: { children: ReactNode; tone?: 'info' | 'warn'; className?: string }) {
  const { state } = useApp();
  if (!state.settings.showExplanations) return null;
  const c = tone === 'warn' ? 'border-warn/40 bg-warn/10 text-warn' : 'border-buy/30 bg-buy/10 text-ink';
  return <p className={`rounded border px-2 py-1.5 text-[11.5px] leading-snug ${c} ${className}`}><span aria-hidden="true">{tone === 'warn' ? '⚠ ' : 'ⓘ '}</span>{children}</p>;
}

export function Stat({ label, value, tone, sub, hint }: { label: string; value: ReactNode; tone?: number; sub?: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 px-3 py-2" title={hint}>
      <div className="truncate text-[11.5px] text-mute">{label}</div>
      <div className={`truncate text-[16px] font-medium ${tone === undefined ? '' : pnlClass(tone)}`}>{value}</div>
      {sub && <div className="truncate text-[11px] text-mute">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-[96px] items-center justify-center px-4 py-6 text-center text-[12.5px] text-mute">{children}</div>;
}

export function SideBadge({ side }: { side: 'BUY' | 'SELL' }) {
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${side === 'BUY' ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell'}`}>{side}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-[12.5px] font-medium transition ${value === t.id ? 'border-buy text-ink' : 'border-transparent text-mute hover:text-ink'}`}>
          {t.label}{t.count ? <span className="ml-1 rounded-full bg-panel2 px-1.5 text-[10.5px] text-mute">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="rgb(var(--c-buy))" />
      <path d="M10 6v20M22 4v22" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="11" width="6" height="9" rx="1.2" fill="#fff" />
      <rect x="19" y="8" width="6" height="11" rx="1.2" fill="#14161a" />
    </svg>
  );
}

export function PaperBadge({ short = false }: { short?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-warn/50 bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn" role="note">
      <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden="true" />
      {short ? 'PAPER TRADING' : 'PAPER TRADING — VIRTUAL MONEY'}
    </span>
  );
}
