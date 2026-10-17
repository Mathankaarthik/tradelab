import { useState } from 'react';
import { useApp } from '../store/AppContext';
import ConfirmationModal from '../components/ConfirmationModal';
import { fmtINR } from '../utils/format';
import type { ChartType } from '../types';

const Toggle = ({ label, desc, on, set }: { label: string; desc?: string; on: boolean; set: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4 py-2.5">
    <span><span className="block text-[13px]">{label}</span>{desc && <span className="block text-[11.5px] text-mute">{desc}</span>}</span>
    <input type="checkbox" role="switch" className="mt-1 h-4 w-4 accent-[rgb(var(--c-buy))]" checked={on} onChange={(e) => set(e.target.checked)} />
  </label>
);

export default function SettingsPage() {
  const { state, updateSettings, resetAccount, startTutorial } = useApp();
  const s = state.settings; const [cap, setCap] = useState(String(s.startingCapital)); const [confirm, setConfirm] = useState(false);
  const capNum = Number(cap); const capOk = Number.isFinite(capNum) && capNum >= 10000 && capNum <= 100000000;
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-3 sm:p-5">
      <h1 className="text-[18px] font-semibold">Settings & profile</h1>
      <div className="panel flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-buy/20 text-[16px] font-semibold text-buy" aria-hidden="true">T</div>
        <div><div className="font-medium">Virtual trader</div><div className="text-[12px] text-mute">No login. Your data stays in this browser (localStorage).</div></div>
      </div>
      <div className="panel divide-y divide-line px-4">
        <div className="py-3">
          <label className="label" htmlFor="cap">Starting capital (₹)</label>
          <div className="flex gap-2"><input id="cap" className="input max-w-[200px]" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} aria-invalid={!capOk} />
            <button className="btn" disabled={!capOk || capNum === s.startingCapital} onClick={() => updateSettings({ startingCapital: capNum })}>Save</button></div>
          <p className={`mt-1 text-[11.5px] ${capOk ? 'text-mute' : 'text-loss'}`}>{capOk ? `Applied the next time you reset the account. Default ₹1,00,000. Currently ${fmtINR(s.startingCapital, 0)}.` : 'Enter an amount between ₹10,000 and ₹10,00,00,000.'}</p>
        </div>
        <div className="py-3"><span className="label">Theme</span>
          <div className="flex gap-2">{(['dark', 'light'] as const).map((t) => <button key={t} className={`btn ${s.theme === t ? 'border-buy text-buy' : ''}`} aria-pressed={s.theme === t} onClick={() => updateSettings({ theme: t })}>{t === 'dark' ? 'Dark' : 'Light'}</button>)}</div></div>
        <div className="grid grid-cols-2 gap-3 py-3">
          <div><label className="label" htmlFor="spd">Market speed</label>
            <select id="spd" className="input" value={s.speed} onChange={(e) => updateSettings({ speed: Number(e.target.value) })}>{[0.5, 1, 2, 5, 10].map((x) => <option key={x} value={x}>{x}x</option>)}</select></div>
          <div><label className="label" htmlFor="ct">Chart type</label>
            <select id="ct" className="input" value={s.chartType} onChange={(e) => updateSettings({ chartType: e.target.value as ChartType })}><option value="candles">Candles</option><option value="line">Line</option><option value="area">Area</option></select></div>
        </div>
        <Toggle label="Beginner mode" desc="Step-by-step guidance, warnings and the trading checklist." on={s.beginnerMode} set={(v) => updateSettings({ beginnerMode: v })} />
        <Toggle label="Show educational explanations" desc="Small plain-language notes next to BUY, SELL, order types, margin and P&L." on={s.showExplanations} set={(v) => updateSettings({ showExplanations: v })} />
        <Toggle label="Show charges" desc="Display estimated brokerage and taxes in tickets and tables." on={s.showCharges} set={(v) => updateSettings({ showCharges: v })} />
      </div>
      <div className="panel flex flex-wrap gap-2 p-4">
        <button className="btn" onClick={startTutorial}>Replay guided tutorial</button>
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>Reset Account</button>
      </div>
      <p className="text-[11.5px] leading-relaxed text-mute">TradeLab is a simulation for educational purposes. It uses virtual money and generated prices that do not predict real markets. Charges are simulated estimates and may not reflect current broker rates. TradeLab is not affiliated with any broker or exchange.</p>
      {confirm && <ConfirmationModal title="Reset account" confirmLabel="Reset Account" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); resetAccount(); }}><p className="text-[13.5px] font-medium">Are you sure? This will delete your paper-trading history.</p></ConfirmationModal>}
    </div>
  );
}
