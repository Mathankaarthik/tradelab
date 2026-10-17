import { useApp } from '../store/AppContext';

const tone = { success: 'border-gain/60', error: 'border-loss/70', warning: 'border-warn/70', info: 'border-buy/60' } as const;
const icon = { success: '✓', error: '✕', warning: '!', info: 'i' } as const;
const iconTone = { success: 'bg-gain', error: 'bg-loss', warning: 'bg-warn', info: 'bg-buy' } as const;

export default function ToastHost() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed right-3 top-14 z-[80] flex w-[min(92vw,340px)] flex-col gap-2" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto animate-slide flex items-start gap-2 rounded border bg-panel px-3 py-2 shadow-lg ${tone[t.kind]}`}>
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${iconTone[t.kind]}`} aria-hidden="true">{icon[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">{t.title}</div>
            {t.message && <div className="text-[11.5px] text-mute">{t.message}</div>}
          </div>
          <button className="text-mute hover:text-ink" aria-label="Dismiss notification" onClick={() => dismissToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
