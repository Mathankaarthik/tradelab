import { ReactNode, useEffect } from 'react';
import { AppProvider, MobileTab, useApp } from './store/AppContext';
import BottomPanel from './components/BottomPanel';
import Chart from './components/Chart';
import EducationPanel from './components/EducationPanel';
import EodModal from './components/EodModal';
import Funds from './components/Funds';
import Header from './components/Header';
import Holdings from './components/Holdings';
import MarketBar from './components/MarketBar';
import OrderPanel from './components/OrderPanel';
import Orders from './components/Orders';
import Positions from './components/Positions';
import PracticeChallenge from './components/PracticeChallenge';
import RiskCalculator from './components/RiskCalculator';
import ToastHost from './components/Toast';
import TradeHistory from './components/TradeHistory';
import Tutorial from './components/Tutorial';
import Watchlist from './components/Watchlist';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/SettingsPage';

function Page({ title, children, fill = false }: { title: string; children: ReactNode; fill?: boolean }) {
  return (
    <div className={`mx-auto flex h-full max-w-6xl flex-col p-3 sm:p-5 ${fill ? '' : 'overflow-auto'}`}>
      <h1 className="mb-3 text-[18px] font-semibold">{title}</h1>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

function Terminal() {
  const { mobileTab, ticketOpen, openTicket, state } = useApp();
  const show = (t: MobileTab) => (mobileTab === t ? 'flex' : 'hidden');
  return (
    <div className="relative flex h-full min-h-0 flex-col lg:grid lg:grid-cols-[250px_minmax(0,1fr)_320px]">
      <div className={`${show('watchlist')} min-h-0 flex-1 flex-col border-r border-line lg:flex`}><Watchlist /></div>
      <div className="flex min-h-0 flex-1 flex-col lg:min-w-0">
        <div className={`${show('chart')} min-h-0 flex-1 flex-col lg:flex lg:min-h-[300px]`}><Chart /></div>
        <div className={`${show('portfolio')} min-h-0 flex-1 flex-col lg:flex lg:h-[270px] lg:flex-none xl:h-[300px]`}><BottomPanel /></div>
      </div>
      <OrderPanel />
      {mobileTab === 'chart' && !ticketOpen && (
        <div className="grid grid-cols-2 gap-2 border-t border-line bg-panel p-2 lg:hidden">
          <button className="btn btn-buy py-2.5 text-[14px] font-semibold" onClick={() => openTicket('BUY')}>BUY {state.selected}</button>
          <button className="btn btn-sell py-2.5 text-[14px] font-semibold" onClick={() => openTicket('SELL')}>SELL {state.selected}</button>
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { view, mobileTab, setMobileTab, setView, openTicket, closeTicket, ticketOpen, tutorialOpen, eodOpen, state, toast } = useApp();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return; // never hijack typing
      if (e.metaKey || e.ctrlKey || e.altKey || tutorialOpen) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); openTicket('BUY'); }
      else if (k === 's') { e.preventDefault(); openTicket('SELL'); }
      else if (k === 'escape' && ticketOpen) closeTicket();
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [openTicket, closeTicket, ticketOpen, tutorialOpen]);

  useEffect(() => { void toast; }, [toast]);

  let body: ReactNode;
  switch (view) {
    case 'dashboard': body = <div className="h-full overflow-auto"><Dashboard /></div>; break;
    case 'orders': body = <Page title="Orders" fill><Orders /></Page>; break;
    case 'positions': body = <Page title="Positions" fill><Positions /></Page>; break;
    case 'holdings': body = <Page title="Holdings" fill><Holdings /></Page>; break;
    case 'funds': body = <Page title="Funds"><Funds /></Page>; break;
    case 'history': body = <Page title="Trade history" fill><TradeHistory /></Page>; break;
    case 'learn': body = <div className="h-full overflow-auto"><EducationPanel /></div>; break;
    case 'practice': body = <div className="h-full overflow-auto"><PracticeChallenge /></div>; break;
    case 'risk': body = <div className="h-full overflow-auto"><RiskCalculator /></div>; break;
    case 'settings': body = <div className="h-full overflow-auto"><SettingsPage /></div>; break;
    default: body = <Terminal />;
  }
  return (
    <div className="flex h-[100dvh] flex-col">
      <Header />
      <MarketBar />
      <main className="min-h-0 flex-1">{body}</main>
      <footer className="hidden border-t border-line bg-panel px-3 py-1 text-[10.5px] text-mute lg:block">
        PAPER TRADING — VIRTUAL MONEY · This is a simulation for educational purposes. Prices are simulated and do not predict real markets. Charges are simulated estimates.
      </footer>
      <nav className="safe-bottom grid grid-cols-3 border-t border-line bg-panel lg:hidden" aria-label="Terminal sections">
        {([['watchlist', 'Watchlist'], ['chart', 'Chart'], ['portfolio', 'Portfolio']] as const).map(([id, label]) => (
          <button key={id} aria-current={view === 'terminal' && mobileTab === id ? 'page' : undefined} onClick={() => { setView('terminal'); setMobileTab(id); }}
            className={`py-2.5 text-[12.5px] ${view === 'terminal' && mobileTab === id ? 'border-t-2 border-buy font-semibold text-ink' : 'border-t-2 border-transparent text-mute'}`}>{label}</button>
        ))}
      </nav>
      <ToastHost />
      {tutorialOpen && <Tutorial />}
      {eodOpen && state.lastEod && <EodModal />}
    </div>
  );
}

export default function App() {
  return <AppProvider><Shell /></AppProvider>;
}
