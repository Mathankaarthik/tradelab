import { useState } from 'react';
import { useApp, View } from '../store/AppContext';
import { availableMargin } from '../engine/trading';
import { fmtINR } from '../utils/format';
import StockSearch from './StockSearch';
import { Logo, PaperBadge } from './ui';

export const NAV: { id: View; label: string }[] = [
  { id: 'terminal', label: 'Trade' }, { id: 'dashboard', label: 'Dashboard' }, { id: 'orders', label: 'Orders' },
  { id: 'positions', label: 'Positions' }, { id: 'holdings', label: 'Holdings' }, { id: 'funds', label: 'Funds' },
  { id: 'history', label: 'History' }, { id: 'learn', label: 'Learn' }, { id: 'practice', label: 'Practice' }, { id: 'risk', label: 'Risk calculator' },
];

export default function Header() {
  const { state, view, setView, updateSettings } = useApp();
  const [menu, setMenu] = useState(false);
  const dark = state.settings.theme === 'dark';
  const go = (v: View) => { setView(v); setMenu(false); };
  const beginner = state.settings.beginnerMode;
  return (
    <header className="relative z-40 border-b border-line bg-panel">
      <div className="flex h-11 items-center gap-2 px-3">
        <button className="flex items-center gap-2" onClick={() => go('terminal')} aria-label="TradeLab home">
          <Logo />
          <span className="leading-tight text-left">
            <span className="block text-[15px] font-semibold tracking-tight">TradeLab</span>
            <span className="hidden text-[10px] text-mute 2xl:block">Indian Stock Market Paper Trading Simulator</span>
          </span>
        </button>
        <div className="mx-2 hidden w-64 md:block lg:w-72"><StockSearch /></div>
        <nav className="ml-1 hidden items-center gap-0.5 2xl:flex" aria-label="Main">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} aria-current={view === n.id ? 'page' : undefined}
              className={`rounded px-2.5 py-1.5 text-[12.5px] ${view === n.id ? 'bg-panel2 font-medium text-ink' : 'text-mute hover:text-ink'}`}>{n.label}</button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right leading-tight sm:block" data-tour="balance" title="Margin you can use for new orders. Virtual money only.">
            <div className="text-[10.5px] text-mute">Virtual balance</div>
            <div className="text-[13px] font-semibold">{fmtINR(availableMargin(state))}</div>
          </div>
          <span className="hidden lg:block"><PaperBadge /></span>
          <span className="hidden sm:block lg:hidden"><PaperBadge short /></span>
          <button className={`btn btn-sm ${beginner ? 'border-buy/60 text-buy' : ''}`} aria-pressed={beginner} title="Beginner mode adds plain-language explanations"
            onClick={() => updateSettings({ beginnerMode: !beginner, showExplanations: !beginner })}>
            <span aria-hidden="true">🎓</span><span className="hidden md:inline">Beginner mode</span><span className="md:hidden">Learn</span>
          </button>
          <button className="btn btn-ghost btn-sm" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}>{dark ? '☀' : '☾'}</button>
          <button className="btn btn-ghost btn-sm hidden 2xl:inline-flex" aria-label="Profile and settings" onClick={() => go('settings')}>⚙ Settings</button>
          <button className="btn btn-ghost btn-sm 2xl:hidden" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>☰</button>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-1.5 sm:hidden">
        <PaperBadge short />
        <span className="ml-auto text-[11.5px] text-mute">Balance <b className="text-ink">{fmtINR(availableMargin(state))}</b></span>
      </div>
      <div className="border-t border-line px-3 py-1.5 md:hidden"><StockSearch /></div>
      {menu && (
        <nav className="absolute right-2 top-11 z-50 w-56 rounded border border-line bg-panel p-1 shadow-xl 2xl:hidden" aria-label="Menu">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} className={`block w-full rounded px-3 py-2 text-left text-[13px] ${view === n.id ? 'bg-panel2 font-medium' : 'hover:bg-panel2'}`}>{n.label}</button>
          ))}
          <button onClick={() => go('settings')} className="block w-full rounded px-3 py-2 text-left text-[13px] hover:bg-panel2">Settings & profile</button>
        </nav>
      )}
    </header>
  );
}
